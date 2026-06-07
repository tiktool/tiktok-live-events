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

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
