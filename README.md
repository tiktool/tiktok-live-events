<div align="center">

# tiktok-live-events

**The 2026 TikTok LIVE event stream. Node.js + Python.**

Read chat, gifts, viewers, follows, PK battles, native captions, moderation deletes and **50+ real-time event types** from any TikTok LIVE stream.

</div>

---

## SDKs

- **Node.js + TypeScript** → [`node/`](node/) ([npm: `tiktok-live-events`](https://www.npmjs.com/package/tiktok-live-events))
- **Python** → [`python/`](python/) ([PyPI: `tiktok-live-events`](https://pypi.org/project/tiktok-live-events/))

Each SDK uses the same managed edge (`wss://api.tik.tools`) so events look identical regardless of language. Pick the language that matches your stack.

---

## What you get

- Real-time chat, gifts, likes, follows, viewer counts, PK battles, AI captions, gift catalog updates, moderation deletes, viewer entry-source analytics, and 50+ other live event types.
- One WebSocket. Zero protocol code. No protobuf libraries. No proxy setup. No headless browser.
- Full type annotations - TypeScript interfaces in Node, TypedDict in Python.
- Auto-reconnect, structured error handling.

The protocol decode happens on the [TikTools](https://tik.tools) edge. Your code only ever sees clean JSON.

---

## Quick start

### Node.js

```bash
npm install tiktok-live-events
```

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('streamer', { apiKey: process.env.TIKTOOL_API_KEY });
live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
await live.connect();
```

### Python

```bash
pip install tiktok-live-events
```

```python
import asyncio
import os
from tiktok_live_events import TikTokLive

live = TikTokLive('streamer', api_key=os.environ['TIKTOOL_API_KEY'])

@live.on('chat')
def on_chat(e):
    print(f"{e['user']['uniqueId']}: {e['comment']}")

asyncio.run(live.run())
```

Grab a free API key at <https://tik.tools> (no credit card, ~10 seconds).

---

## Full reference

Each SDK ships with a comprehensive README covering all 54 event types, code recipes, API reference, and TypeScript / Python typing:

- **[node/README.md](node/README.md)** - Node.js SDK
- **[python/README.md](python/README.md)** - Python SDK

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
