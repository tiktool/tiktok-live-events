<div align="center">

# tiktok-live-events

**The 2026 TikTok LIVE event stream for Node.js + TypeScript.**

Read chat, gifts, viewers, follows, PK battles, AI captions, polls, karaoke, pictionary, live shopping, moderation deletes and **80+ real-time event types** from any TikTok LIVE stream in 4 lines of code.

[![npm](https://img.shields.io/npm/v/tiktok-live-events)](https://www.npmjs.com/package/tiktok-live-events)
[![downloads](https://img.shields.io/npm/dm/tiktok-live-events)](https://www.npmjs.com/package/tiktok-live-events)
[![types](https://img.shields.io/npm/types/tiktok-live-events)](https://www.npmjs.com/package/tiktok-live-events)
[![license](https://img.shields.io/npm/l/tiktok-live-events)](LICENSE)

</div>

---

## Three ways to use it

### 1. One-click (Windows)

Download [`start.bat`](start.bat), double-click. It installs the package + prompts for a username. Streams every chat, gift, like, follow in real-time to the console.

### 2. One-click (macOS / Linux)

```bash
curl -fsSL https://raw.githubusercontent.com/tiktool/tiktok-live-events/main/start.sh | bash
```

### 3. CLI

```bash
npm i -g tiktok-live-events
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

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('streamer_username');
live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
live.on('gift', e => console.log(`${e.user.uniqueId} sent ${e.giftName} x${e.repeatCount}`));
await live.connect();
```

No key. No config. Just run it.

---

## What you get

- Real-time **chat, gifts, likes, follows, viewer counts, PK battles, AI captions, gift catalog updates, moderation deletes, viewer entry-source analytics** and 50+ other live event types.
- One WebSocket. Zero protocol code. No protobuf libraries. No proxy setup. No headless browser.
- **Full TypeScript types** for every event. Your IDE autocompletes every field.
- **Auto-reconnect**, structured error handling, typed emitter.
- **Tiny.** Under 5 KB compiled, one runtime dependency (`ws`).

The protocol decode happens on the [TikTools](https://tik.tools) edge. Your code only ever sees clean JSON.

---

## How it works (free / anon / paid)

You open ONE WebSocket to `wss://api.tik.tools`. The TikTools edge owns the upstream TikTok session, decodes every frame server-side, and forwards typed JSON events back to your socket in real-time. Your machine never talks to TikTok directly - the SDK has zero protocol code, no proxy setup, no headless browser.

| Mode | API key? | What you get | When to use |
|---|---|---|---|
| **Anonymous** | No key. Just `new TikTokLive('streamer')`. | All 80+ event types, capped per-IP (a handful of connects/hour, sessions up to 10 min). | Hello-world demos, scripts that watch one stream now and then. |
| **Free key** | Free signup at [tik.tools](https://tik.tools) - no card. | Lifted per-IP caps, longer sessions, REST + WS quota. | Bots, OBS overlays, analytics that need to stay connected. |
| **Paid tiers** | Same key, upgraded tier. | More concurrent sockets, higher request quota, full agency intel layer. | Production at scale. |

When the anonymous cap is reached, the SDK emits a `rateLimited` event and stops reconnecting until you supply a key. The CLI prompts for one interactively. Everything else stays identical across tiers - the only thing that changes is the cap.

Pricing tiers and current limits live on the [pricing page](https://tik.tools/pricing) (single source of truth, geo-aware).

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
npm install tiktok-live-events
```

```bash
# yarn / pnpm / bun
yarn  add tiktok-live-events
pnpm add tiktok-live-events
bun   add tiktok-live-events
```

---

## Quick start (SDK)

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('streamer_username');

live.on('connected', () => console.log('Connected.'));
live.on('roomInfo', (info) => console.log(`Watching ${info.roomId}`));

live.on('chat', (e) => console.log(`${e.user.uniqueId}: ${e.comment}`));
live.on('gift', (e) => console.log(`${e.user.uniqueId} sent ${e.giftName} x${e.repeatCount} (${e.diamondCount} diamonds)`));
live.on('like', (e) => console.log(`${e.likeCount} likes (total: ${e.totalLikes})`));
live.on('member', (e) => console.log(`${e.user.uniqueId} joined`));

await live.connect();
```

---

## Events

Every event is dispatched by name via the typed emitter. `live.on('chat', e => ...)` is fully typed end-to-end. Each event payload extends `BaseEvent` (`type`, `timestamp`, `msgId`, optional `protoVersion`).

### Core live events

| Event | What it carries |
|---|---|
| `connected` | Socket open. |
| `disconnected` | Socket close. Includes the close code + reason. |
| `roomInfo` | One-shot post-connect: `{ roomId, wsHost, clusterRegion, connectedAt }`. |
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
| `battleArmies` | Per-host MVP breakdown ticking through the PK. `hosts[].contributors[]` sorted MVP first. **v3** adds `transactionId`. |
| `battleItemCard` | Booster card: x2 / x3 multipliers, gloves (crit), mist, thunder, extra-time, match-guide. Carries TikTok CDN overlay assets. |
| `battlePunishFinish` | Loser-side punishment screen ended. |
| `battleNotice`, `battleGameplay` | PK notice + mini-game state. |
| `linkLayer`, `linkMicOpponentGift`, `linkScreenChange`, `cohostLayoutUpdate` | Link-mic negotiation, opponent-side gifts, layout flips. |
| `competition`, `competitionContributor`, `guestShowdown` | Cross-stream competitions + guest showdowns. |

### Native captions (v3)

| Event | What it carries |
|---|---|
| `caption` | **NEW in v3.** TikTok native auto-captions ride on the LIVE WebSocket. `text`, `language` (auto-detected), `isFinal`, `startedAtMs`, `endsAtMs`. |

### Creator + room

| Event | What it carries |
|---|---|
| `goalUpdate` | Stream goal progress (subscriber goal, gift goal, watch-time goal). |
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

Every event carries an optional `extras: Record<string, ...>` map containing any payload field TikTok ships that doesn't yet have a typed name. New fields appear automatically the day TikTok introduces them - no SDK upgrade required. Use it as a forward-compat hook:

```ts
live.on('chat', e => {
  if (e.extras?.['18']) console.log('chat flag 18:', e.extras['18']);
});
```

### Catch-all

- `event` - Fires once for every decoded event (dump-to-queue pattern).
- `unknown` - Fires when TikTok ships a method not yet modelled (forward-compat hook).

---

## Recipes

### Chat logger

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('creator');
live.on('chat', e => console.log(`[${new Date().toISOString()}] ${e.user.uniqueId}: ${e.comment}`));
await live.connect();
```

### Gift leaderboard

```ts
import { TikTokLive } from 'tiktok-live-events';

const board = new Map<string, number>();
const live = new TikTokLive('creator');

live.on('gift', e => {
    if (!e.repeatEnd) return; // only count final combo
    const total = (board.get(e.user.uniqueId) || 0) + e.diamondCount * e.repeatCount;
    board.set(e.user.uniqueId, total);
});

setInterval(() => {
    const top = [...board.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.clear();
    top.forEach(([user, diamonds], i) => console.log(`${i + 1}. ${user} - ${diamonds} diamonds`));
}, 5_000);

await live.connect();
```

### PK MVP tracker

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('creator');

live.on('battleArmies', (e) => {
    for (const host of e.hosts ?? []) {
        const mvp = host.contributors[0];
        if (mvp) console.log(`Host ${host.hostUserId} MVP: ${mvp.nickname} (${mvp.score})`);
    }
});

live.on('battleItemCard', (e) => {
    if (e.multiplier > 0) console.log(`x${e.multiplier} booster from @${e.senderUniqueId}`);
});

await live.connect();
```

### TikTok native captions on the stream

```ts
import { TikTokLive } from 'tiktok-live-events';
import { writeFileSync } from 'fs';

const live = new TikTokLive('creator');
let transcript = '';

live.on('caption', (e) => {
    if (e.isFinal) {
        transcript += e.text + '\n';
        writeFileSync('transcript.txt', transcript);
    }
});

await live.connect();
```

### Creator viewer-acquisition funnel

```ts
import { TikTokLive } from 'tiktok-live-events';

const sources = new Map<string, number>();
const live = new TikTokLive('creator');

live.on('member', (e) => {
    if (!e.entrySource) return;
    sources.set(e.entrySource, (sources.get(e.entrySource) || 0) + 1);
});

setInterval(() => {
    console.log('Top viewer sources:', [...sources.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5));
}, 10_000);

await live.connect();
```

### Moderation delete correlator

```ts
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive('creator');
const recent = new Map<string, { user: string; comment: string }>();

live.on('chat', e => { if (e.messageUuid) recent.set(e.messageUuid, { user: e.user.uniqueId, comment: e.comment }); });
live.on('imDelete', e => {
    const orig = recent.get(e.deletedMsgId);
    if (orig) console.log(`DELETED: ${orig.user}: ${orig.comment}`);
});

await live.connect();
```

More ready-to-run recipes in [`examples/`](examples/).

---

## TypeScript

Every event is fully typed. Use the exported interfaces directly:

```ts
import { TikTokLive, ChatEvent, GiftEvent, BattleArmiesEvent } from 'tiktok-live-events';

const live = new TikTokLive('creator');

live.on('chat', (e: ChatEvent) => {
    e.user.uniqueId;  // string
    e.comment;        // string
    e.language;       // string | undefined  (v3)
    e.messageUuid;    // string | undefined  (v3)
});

live.on('gift', (e: GiftEvent) => {
    e.giftName;       // string
    e.diamondCount;   // number
    e.transactionId;  // string | undefined  (v3 dedup key)
});

live.on('battleArmies', (e: BattleArmiesEvent) => {
    e.hosts?.forEach(h => {
        h.contributors[0]; // MVP, sorted highest first
    });
});
```

---

## API reference

### `new TikTokLive(uniqueId, options?)`

Construct a client. `uniqueId` is the TikTok `@username` (with or without `@`).

```ts
new TikTokLive('streamer');
new TikTokLive('streamer', { autoReconnect: true, maxReconnectAttempts: 5, debug: false });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `autoReconnect` | `boolean` | `true` | Reconnect with exponential backoff if the socket drops. |
| `maxReconnectAttempts` | `number` | `5` | Stop reconnecting after N attempts. |
| `debug` | `boolean` | `false` | Verbose stdout logging. |

### `live.connect(): Promise<void>`

Open the socket. Resolves on first open, rejects if the initial handshake fails.

### `live.disconnect(): void`

Close the socket. Auto-reconnect will not fire.

### `live.destroy(): void`

Tear down the client (subsequent `connect()` calls throw).

### `live.isConnected(): boolean`

Whether the socket is currently open.

### `live.on(event, handler)`

Strongly-typed event subscription. See the [Events](#events) table for every emitted name.

---

## Compatibility

- **Node.js >= 18** (uses native `fetch` + `WebSocket` upgrade dependency `ws`).
- Works in **Bun**, **Deno** (via npm:), serverless (Vercel, Netlify, Cloudflare Workers via the WebSocket polyfill).
- ESM + CommonJS dual published.

---

## Powered by

This package connects to the [TikTools](https://tik.tools) edge. Schema, decoding, proxy rotation, signing, and protocol patches are handled server-side - your `npm install` never needs to bump when TikTok ships a wire change.

---

## License

MIT

> This is an independent third-party project. Not affiliated with, endorsed by, or in any way officially connected to TikTok or ByteDance Ltd. "TikTok" is a trademark of ByteDance Ltd; the name appears here for search discoverability.
