"""Live gift leaderboard. Refreshes every 5s.

Run:
    USERNAME=streamer python 02_gift_leaderboard.py
"""
import asyncio
import os
from collections import defaultdict
from tiktok_live_events import TikTokLive

live = TikTokLive(os.environ.get("USERNAME", "tiktokuser"))
board: dict[str, int] = defaultdict(int)


@live.on("gift")
def on_gift(e):
    if not e.get("repeatEnd"):
        return
    board[e["user"]["uniqueId"]] += e["diamondCount"] * e["repeatCount"]


async def print_top():
    while True:
        await asyncio.sleep(5)
        top = sorted(board.items(), key=lambda x: -x[1])[:10]
        print("\n-- TOP GIFTERS --")
        for i, (user, diamonds) in enumerate(top, 1):
            print(f"{i:>2}. {user:<20} {diamonds} diamonds")


async def main():
    asyncio.create_task(print_top())
    await live.run()


asyncio.run(main())
