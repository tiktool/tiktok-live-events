"""tiktok-live-events CLI entry point."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from typing import Any, Optional

from .client import TikTokLive


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


async def _run(args: argparse.Namespace) -> int:
    username = args.username.lstrip("@").strip()
    if not args.emit_json:
        print(f"[events] connecting to @{username} ...")

    filter_set = {s.strip() for s in args.filter.split(",") if s.strip()} if args.filter else None
    live = TikTokLive(username, api_key=args.api_key)

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

    try:
        await live.run()
    except KeyboardInterrupt:
        return 0
    except Exception as e:  # noqa: BLE001
        print(f"[events] failed: {e}", file=sys.stderr)
        return 1
    return 0


def main(argv: Optional[list[str]] = None) -> int:
    args = _parse_args(argv)
    try:
        return asyncio.run(_run(args))
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
