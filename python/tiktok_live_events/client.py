"""Async TikTok LIVE event stream.

Connect to any TikTok LIVE stream over a single WebSocket and receive
real-time chat, gifts, viewers, follows, PK battles, AI captions,
moderation deletes, viewer entry-source analytics and 50+ other event
types as clean JSON. Schema, decoding, proxy rotation and signing happen
server-side - your code only ever sees a typed payload.

Example::

    import asyncio
    from tiktok_live_events import TikTokLive

    live = TikTokLive("creator_username")

    @live.on("chat")
    def on_chat(e):
        print(f"{e['user']['uniqueId']}: {e['comment']}")

    asyncio.run(live.run())
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional
from urllib.parse import quote

import base64
import urllib.request

import websockets

ENDPOINT = "wss://api.tik.tools"
HTTPS_ENDPOINT = "https://api.tik.tools"

Handler = Callable[[Dict[str, Any]], Any]

logger = logging.getLogger("tiktok_live_events")


class TikTokLive:
    """Async TikTok LIVE event stream.

    Construct with a username, register handlers, ``await run()``.
    """

    def __init__(
        self,
        unique_id: str,
        *,
        api_key: Optional[str] = None,
        auto_reconnect: bool = True,
        max_reconnect_attempts: int = 5,
        debug: bool = False,
        mode: str = "auto",
    ) -> None:
        import os
        self.unique_id = (unique_id or "").lstrip("@").strip()
        if not self.unique_id:
            raise ValueError("unique_id is required.")
        # Anonymous mode is supported. Drop in a free key from
        # https://tik.tools to lift the per-IP caps when you hit them.
        self.api_key = (api_key or os.environ.get("TIKTOOL_API_KEY") or "").strip()
        self.auto_reconnect = auto_reconnect
        self.max_reconnect_attempts = max_reconnect_attempts
        self.debug = debug
        # mode: 'auto' | 'managed' | 'direct'
        #   auto    - ask edge which mode to use based on tier
        #             (anon / demo / sandbox -> direct, basic+ -> managed)
        #   managed - single WS to edge, edge runs upstream session
        #   direct  - two WS: TikTok (your IP) + edge /decode
        self.mode = mode if mode in ("auto", "managed", "direct") else "auto"
        self._handlers: Dict[str, List[Handler]] = {}
        self._ws: Optional[websockets.WebSocketClientProtocol] = None
        self._connected = False
        self._stop = asyncio.Event()
        self._attempts = 0

    # ── Registration ──────────────────────────────────────────────

    def on(self, event: str) -> Callable[[Handler], Handler]:
        """Register a handler. Handler may be sync or async.

        ::

            @live.on("chat")
            def on_chat(e):
                ...

        Pass ``"event"`` to receive every decoded event in one handler.
        """

        def wrap(fn: Handler) -> Handler:
            self._handlers.setdefault(event, []).append(fn)
            return fn

        return wrap

    def off(self, event: str, handler: Handler) -> None:
        """Remove a previously-registered handler."""
        if event in self._handlers and handler in self._handlers[event]:
            self._handlers[event].remove(handler)

    # ── Lifecycle ─────────────────────────────────────────────────

    @property
    def connected(self) -> bool:
        """``True`` between the first open and the close."""
        return self._connected

    def stop(self) -> None:
        """Signal :meth:`run` to exit on the next iteration."""
        self._stop.set()
        if self._ws is not None:
            asyncio.create_task(self._ws.close(code=1000, reason="client stop"))

    async def run(self) -> None:
        """Connect and pump events until :meth:`stop` is called or the
        reconnect budget is exhausted.
        """
        effective = self.mode if self.mode in ("managed", "direct") else "managed"
        if self.mode == "auto":
            recommended = await self._fetch_recommended_mode()
            if recommended == "direct":
                effective = "direct"
        if self.debug:
            logger.info("[tiktok-live-events] mode=%s", effective)
        if effective == "direct":
            # Auto-reconnect loop. TT WS frequently closes on keepalive ping
            # timeout when the room hits a quiet patch; reconnect so the
            # customer's session keeps flowing.
            attempts = 0
            while not self._stop.is_set():
                await self._run_direct()
                if self._stop.is_set() or not self.auto_reconnect:
                    return
                attempts += 1
                if attempts > self.max_reconnect_attempts:
                    return
                delay = min(2 ** (attempts - 1), 30)
                if self.debug:
                    logger.info("[tiktok-live-events] direct reconnect in %ds (attempt %d/%d)", delay, attempts, self.max_reconnect_attempts)
                try:
                    await asyncio.wait_for(self._stop.wait(), timeout=delay)
                except asyncio.TimeoutError:
                    pass
            return

        url = f"{ENDPOINT}/?uniqueId={quote(self.unique_id)}"
        if self.api_key:
            url += f"&apiKey={quote(self.api_key)}"
        if self.debug:
            masked = url.replace(self.api_key, "***") if self.api_key else url
            logger.info("[tiktok-live-events] connecting -> %s", masked)

        while not self._stop.is_set():
            try:
                async with websockets.connect(url, max_size=8 * 1024 * 1024) as ws:
                    self._ws = ws
                    self._connected = True
                    self._attempts = 0
                    await self._dispatch("connected", {})
                    async for raw in ws:
                        if self._stop.is_set():
                            break
                        try:
                            msg = json.loads(raw)
                        except json.JSONDecodeError:
                            continue
                        if not isinstance(msg, dict):
                            continue
                        # Edge ships an `anon_limit` / `demo_limit` /
                        # `session_limit` JSON nudge BEFORE closing. Surface
                        # it as a `rate_limited` event and (if no handler is
                        # registered) print the upgrade hint to stderr.
                        nudge_type = msg.get("type")
                        if nudge_type in ("anon_limit", "demo_limit", "session_limit"):
                            await self._dispatch("rate_limited", msg)
                            if not self._handlers.get("rate_limited"):
                                hint = msg.get("message") or "rate limit reached."
                                url = msg.get("upgrade_url") or ""
                                logger.warning("[tiktok-live-events] %s %s", hint, f"(see {url})" if url else "")
                            # Terminal: server closes after this nudge.
                            # Reconnecting just hits the same cap.
                            self._stop.set()
                            continue
                        ev = msg.get("event")
                        if not ev or ev in ("_journal", "ping", "pong"):
                            continue
                        data = msg.get("data") if isinstance(msg.get("data"), dict) else msg
                        await self._dispatch(ev, data)
                        await self._dispatch("event", data)
            except Exception as exc:
                await self._dispatch("error", {"error": str(exc)})
            finally:
                self._connected = False
                self._ws = None
                await self._dispatch("disconnected", {"unique_id": self.unique_id})

            if self._stop.is_set() or not self.auto_reconnect:
                break
            self._attempts += 1
            if self._attempts > self.max_reconnect_attempts:
                break
            delay = min(2 ** (self._attempts - 1), 30)
            if self.debug:
                logger.info(
                    "[tiktok-live-events] reconnect in %ds (attempt %d/%d)",
                    delay,
                    self._attempts,
                    self.max_reconnect_attempts,
                )
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=delay)
            except asyncio.TimeoutError:
                pass

    # ── Internal ──────────────────────────────────────────────────

    async def _dispatch(self, event: str, data: Dict[str, Any]) -> None:
        for handler in list(self._handlers.get(event, [])):
            try:
                result = handler(data)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                logger.exception("[tiktok-live-events] handler for %r raised", event)

    async def _fetch_recommended_mode(self) -> str:
        """Ask the edge which connection mode fits this caller's tier."""
        try:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self._fetch_recommended_mode_sync)
        except Exception:
            return "managed"

    def _fetch_recommended_mode_sync(self) -> str:
        try:
            req = urllib.request.Request(
                f"{HTTPS_ENDPOINT}/webcast/connection_mode",
                data=b"{}",
                headers={"content-type": "application/json", **({"x-api-key": self.api_key} if self.api_key else {})},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                body = json.loads(r.read())
            return (body.get("data") or {}).get("recommended_mode") or "managed"
        except Exception:
            return "managed"

    def _http_post_sync(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        req = urllib.request.Request(
            f"{HTTPS_ENDPOINT}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers={"content-type": "application/json", **({"x-api-key": self.api_key} if self.api_key else {})},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())

    async def _http_post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._http_post_sync, path, body)

    async def _run_direct(self) -> None:
        """Direct mode: customer SDK opens TikTok WS itself (their IP), pipes
        binary frames into our /decode WS, emits decoded JSON events.
        """
        # Resolve room_id + alive.
        try:
            status = await self._http_post("/webcast/live_status", {"unique_id": self.unique_id})
        except Exception as exc:
            await self._dispatch("error", {"error": f"live_status failed: {exc}"})
            return
        data = status.get("data") or {}
        room_id = data.get("room_id")
        if not data.get("is_live") or not room_id:
            await self._dispatch("error", {"error": f"@{self.unique_id} is not currently live"})
            return

        try:
            creds_resp = await self._http_post(
                "/webcast/ws_credentials", {"unique_id": self.unique_id, "room_id": room_id}
            )
        except Exception as exc:
            await self._dispatch("error", {"error": f"ws_credentials failed: {exc}"})
            return
        creds = creds_resp.get("data") or {}
        tt_url = creds.get("ws_url")
        cookies = creds.get("cookies") or ""
        user_agent = creds.get("user_agent") or "Mozilla/5.0"
        binary_frames = creds.get("binary_frames") or {}
        im_enter_b64 = binary_frames.get("im_enter_room_b64")
        heartbeat_b64 = binary_frames.get("heartbeat_b64")
        if not tt_url:
            await self._dispatch("error", {"error": "no ws_url in credentials response"})
            return

        dec_url = f"{ENDPOINT}/decode"
        if self.api_key:
            dec_url += f"?apiKey={quote(self.api_key)}"

        async def heartbeat_loop(tt_ws):
            if not heartbeat_b64:
                return
            try:
                while True:
                    await asyncio.sleep(10)
                    if tt_ws.closed:
                        return
                    try:
                        await tt_ws.send(base64.b64decode(heartbeat_b64))
                    except Exception:
                        return
            except (asyncio.CancelledError, Exception):
                return

        async def pump_tt_to_dec(tt_ws, dec_ws):
            try:
                async for raw in tt_ws:
                    if isinstance(raw, (bytes, bytearray)):
                        try:
                            await dec_ws.send(raw)
                        except Exception:
                            return
            except (asyncio.CancelledError, Exception):
                return

        async def pump_dec_to_emit(dec_ws):
            try:
                async for raw in dec_ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue
                    if not isinstance(msg, dict):
                        continue
                    if msg.get("ready"):
                        continue
                    if msg.get("error"):
                        if msg.get("type") == "rate_limited":
                            await self._dispatch("rate_limited", msg)
                            self._stop.set()
                        continue
                    events = msg.get("events")
                    if isinstance(events, list):
                        for ev in events:
                            if not isinstance(ev, dict):
                                continue
                            evt = ev.get("type")
                            if evt:
                                await self._dispatch(evt, ev)
                            await self._dispatch("event", ev)
            except (asyncio.CancelledError, Exception):
                return

        try:
            extra_headers = {
                "Cookie": cookies,
                "User-Agent": user_agent,
                "Origin": "https://www.tiktok.com",
            }
            async with websockets.connect(tt_url, extra_headers=extra_headers, max_size=8 * 1024 * 1024) as tt_ws, \
                       websockets.connect(dec_url, max_size=8 * 1024 * 1024) as dec_ws:
                self._connected = True
                await self._dispatch("connected", {})
                await self._dispatch("roomInfo", {
                    "roomId": room_id,
                    "wsHost": creds.get("ws_host"),
                    "clusterRegion": creds.get("cluster_region"),
                })
                if im_enter_b64:
                    try:
                        await tt_ws.send(base64.b64decode(im_enter_b64))
                    except Exception:
                        pass
                tasks = [
                    asyncio.create_task(pump_tt_to_dec(tt_ws, dec_ws)),
                    asyncio.create_task(pump_dec_to_emit(dec_ws)),
                    asyncio.create_task(heartbeat_loop(tt_ws)),
                    asyncio.create_task(self._stop.wait()),
                ]
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                # Retrieve completed-task results so asyncio does not log
                # "Task exception was never retrieved" on ConnectionClosedError /
                # other shutdown-time exceptions.
                for t in done:
                    try:
                        _ = t.exception()
                    except (asyncio.CancelledError, asyncio.InvalidStateError):
                        pass
                for t in pending:
                    t.cancel()
                # Await cancellation so their exceptions are also retrieved.
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)
        except Exception as exc:
            await self._dispatch("error", {"error": str(exc)})
        finally:
            self._connected = False
            await self._dispatch("disconnected", {"unique_id": self.unique_id})
