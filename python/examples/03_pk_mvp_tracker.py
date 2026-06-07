"""Print PK MVPs + booster cards as they fire."""
import asyncio
import os
from tiktok_live_events import TikTokLive

live = TikTokLive(os.environ.get("USERNAME", "tiktokuser"))


@live.on("battle")
def on_battle(e):
    print(f"[battle] status={e['status']} id={e['battleId']} duration={e['battleDuration']}s")


@live.on("battleArmies")
def on_armies(e):
    print(f"[armies] remaining={e.get('secsRemaining')}s")
    for host in e.get("hosts", []):
        print(f"  Host {host['hostUserId']} total={host['teamTotalScore']}")
        mvp_list = host.get("contributors", [])
        if mvp_list:
            mvp = mvp_list[0]
            print(f"    MVP {mvp['nickname']} {mvp['score']} diamonds")


@live.on("battleItemCard")
def on_card(e):
    if e.get("multiplier", 0) > 0:
        print(f"[card] x{e['multiplier']} booster from {e['senderNickname']}")
    else:
        print(f"[card] effect={e['effect']} from {e['senderNickname']} duration={e['durationSec']}s")


asyncio.run(live.run())
