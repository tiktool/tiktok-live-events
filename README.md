<p align="center">
  <a href="https://discord.com/oauth2/authorize?client_id=1482386543233597470">
    <img src="https://img.shields.io/badge/Add%20TikTool%20Bot%20to%20Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Add TikTool Bot to Discord" height="46">
  </a>
</p>

Agency rank feeds in Discord: gaming ranks, creator ranks and 99+ movers across all 30 regions, copy-paste usernames for backstage. /ranks to start (Global Agency).

<div align="center">

# tiktok-live-events

**The 2026 TikTok LIVE event stream. Node.js + Python.**

Read chat, gifts, viewers, follows, PK battles, AI captions, polls, karaoke, pictionary, live shopping, moderation deletes and **80+ real-time event types** from any TikTok LIVE stream.

</div>

---

## SDKs

- **Node.js + TypeScript** → [`node/`](node/) ([npm: `tiktok-live-events`](https://www.npmjs.com/package/tiktok-live-events))
- **Python** → [`python/`](python/) ([PyPI: `tiktok-live-events`](https://pypi.org/project/tiktok-live-events/))

Both SDKs use the same backend. Pick the language that matches your stack.

---

## What you get

- Real-time chat, gifts, likes, follows, viewer counts, PK battles, AI captions, gift catalog updates, moderation deletes, viewer entry-source analytics, and 50+ other live event types.
- One WebSocket. Zero protocol code. No protobuf libraries. No proxy setup. No headless browser.
- Full type annotations - TypeScript interfaces in Node, TypedDict in Python.
- Auto-reconnect, structured error handling.

---

## Three ways to use it

### 1. One-click (Windows)

Download [`start.bat`](start.bat), double-click. Installs the package + prompts for a username. Streams every chat, gift, like, follow to the console.

### 2. One-click (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/tiktool/tiktok-live-events/main/start.sh | bash
```

### 3. CLI

```bash
npm i -g tiktok-live-events     # or:  pip install tiktok-live-events
tiktok-live-events streamer
```

```text
[ready]   connected to @streamer (room 7648...)
[chat]    fan123: love this!
[gift]    bigtipper -> Rose x99
[like]    casual_viewer (15)
```

### 4. Programmatic

#### Node.js

```bash
npm install tiktok-live-events
```

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('streamer');
live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
await live.connect();
```

#### Python

```bash
pip install tiktok-live-events
```

```python
import asyncio
from tiktok_live_events import TikTokLive

live = TikTokLive('streamer')

@live.on('chat')
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")

asyncio.run(live.run())
```

No key. No config. Just run it.

---

## Full reference

Each SDK ships with a comprehensive README covering all 54 event types, code recipes, API reference, and TypeScript / Python typing:

- **[node/README.md](node/README.md)** - Node.js SDK
- **[python/README.md](python/README.md)** - Python SDK

---

## Pricing (USD)
| Tier | Weekly | Monthly |
|------|--------|---------|
| Sandbox / Free | $0 | $0 |
| Basic | $7 | $19 |
| Pro | $15 | $49 |
| Ultra | $45 | $149 |
| Global Agency | $119 | $399 |

Full pricing + checkout: https://tik.tools/pricing

## Tiers
Tier ladder (each includes everything below it): Sandbox -> Basic -> Pro -> Ultra -> Global Agency. Sandbox is free with reduced rate limits + masked identifiers on intelligence endpoints; paid tiers raise limits and unmask data. Outgoing webhooks need Basic+. The agency intelligence endpoints (gaming ranks, movers, eligible-creator finder, gifter intel) need Global Agency.

## Endpoints and required tier
| Endpoint | Min tier |
|---|---|
| POST /webcast/sign_url | Sandbox |
| POST /webcast/sign_websocket | Sandbox |
| GET /webcast/ws_credentials | Sandbox |
| GET /webcast/fetch | Sandbox |
| GET /webcast/room_id | Sandbox |
| GET /webcast/room_info | Sandbox |
| GET /webcast/room_video | Sandbox |
| GET /webcast/room_cover | Sandbox |
| GET /webcast/check_alive | Sandbox |
| POST /webcast/bulk_live_check | Sandbox |
| GET /webcast/live_status | Sandbox |
| GET /webcast/live-counts | Sandbox |
| POST /webcast/resolve_user_ids | Sandbox |
| GET /webcast/rankings | Sandbox |
| GET /webcast/leaderboard | Sandbox |
| GET /webcast/leaderboard/league | Sandbox |
| GET /webcast/leaderboard/leagues | Sandbox |
| GET /webcast/gift_info | Sandbox |
| GET /webcast/gift_gallery | Sandbox |
| GET /webcast/hashtag_list | Sandbox |
| GET /webcast/user_earnings | Sandbox |
| GET /webcast/live_analytics/video_list | Sandbox |
| GET /webcast/live_analytics/video_detail | Sandbox |
| GET /webcast/live_analytics/user_interactions | Sandbox |
| GET /webcast/rate_limits | Sandbox |
| POST /authentication/jwt | Sandbox |
| GET /api/live/connect | Sandbox |
| POST /chat-send | Basic |
| GET/POST /api/webhooks | Basic |
| POST /api/webhooks/{id}/test | Basic |
| GET /ws/sweep | Basic |
| GET /webcast/feed | Pro |
| POST /webcast/ranklist/regional | Pro |
| GET /webcast/user_profile | Pro |
| GET /api/leaderboards/country/:slug | Pro |
| GET /webcast/gifts_by_country | Ultra |
| GET /api/leaderboards/leagues/:region | Ultra |
| GET /api/leaderboards/league/:region/:classType | Ultra |
| GET /webcast/ranklist/gaming | Global Agency |
| GET /webcast/ranklist/gaming_movers | Global Agency |
| GET /webcast/ranklist/region_movers | Global Agency |
| GET /webcast/eligible_creators | Global Agency |
| GET /api/gifters/top | Global Agency |
| GET /api/gifters/leaderboard | Global Agency |
| GET /api/gifters/profile | Global Agency |

Full docs: https://tik.tools/docs

## What you get
**Creators**: real-time live events (gifts, chat, viewers), your own live status + room info, earnings + analytics, signed CDN/stream URLs that do not expire.
**Developers**: drop-in signing (works as a tiktok-live-connector backend - point the sign base at api.tik.tools), one-WebSocket fan-out (your IP never touches TikTok), bulk live checks, leaderboards, webhooks (HMAC-signed live.start/live.end and more), SDKs across languages.
**Agencies (Global Agency)**: TikTok LIVE gaming ranks + creator ranks + 99+ movers across all 30 regions, eligible-creator recruiting finder, gifter intelligence (top gifters, profiles, leaderboards), and the Discord bot that posts copy-paste username batches for backstage.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
