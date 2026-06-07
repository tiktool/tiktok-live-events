<div align="center">

# tiktok-live-events

**The 2026 TikTok LIVE event stream for Python.**

Read chat, gifts, viewers, follows, PK battles, AI captions, polls, karaoke, pictionary, live shopping, moderation deletes and **80+ real-time event types** from any TikTok LIVE stream in 4 lines of code.

[![pypi](https://img.shields.io/pypi/v/tiktok-live-events)](https://pypi.org/project/tiktok-live-events/)
[![downloads](https://img.shields.io/pypi/dm/tiktok-live-events)](https://pypi.org/project/tiktok-live-events/)
[![python](https://img.shields.io/pypi/pyversions/tiktok-live-events)](https://pypi.org/project/tiktok-live-events/)
[![license](https://img.shields.io/pypi/l/tiktok-live-events)](LICENSE)

</div>

---

## Three ways to use it

### 1. One-click (Windows)

Download [`start.bat`](start.bat), double-click. It installs the package + prompts for a username. Streams every chat, gift, like, follow in real-time to the console.

### 2. One-click (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/tiktool/tiktok-live-events/main/python/start.sh | bash
```

### 3. CLI

```bash
pip install tiktok-live-events
tiktok-live-events streamer_username
```

```text
[ready]   connected to @streamer (room 7648...)
[chat]    fan123: love this!
[gift]    bigtipper -> Rose x99
[like]    casual_viewer (15)
[follow]  new_follower
```

### 4. Programmatic

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive("streamer_username")

@live.on("chat")
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")

asyncio.run(live.run())
```

No key. No config. Just run it.

---

## What you get

- Real-time **chat, gifts, likes, follows, viewer counts, PK battles, AI captions, gift catalog updates, moderation deletes, viewer entry-source analytics** and 50+ other live event types.
- One WebSocket. Zero protocol code. No protobuf libraries. No proxy setup. No headless browser.
- **Full TypedDict typing** for every event - Pyright + mypy autocomplete every field.
- **Async first** (`asyncio`). Auto-reconnect. Sync + async handlers both supported.
- **Tiny.** One runtime dependency (`websockets`).

The protocol decode happens on the [TikTools](https://tik.tools) edge. Your code only ever sees clean JSON.

---

## How it works (free / sandbox / paid)

The SDK has two connect strategies and picks one automatically based on your tier.

### Direct mode (default for free + sandbox)

Your machine opens the WebSocket to TikTok **from your own IP**. Our edge only:

1. Signs the URL + mints you a fresh session cookie.
2. Receives raw frames over a side channel and returns parsed JSON.

You never run a protobuf library, you never set up a proxy, you never run a headless browser. But TikTok sees your real residential IP - geo is correct, your fingerprint is organic, and you don't share our session pool. Captcha + cluster-ban risk lands on your IP.

### Managed mode (default for paid tiers)

You open ONE WebSocket to `wss://api.tik.tools`. Our edge runs the upstream TikTok session via our residential proxy pool. Your IP never touches TikTok. Fan-out economics: many customers watching the same creator share one upstream connection.

### Picking mode

| Tier | Default mode | Override |
|---|---|---|
| **Anonymous** (no key) | `direct` | `mode='managed'` |
| **Sandbox** (free signup) | `direct` | `mode='managed'` |
| **Basic+** (paid) | `managed` | `mode='direct'` |

The default is `mode='auto'` - the SDK asks our edge which mode fits your tier and picks the right one. Force a mode explicitly when you want to override.

```python
live = TikTokLive('streamer', api_key='...', mode='direct')   # force direct
live = TikTokLive('streamer', api_key='...', mode='managed')  # force managed
live = TikTokLive('streamer')                                 # auto (default)
```

Pricing tiers + current per-mode caps live on the [pricing page](https://tik.tools/pricing).

---

## CLI reference

```text
tiktok-live-events <username> [options]

Options:
  -f, --filter <list>     Comma-separated event types (default: all)
                          e.g. chat,gift,follow,viewer,like
      --json              Emit each event as one JSON line (machine-readable)
  -h, --help              Show this help

Examples:
  tiktok-live-events streamer
  tiktok-live-events streamer --filter chat,gift
  tiktok-live-events streamer --json > events.ndjson
```

---

## Install

```bash
pip install tiktok-live-events
```

```bash
# uv / poetry / pipx
uv add tiktok-live-events
poetry add tiktok-live-events
pipx install tiktok-live-events
```

---

## Quick start (SDK)

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive("streamer_username")

@live.on("connected")
def on_connected(_):
    print("Connected.")

@live.on("chat")
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")

@live.on("gift")
def on_gift(e):
    print(f"{e['user']['uniqueId']} sent {e['giftName']} x{e['repeatCount']} ({e['diamondCount']} diamonds)")

@live.on("like")
def on_like(e):
    print(f"{e['likeCount']} likes (total: {e['totalLikes']})")

asyncio.run(live.run())
```

---

## Events

Every event is dispatched by name. Handlers receive a dict matching the event's TypedDict (`ChatEvent`, `GiftEvent`, `BattleArmiesEvent`, ...). Each payload extends `BaseEvent` (`type`, `timestamp`, `msgId`, optional `protoVersion`).

### Core live events

| Event | What it carries |
|---|---|
| `connected` | Socket open. |
| `disconnected` | Socket close. |
| `roomInfo` | One-shot post-connect: `{roomId, wsHost, clusterRegion, connectedAt}`. |
| `chat` | `user`, `comment`, `emotes`, optional `starred`. **v3** adds `language` (auto-detected), `messageUuid`, `replyToUser` (~8% of chats are replies). |
| `gift` | `giftId`, `giftName`, `diamondCount`, `repeatCount`, `repeatEnd`, `giftType`. **v3** adds `transactionId`, `senderUserId`, `relationship` (`joinDayNumber`). |
| `like` | `likeCount` (this batch), `totalLikes` (room cumulative). |
| `member` | Viewer joined. **v3** adds `entrySource` (`"homepage_hot-live_cell"`, `"follow-tab"`, ...), `entryAction` (`"draw"`/`"click"`), `entryType` (`"rec"`). |
| `social` | Follow / share. |
| `roomUserSeq` | Periodic viewer count tick. |
| `subscribe` | A viewer subscribed. |

### PK / battle events

| Event | What it carries |
|---|---|
| `battle` | PK lifecycle. `status` (1=ACTIVE, 2=STARTING, 3=ENDED, 4=PREPARING), `battleDuration`, `teams`. **v3** adds `extraHostUserIds`, `layoutSubtype`. |
| `battleArmies` | Per-host MVP breakdown. `hosts[].contributors[]` sorted MVP first. **v3** adds `transactionId`. |
| `battleItemCard` | Booster card: x2 / x3 multipliers, gloves (crit), mist, thunder, extra-time, match-guide. Carries TikTok CDN overlay assets. |
| `battlePunishFinish` | Loser-side punishment screen ended. |
| `battleNotice`, `battleGameplay` | PK notice + mini-game state. |
| `linkLayer`, `linkMicOpponentGift`, `linkScreenChange`, `cohostLayoutUpdate` | Link-mic negotiation, opponent-side gifts, layout flips. |
| `competition`, `competitionContributor`, `guestShowdown` | Cross-stream competitions + guest showdowns. |

### Native captions (v3)

| Event | What it carries |
|---|---|
| `caption` | **NEW in v3.** TikTok native auto-captions on the LIVE WebSocket. `text`, `language` (auto-detected), `isFinal`, `startedAtMs`, `endsAtMs`. |

### Creator + room

| Event | What it carries |
|---|---|
| `goalUpdate` | Stream goal progress (subscriber, gift, watch-time goals). |
| `commentTray`, `roomPin`, `roomSticker`, `inRoomBanner`, `bottomMessage` | Room UI events. |
| `hostBoard`, `rankText`, `rankUpdate`, `hourlyRank` | Leaderboard / rank events. |
| `privilegeAdvance`, `accessRecall`, `roomVerify` | Viewer privilege + content-classification events. |
| `anchorToolModification`, `streamStatus`, `shareRevenueNotice` | Creator-side metadata flips. |
| `capsule`, `hotRoom`, `linkMicAnchorGuide` | TikTok host nudges. |

### Moderation / safety

| Event | What it carries |
|---|---|
| `imDelete` | Chat moderation delete. Correlate via `chat.messageUuid` (v3). |
| `unauthorizedMember` | Non-logged-in viewer hit a gated feature. |
| `barrage` | Raw barrage feed. |
| `superFan`, `superFanJoin`, `superFanBox` | Super-fan lifecycle. |
| `emoteChat` | Inline emote message. |

### Gift catalog + ecommerce

| Event | What it carries |
|---|---|
| `giftPanelUpdate` | Real-time gift catalog change. |
| `giftCollectionUpdate` | Host curated gift set changed. **v3** |
| `giftDynamicRestriction`, `giftGallery`, `giftUnlock`, `viewerPicksUpdate` | Gift availability flips, host gift wall, gated-gift reveals, viewer-pick highlights. |
| `oecLiveShopping`, `oecLiveManager`, `oecLiveBillboard`, `ecShortItemRefresh` | OEC live-shopping events. |

### Engagement + AI

| Event | What it carries |
|---|---|
| `aiSummary` | TikTok AI summary of the room (entry-time recap, multi-language). |
| `poll`, `shortTouch` | In-stream poll lifecycle. |
| `question`, `questionSelected`, `questionSlideDown` | Q&A round events. |
| `pictionaryStart`, `pictionaryUpdate`, `pictionaryEnd`, `pictionaryExit` | Drawing-game rounds. **v3** |
| `karaokeReq` | Viewer queued / requested a track on the host's karaoke widget. **v3** |
| `subPin` | Comment pinned by a paid subscriber via the sub-only pin slot. **v3** |
| `toast`, `gapHighlightPushGuide` | Generic toast popups and first-render UX hints. **v3** |
| `gameAutoPostNotice` | Notice posted automatically by an in-room mini-game. **v3** |
| `cohostSettingsUpdate` | Cohost settings updated (slot count, layout, permissions). **v3** |
| `fansEvent`, `fanTicket` | Fan-club events. |
| `envelope`, `envelopePortal` | Red-envelope drops + multi-room portal chain. |
| `gameMoment`, `gameServerFeature` | TikTok Gaming live integration. |
| `groupLiveMemberNotify` | Group-live member join / leave. |
| `perception` | Perception event (mute cancel, hint signal). |
| `control`, `room`, `liveIntro` | Stream control + room metadata. |

### Universal field: `extras`

Every event carries an optional `extras: dict[str, ...]` map containing any payload field TikTok ships that doesn't yet have a typed name. New fields appear automatically the day TikTok introduces them - no SDK upgrade required. Use it as a forward-compat hook:

```python
@live.on('chat')
def on_chat(e):
    if e.get('extras', {}).get('18'):
        print('chat flag 18:', e['extras']['18'])
```

### Catch-all

- `event` - Fires once for every decoded event (dump-to-queue pattern).
- `unknown` - Fires when TikTok ships a method not yet modelled (forward-compat hook).

---

## Recipes

### Chat logger

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive("creator")

@live.on("chat")
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")

asyncio.run(live.run())
```

### Gift leaderboard

```python
import asyncio
from collections import defaultdict
from tiktok_live_events import TikTokLive

live = TikTokLive("creator")
board = defaultdict(int)

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
```

### PK MVP tracker

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive("creator")

@live.on("battle")
def on_battle(e):
    print(f"[battle] status={e['status']} id={e['battleId']} duration={e['battleDuration']}s")

@live.on("battleArmies")
def on_armies(e):
    print(f"[armies] remaining={e.get('secsRemaining')}s")
    for host in e.get("hosts", []):
        print(f"  Host {host['hostUserId']} total={host['teamTotalScore']}")
        mvp = host.get("contributors", [None])[0]
        if mvp:
            print(f"    MVP {mvp['nickname']} {mvp['score']} diamonds")

@live.on("battleItemCard")
def on_card(e):
    if e.get("multiplier", 0) > 0:
        print(f"[card] x{e['multiplier']} booster from {e['senderNickname']}")
    else:
        print(f"[card] effect={e['effect']} from {e['senderNickname']} duration={e['durationSec']}s")

asyncio.run(live.run())
```

### TikTok native captions to file

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive("creator")

@live.on("caption")
def on_caption(e):
    if e.get("isFinal"):
        with open("transcript.txt", "a", encoding="utf-8") as f:
            f.write(e["text"] + "\n")

asyncio.run(live.run())
```

### Discord webhook relay

```python
import asyncio, json
import urllib.request
from tiktok_live_events import TikTokLive

WEBHOOK = "https://discord.com/api/webhooks/..."
live = TikTokLive("creator")

def send(content):
    body = json.dumps({"content": content}).encode("utf-8")
    req = urllib.request.Request(WEBHOOK, data=body, headers={"content-type": "application/json"})
    try: urllib.request.urlopen(req, timeout=4).read()
    except Exception: pass

@live.on("chat")
def on_chat(e):
    send(f"**{e['user']['uniqueId']}**: {e['comment']}")

@live.on("gift")
def on_gift(e):
    if e.get("repeatEnd"):
        send(f":gift: {e['user']['uniqueId']} sent {e['giftName']} x{e['repeatCount']} ({e['diamondCount']} diamonds)")

asyncio.run(live.run())
```

More ready-to-run recipes in [`examples/`](examples/).

---

## API reference

### `TikTokLive(unique_id, *, auto_reconnect=True, max_reconnect_attempts=5, debug=False)`

Construct a client. `unique_id` is the TikTok `@username` (with or without `@`).

| Param | Type | Default | Description |
|---|---|---|---|
| `unique_id` | `str` | - | TikTok username. |
| `auto_reconnect` | `bool` | `True` | Reconnect with exponential backoff if the socket drops. |
| `max_reconnect_attempts` | `int` | `5` | Stop after N reconnect attempts. |
| `debug` | `bool` | `False` | Verbose logging via the `tiktok_live_events` logger. |

### `live.on(event)`

Decorator. Register a sync or async handler.

```python
@live.on("chat")
def handler(e): ...

@live.on("gift")
async def handler(e): ...
```

Pass `"event"` to receive every decoded event in a single handler.

### `await live.run()`

Connect and pump events until `stop()` is called or the reconnect budget is exhausted.

### `live.stop()`

Signal `run()` to exit on the next iteration.

### `live.connected`

`bool` - whether the socket is currently open.

---

## Compatibility

- **Python >= 3.9** (uses `asyncio`, `websockets`, type hints).
- Works on Windows, macOS, Linux, Docker, serverless.
- Tested against `asyncio` + `uvloop`.

---

## Powered by

This package connects to the [TikTools](https://tik.tools) edge. Schema, decoding, proxy rotation, signing, and protocol patches are handled server-side - your `pip install` never needs to bump when TikTok ships a wire change.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
