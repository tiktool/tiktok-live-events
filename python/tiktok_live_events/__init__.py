"""tiktok-live-events

Read TikTok LIVE events in 4 lines of Python::

    import asyncio
    from tiktok_live_events import TikTokLive

    live = TikTokLive("streamer_username")

    @live.on("chat")
    def on_chat(e):
        print(f"{e['user']['uniqueId']}: {e['comment']}")

    asyncio.run(live.run())

Real-time chat, gifts, viewers, follows, PK battles, AI captions,
moderation deletes, viewer entry-source analytics and 50+ other live
event types from any TikTok LIVE stream.
"""

from .client import TikTokLive
from .types import (
    BaseEvent,
    ChatEvent,
    GiftEvent,
    LikeEvent,
    MemberEvent,
    SocialEvent,
    RoomUserSeqEvent,
    BattleEvent,
    BattleArmiesEvent,
    BattleItemCardEvent,
    BattleHost,
    BattleContributor,
    CaptionEvent,
    ImDeleteEvent,
    LinkMicOpponentGiftEvent,
    GoalUpdateEvent,
    RoomPinEvent,
    RoomInfo,
    TikTokUser,
)

__version__ = "1.2.0"

__all__ = [
    "TikTokLive",
    "BaseEvent",
    "ChatEvent",
    "GiftEvent",
    "LikeEvent",
    "MemberEvent",
    "SocialEvent",
    "RoomUserSeqEvent",
    "BattleEvent",
    "BattleArmiesEvent",
    "BattleItemCardEvent",
    "BattleHost",
    "BattleContributor",
    "CaptionEvent",
    "ImDeleteEvent",
    "LinkMicOpponentGiftEvent",
    "GoalUpdateEvent",
    "RoomPinEvent",
    "RoomInfo",
    "TikTokUser",
    "__version__",
]
