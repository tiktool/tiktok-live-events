"""Log every chat message from a TikTok LIVE stream.

Run:
    USERNAME=streamername python 01_chat_logger.py
"""
import asyncio
import os
from tiktok_live_events import TikTokLive

live = TikTokLive(os.environ.get("USERNAME", "tiktokuser"))


@live.on("connected")
def on_connected(_):
    print("[live] connected")


@live.on("chat")
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")


asyncio.run(live.run())
