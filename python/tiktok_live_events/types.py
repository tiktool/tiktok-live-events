"""Typed event payloads for tiktok-live-events.

Every event extends :class:`BaseEvent` (``type``, ``timestamp``, ``msgId``,
optional ``protoVersion``). The TypedDicts give IDEs autocomplete on the
payload your handlers receive.
"""

from __future__ import annotations

import sys
from typing import Any, Dict, List

if sys.version_info >= (3, 8):
    from typing import TypedDict
else:
    from typing_extensions import TypedDict


class TikTokUser(TypedDict, total=False):
    """User profile attached to most LIVE events."""

    userId: str
    uniqueId: str
    nickname: str
    profilePictureUrl: str
    followRole: int
    isSubscriber: bool
    payGrade: int
    """TikTok donator level (1-50). Present when the user has ever sent a gift."""


class BaseEvent(TypedDict, total=False):
    type: str
    timestamp: int
    msgId: str
    protoVersion: int
    """Schema revision the event was decoded against (1, 2, or 3)."""


class RoomInfo(TypedDict, total=False):
    roomId: str
    wsHost: str
    clusterRegion: str
    connectedAt: str


class ChatEvent(TypedDict, total=False):
    type: str
    user: TikTokUser
    comment: str
    emotes: List[Dict[str, Any]]
    starred: Dict[str, int]
    # v3
    language: str
    """ISO 639-1 auto-detected for this comment ("en", "tr", "un" = unknown)."""
    messageUuid: str
    """Stable per-message id used by ``imDelete`` moderation events."""
    protoVersion: int


class GiftEvent(TypedDict, total=False):
    type: str
    user: TikTokUser
    giftId: int
    giftName: str
    diamondCount: int
    repeatCount: int
    repeatEnd: bool
    giftType: int
    groupId: str
    # v3
    transactionId: str
    """Stable per-gift UUID. Use as dedup key across upstream retries."""
    senderUserId: str
    """Explicit sender id, mirrors ``user.id``."""
    relationship: Dict[str, Any]
    """``{ joinDayNumber, fromUser, toUser }`` when TikTok attaches it."""
    protoVersion: int


class LikeEvent(TypedDict, total=False):
    type: str
    user: TikTokUser
    likeCount: int
    totalLikes: int


class MemberEvent(TypedDict, total=False):
    type: str
    user: TikTokUser
    action: int
    # v3 viewer-acquisition metadata
    actionCode: int
    entrySource: str
    """Where the viewer came from - "homepage_hot-live_cell", "follow-tab", ..."""
    entryAction: str
    """How they entered - "draw" (algorithmic), "click" (explicit), "other"."""
    entryType: str
    """"rec" when TikTok recommended this stream to the viewer."""
    protoVersion: int


class SocialEvent(TypedDict, total=False):
    type: str
    user: TikTokUser
    action: str


class RoomUserSeqEvent(TypedDict, total=False):
    type: str
    viewerCount: int
    totalViewers: int


class BattleContributor(TypedDict, total=False):
    userId: str
    score: int
    nickname: str


class BattleHost(TypedDict, total=False):
    hostUserId: str
    teamTotalScore: int
    teamIdx: int
    contributors: List[BattleContributor]
    """Sorted MVP first."""


class BattleEvent(TypedDict, total=False):
    type: str
    battleId: str
    status: int
    battleDuration: int
    teams: List[Dict[str, Any]]
    # v3
    extraHostUserIds: List[str]
    layoutSubtype: str
    protoVersion: int


class BattleArmiesEvent(TypedDict, total=False):
    type: str
    battleId: str
    status: int
    matchId: str
    sessionId: str
    serverTsMs: int
    durationSec: int
    secsRemaining: int
    hosts: List[BattleHost]
    # v3
    transactionId: str
    protoVersion: int


class BattleItemCardEvent(TypedDict, total=False):
    type: str
    battleId: str
    cardType: int
    effect: str
    effectKey: str
    multiplier: int
    senderUserId: str
    senderNickname: str
    senderUniqueId: str
    senderAvatarUrl: str
    activatedAtSec: int
    durationSec: int
    endsAtSec: int
    commentTemplate: str
    iconUrl: str
    iconKey: str
    accentColor: str


class CaptionEvent(TypedDict, total=False):
    """v3: TikTok native auto-captions on the LIVE WebSocket."""

    type: str
    text: str
    isFinal: bool
    startedAtMs: int
    endsAtMs: int
    protoVersion: int


class ImDeleteEvent(TypedDict, total=False):
    """v3: chat moderation delete. Correlate via ``ChatEvent.messageUuid``."""

    type: str
    deletedMsgId: str
    protoVersion: int


class LinkMicOpponentGiftEvent(TypedDict, total=False):
    """v3: per-gift breakdown from the OPPONENT side of a PK."""

    type: str
    senderUserId: str
    opponentRoomId: str
    giftId: int
    giftPictureUrl: str
    startedAtMs: int
    endsAtMs: int
    transactionId: str
    protoVersion: int


class GoalUpdateEvent(TypedDict, total=False):
    """v3: stream goal progress (subscriber, gift, watch-time goals)."""

    type: str
    goalKey: str
    creatorUserId: str
    contributionLevel: int
    metadataJson: str
    protoVersion: int


class RoomPinEvent(TypedDict, total=False):
    """A chat got pinned by the host or a moderator."""

    type: str
    user: TikTokUser
    comment: str
    action: int
    durationSeconds: int
    pinnedAt: int
