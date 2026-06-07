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

import websockets

ENDPOINT = "wss://api.tik.tools"

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
    ) -> None:
        import os
        self.unique_id = (unique_id or "").lstrip("@").strip()
        if not self.unique_id:
            raise ValueError("unique_id is required.")
        self.api_key = (api_key or os.environ.get("TIKTOOL_API_KEY") or "").strip()
        if not self.api_key:
            raise ValueError(
                "Missing API key. Grab a free one in ~10s at https://tik.tools, then "
                "pass it as TikTokLive('user', api_key='...') or set the TIKTOOL_API_KEY "
                "environment variable."
            )
        self.auto_reconnect = auto_reconnect
        self.max_reconnect_attempts = max_reconnect_attempts
        self.debug = debug
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
        url = f"{ENDPOINT}/?uniqueId={quote(self.unique_id)}&apiKey={quote(self.api_key)}"
        masked = url.replace(self.api_key, "***")
        if self.debug:
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
