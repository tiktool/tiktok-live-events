"""tiktok-live-events CLI entry point."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

from .client import TikTokLive

CONFIG_DIR = Path.home() / ".tiktok-live-events"
KEY_FILE = CONFIG_DIR / "api-key"


def _load_stored_key() -> str:
    try:
        if KEY_FILE.exists():
            return KEY_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""


def _save_key(key: str) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
        KEY_FILE.write_text(key, encoding="utf-8")
        try:
            os.chmod(KEY_FILE, 0o600)
        except Exception:
            pass
    except Exception:
        pass


def _parse_args(argv: Optional[list[str]]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="tiktok-live-events",
        description="Stream chat, gifts, likes, follows and 50+ other events from any TikTok LIVE.",
    )
    p.add_argument("username", help="TikTok username to follow (with or without @).")
    p.add_argument("-f", "--filter", dest="filter", default="",
                   help="Comma-separated event types (default: all). e.g. chat,gift,follow")
    p.add_argument("--json", dest="emit_json", action="store_true",
                   help="Emit one JSON line per event (machine-readable).")
    p.add_argument("--api-key", dest="api_key", default="",
                   help=argparse.SUPPRESS)
    return p.parse_args(argv)


def _fmt(name: str, e: Any) -> str:
    e = e or {}
    u = (e.get("user") or {}).get("uniqueId") or "?"
    if name == "chat":      return f"[chat]    {u}: {e.get('comment') or ''}"
    if name == "gift":      return f"[gift]    {u} -> {e.get('giftName')} x{e.get('repeatCount') or 1}"
    if name == "like":      return f"[like]    {u} ({e.get('likeCount') or 1})"
    if name == "follow":    return f"[follow]  {u}"
    if name == "share":     return f"[share]   {u}"
    if name == "join":      return f"[join]    {u}"
    if name == "subscribe": return f"[sub]     {u}"
    if name in ("viewer", "roomUser"):
        return f"[viewer]  {e.get('viewerCount') or e.get('totalUser') or '?'}"
    if name == "connected":
        return f"[ready]   connected to @{e.get('uniqueId') or ''} (room {e.get('roomId') or '?'})"
    if name == "streamEnd":  return "[end]     stream ended"
    if name == "disconnected": return "[bye]     disconnected"
    if name == "error":      return f"[error]   {e.get('message') or e}"
    return f"[{name}] {json.dumps(e)[:200]}"


async def _prompt_key(message: str) -> str:
    print("")
    print(f"[limit]   {message}", file=sys.stderr)
    loop = asyncio.get_event_loop()
    answer = await loop.run_in_executor(
        None,
        lambda: input("[events] Paste your API key (or press Enter to quit): "),
    )
    return (answer or "").strip()


async def _run_once(username: str, api_key: str, args: argparse.Namespace) -> tuple[bool, str]:
    """Returns (rate_limited, limit_message)."""
    if not args.emit_json:
        print(f"[events] connecting to @{username} ...")

    filter_set = {s.strip() for s in args.filter.split(",") if s.strip()} if args.filter else None
    live = TikTokLive(username, api_key=api_key)
    limit_msg = {"text": ""}

    def show(name: str, payload: Any) -> None:
        if filter_set is not None and name not in filter_set:
            return
        if args.emit_json:
            sys.stdout.write(json.dumps({"type": name, "data": payload}) + "\n")
            sys.stdout.flush()
        else:
            print(_fmt(name, payload))

    for name in ("chat", "gift", "like", "follow", "share", "join",
                 "subscribe", "viewer", "roomUser", "connected", "streamEnd"):
        live.on(name)(lambda e, _n=name: show(_n, e))

    @live.on("error")
    def _err(e):  # noqa: ANN001
        print(_fmt("error", e), file=sys.stderr)

    @live.on("rate_limited")
    def _rl(e):  # noqa: ANN001
        limit_msg["text"] = e.get("message") or "Anonymous limit reached. Grab a free API key at https://tik.tools to lift the cap."

    await live.run()
    return (bool(limit_msg["text"]), limit_msg["text"])


async def _run(args: argparse.Namespace) -> int:
    username = args.username.lstrip("@").strip()
    api_key = args.api_key or _load_stored_key() or ""
    if api_key and not args.api_key and not args.emit_json:
        print(f"[events] using stored API key from {KEY_FILE}")
    if args.api_key:
        _save_key(args.api_key)

    while True:
        try:
            rate_limited, msg = await _run_once(username, api_key, args)
        except KeyboardInterrupt:
            return 0
        except Exception as e:  # noqa: BLE001
            print(f"[events] failed: {e}", file=sys.stderr)
            return 1

        if not rate_limited:
            return 0

        new_key = await _prompt_key(msg)
        if not new_key:
            print("[events] no key entered. Exiting.")
            return 0
        api_key = new_key
        _save_key(new_key)
        if not args.emit_json:
            print(f"[events] API key saved to {KEY_FILE}")


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    try:
        return asyncio.run(_run(args))
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
