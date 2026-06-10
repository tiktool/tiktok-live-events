/**
 * tiktok-live-events
 *
 * Read TikTok LIVE events in 4 lines of Node.js.
 *
 * @example
 * ```ts
 * import { TikTokLive } from 'tiktok-live-events';
 * const live = new TikTokLive('username');
 * live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
 * await live.connect();
 * ```
 */
import { EventEmitter } from 'events';
import WebSocket from 'ws';

const ENDPOINT = 'wss://api.tik.tools';
const HTTPS_ENDPOINT = 'https://api.tik.tools';

// ── Public event payload shapes ────────────────────────────────────

export interface TikTokUser {
    userId: string;
    uniqueId: string;
    nickname: string;
    profilePictureUrl?: string;
    followRole?: number;
    isSubscriber?: boolean;
    /** TikTok donator level 1-50. Present when the user has ever sent a gift. */
    payGrade?: number;
}

export interface BaseEvent {
    type: string;
    timestamp: number;
    msgId: string;
    /** Schema revision the event was decoded against (1, 2, or 3). */
    protoVersion?: 1 | 2 | 3;
}

export interface RoomInfo {
    roomId: string;
    wsHost?: string;
    clusterRegion?: string;
    connectedAt: string;
}

export interface ChatEvent extends BaseEvent {
    type: 'chat';
    user: TikTokUser;
    comment: string;
    emotes?: Array<{ emoteId: string; imageUrl: string; placeInComment: number }>;
    starred?: { claps: number; score: number };
    /** v3: ISO 639-1 language auto-detected for this comment. */
    language?: string;
    /** v3: stable per-message id, used by `imDelete` moderation events. */
    messageUuid?: string;
}

export interface GiftEvent extends BaseEvent {
    type: 'gift';
    user: TikTokUser;
    giftId: number;
    giftName: string;
    diamondCount: number;
    repeatCount: number;
    repeatEnd: boolean;
    giftType?: number;
    groupId?: string;
    /** v3: stable per-gift UUID. Use as dedup key across upstream retries. */
    transactionId?: string;
    /** v3: explicit sender id, mirrors `user.id`. */
    senderUserId?: string;
    /** v3: relationship metadata between gifter and creator when TikTok attaches it. */
    relationship?: { joinDayNumber?: number; fromUser?: string; toUser?: string };
}

export interface LikeEvent extends BaseEvent {
    type: 'like';
    user: TikTokUser;
    likeCount: number;
    totalLikes: number;
}

export interface MemberEvent extends BaseEvent {
    type: 'member';
    user: TikTokUser;
    action?: number;
    /** v3: viewer entry source - "homepage_hot-live_cell", "follow-tab", ... */
    entrySource?: string;
    /** v3: "draw" = algorithmic, "click" = explicit, "other" = unknown. */
    entryAction?: string;
    /** v3: "rec" = TikTok recommended this stream to the viewer. */
    entryType?: string;
    actionCode?: number;
}

export interface SocialEvent extends BaseEvent {
    type: 'social';
    user: TikTokUser;
    action: 'follow' | 'share' | string;
}

export interface RoomUserSeqEvent extends BaseEvent {
    type: 'roomUserSeq';
    viewerCount: number;
    totalViewers: number;
}

export interface BattleContributor { userId: string; score: number; nickname: string }
export interface BattleHost {
    hostUserId: string;
    teamTotalScore: number;
    teamIdx: number;
    /** Sorted MVP first. */
    contributors: BattleContributor[];
}
export interface BattleEvent extends BaseEvent {
    type: 'battle';
    battleId: string;
    status: number;
    battleDuration: number;
    teams: Array<Record<string, unknown>>;
}
export interface BattleArmiesEvent extends BaseEvent {
    type: 'battleArmies';
    battleId: string;
    status: number;
    matchId?: string;
    sessionId?: string;
    serverTsMs?: number;
    durationSec?: number;
    secsRemaining?: number;
    hosts?: BattleHost[];
    /** v3: per-frame transaction id for dedup. */
    transactionId?: string;
}
export interface BattleItemCardEvent extends BaseEvent {
    type: 'battleItemCard';
    battleId: string;
    cardType: number;
    effect: string;
    effectKey?: string;
    multiplier: number;
    senderUserId: string;
    senderNickname: string;
    senderUniqueId?: string;
    senderAvatarUrl?: string;
    activatedAtSec: number;
    durationSec: number;
    endsAtSec: number;
    commentTemplate?: string;
    iconUrl?: string;
    iconKey?: string;
    accentColor?: string;
}

export interface CaptionEvent extends BaseEvent {
    type: 'caption';
    text: string;
    isFinal: boolean;
    startedAtMs: number;
    endsAtMs: number;
}

export interface ImDeleteEvent extends BaseEvent {
    type: 'imDelete';
    deletedMsgId: string;
}

export interface LinkMicOpponentGiftEvent extends BaseEvent {
    type: 'linkMicOpponentGift';
    senderUserId: string;
    opponentRoomId: string;
    giftId: number;
    giftPictureUrl: string;
    startedAtMs: number;
    endsAtMs: number;
    transactionId: string;
}

export interface GoalUpdateEvent extends BaseEvent {
    type: 'goalUpdate';
    goalKey: string;
    creatorUserId: string;
    contributionLevel: number;
    metadataJson: string;
}

export interface RoomPinEvent extends BaseEvent {
    type: 'roomPin';
    user: TikTokUser;
    comment: string;
    action: number;
    durationSeconds: number;
}

export interface UnknownEvent extends BaseEvent {
    type: 'unknown';
    method: string;
    [k: string]: unknown;
}

/** Union of every known event payload type. */
export type LiveEvent =
    | ChatEvent | GiftEvent | LikeEvent | MemberEvent | SocialEvent
    | RoomUserSeqEvent | BattleEvent | BattleArmiesEvent | BattleItemCardEvent
    | CaptionEvent | ImDeleteEvent | LinkMicOpponentGiftEvent | GoalUpdateEvent
    | RoomPinEvent | UnknownEvent;

/**
 * Fired when the edge issues a soft rate-limit nudge BEFORE closing the
 * socket. Inspect `type` (`anon_limit` / `demo_limit` / `session_limit`),
 * `message`, and `upgrade_url`. If you don't subscribe, the SDK prints
 * the message to stderr.
 */
export interface RateLimitedNudge {
    type: 'anon_limit' | 'demo_limit' | 'session_limit';
    message: string;
    upgrade_url?: string;
    sessionMaxMs?: number;
}

/** Strongly-typed event map for `client.on(...)` autocompletion. */
export interface TikTokLiveEvents {
    connected: () => void;
    disconnected: (code: number, reason: string) => void;
    error: (err: Error) => void;
    rateLimited: (nudge: RateLimitedNudge) => void;
    roomInfo: (info: RoomInfo) => void;
    chat: (e: ChatEvent) => void;
    gift: (e: GiftEvent) => void;
    like: (e: LikeEvent) => void;
    member: (e: MemberEvent) => void;
    social: (e: SocialEvent) => void;
    roomUserSeq: (e: RoomUserSeqEvent) => void;
    /** Alias of `roomUserSeq` - same payload, friendlier name. */
    viewer_count: (e: RoomUserSeqEvent) => void;
    battle: (e: BattleEvent) => void;
    battleArmies: (e: BattleArmiesEvent) => void;
    battleItemCard: (e: BattleItemCardEvent) => void;
    caption: (e: CaptionEvent) => void;
    imDelete: (e: ImDeleteEvent) => void;
    linkMicOpponentGift: (e: LinkMicOpponentGiftEvent) => void;
    goalUpdate: (e: GoalUpdateEvent) => void;
    roomPin: (e: RoomPinEvent) => void;
    event: (e: LiveEvent) => void;
    unknown: (e: UnknownEvent) => void;
}

export interface TikTokLiveOptions {
    /** Optional API key. Anonymous mode works out of the box. */
    apiKey?: string;
    /** Auto-reconnect when the socket drops (default: true). */
    autoReconnect?: boolean;
    /** Cap reconnect attempts (default: 5). */
    maxReconnectAttempts?: number;
    /** Verbose stdout logging (default: false). */
    debug?: boolean;
    /**
     * Connection mode.
     *
     * - `auto` (default) - SDK asks the edge which mode to use based on tier:
     *   anon / demo / sandbox tiers connect to TikTok from your own IP (the
     *   edge only signs + decodes - it does NOT relay your traffic). Paid tiers
     *   stay on the managed path for fan-out economics.
     * - `managed` - explicitly use the edge as a relay. One WebSocket. The edge
     *   talks to TikTok via its own upstream session. Your IP never touches
     *   TikTok. Paid-tier default.
     * - `direct` - explicitly open two WebSockets: TikTok (your IP) + edge
     *   decode. Free-tier default. Bypasses the relay entirely.
     */
    mode?: 'auto' | 'managed' | 'direct';
}

/**
 * TikTok LIVE event stream. Pass a username, get every chat, gift, like,
 * follow, viewer count update, PK battle frame, native caption and 50+
 * other event types in real-time.
 *
 * @example
 * ```ts
 * import { TikTokLive } from 'tiktok-live-events';
 *
 * const live = new TikTokLive('streamer');
 * live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));
 * live.on('gift', e => console.log(`${e.user.uniqueId} sent ${e.giftName} x${e.repeatCount}`));
 * await live.connect();
 * ```
 */
export class TikTokLive extends EventEmitter {
    private ws: WebSocket | null = null;
    private intentionalClose = false;
    private rateLimitTerminal = false;
    private reconnectAttempts = 0;
    private _connected = false;
    private _destroyed = false;

    private readonly uniqueId: string;
    private readonly apiKey: string;
    private readonly autoReconnect: boolean;
    private readonly maxReconnectAttempts: number;
    private readonly debug: boolean;
    private readonly mode: 'auto' | 'managed' | 'direct';
    private directState: { ttws: WebSocket | null; decws: WebSocket | null; heartbeat: NodeJS.Timeout | null } | null = null;

    /**
     * @param uniqueId TikTok @username (with or without the leading `@`).
     * @param options optional behaviour overrides.
     */
    constructor(uniqueId: string, options: TikTokLiveOptions = {}) {
        super();
        this.setMaxListeners(20);
        this.uniqueId = (uniqueId || '').replace(/^@/, '').trim();
        if (!this.uniqueId) throw new Error('uniqueId is required.');
        this.apiKey = options.apiKey || process.env.TIKTOOL_API_KEY || '';
        this.autoReconnect = options.autoReconnect ?? true;
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
        this.debug = options.debug ?? false;
        this.mode = options.mode || 'auto';
    }

    /** True between `open` and `close`. */
    isConnected(): boolean { return this._connected; }

    /**
     * Open the WebSocket and start emitting events. Resolves on first open,
     * rejects if the initial handshake fails.
     */
    async connect(): Promise<void> {
        if (this._destroyed) throw new Error('Client destroyed. Construct a new instance.');
        this.intentionalClose = false;

        let effective: 'managed' | 'direct' = this.mode === 'managed' || this.mode === 'direct' ? this.mode : 'managed';
        if (this.mode === 'auto') {
            // Ask the edge which mode fits this caller's tier. anon/sandbox/demo
            // get routed to direct (their IP -> TikTok, edge only signs + decodes).
            try {
                const headers: Record<string, string> = { 'content-type': 'application/json' };
                if (this.apiKey) headers['x-api-key'] = this.apiKey;
                const r = await fetch(`${HTTPS_ENDPOINT}/webcast/connection_mode`, { method: 'POST', headers, body: '{}' });
                if (this.debug) console.log('[tiktok-live-events] connection_mode status:', r.status);
                if (r.ok) {
                    const body = await r.json() as any;
                    if (this.debug) console.log('[tiktok-live-events] connection_mode body:', JSON.stringify(body));
                    if (body?.data?.recommended_mode === 'direct') effective = 'direct';
                }
            } catch (e: any) {
                if (this.debug) console.log('[tiktok-live-events] connection_mode error:', e?.message);
            }
        }
        if (this.debug) console.log(`[tiktok-live-events] mode=${effective}`);
        if (effective === 'direct') return this.connectDirect();

        const params = new URLSearchParams({ uniqueId: this.uniqueId });
        if (this.apiKey) params.set('apiKey', this.apiKey);
        const wsUrl = `${ENDPOINT}/?${params.toString()}`;
        if (this.debug) console.log(`[tiktok-live-events] connecting -> ${this.apiKey ? wsUrl.replace(this.apiKey, '***') : wsUrl}`);

        return new Promise<void>((resolve, reject) => {
            this.ws = new WebSocket(wsUrl);
            let firstOpen = true;

            this.ws.on('open', () => {
                this._connected = true;
                this.reconnectAttempts = 0;
                if (firstOpen) { firstOpen = false; resolve(); }
                this.emit('connected');
            });

            this.ws.on('message', (raw: Buffer) => {
                let msg: any;
                try { msg = JSON.parse(raw.toString()); } catch { return; }
                if (!msg || typeof msg !== 'object') return;
                // The edge ships an `anon_limit` JSON nudge BEFORE closing
                // the socket. Emit a `rateLimited` event so consumers can
                // render their own banner; fallback to console.warn so
                // non-listeners still see the upgrade hint.
                if (msg.type === 'anon_limit' || msg.type === 'demo_limit' || msg.type === 'session_limit') {
                    (this as any).emit('rateLimited', msg);
                    if (this.listenerCount('rateLimited') === 0) {
                        console.warn(`[tiktok-live-events] ${msg.message || 'rate limit reached.'} ${msg.upgrade_url ? `(see ${msg.upgrade_url})` : ''}`);
                    }
                    // Terminal: server closes socket after this nudge.
                    // Reconnect would slam same cap. Caller must back off.
                    this.rateLimitTerminal = true;
                    this.intentionalClose = true;
                    return;
                }
                const evName: string | undefined = msg.event;
                if (!evName || evName === '_journal' || evName === 'ping' || evName === 'pong') return;
                const evData = msg.data ?? msg;
                if (evName === 'roomInfo') {
                    const ri: RoomInfo = {
                        roomId: evData.roomId || '',
                        wsHost: evData.wsHost,
                        clusterRegion: evData.clusterRegion,
                        connectedAt: evData.connectedAt || new Date().toISOString(),
                    };
                    this.emit('roomInfo', ri);
                    return;
                }
                (this as any).emit(evName, evData);
                // viewer_count is the documented friendly alias for roomUserSeq.
                if (evName === 'roomUserSeq') (this as any).emit('viewer_count', evData);
                (this as any).emit('event', evData);
            });

            this.ws.on('close', (code: number, reason: Buffer) => {
                this._connected = false;
                const reasonStr = reason?.toString() || '';
                this.emit('disconnected', code, reasonStr);
                if (firstOpen) {
                    firstOpen = false;
                    reject(new Error(`Connection refused (code ${code}): ${reasonStr || 'no reason'}`));
                    return;
                }
                if (!this.intentionalClose && !this.rateLimitTerminal && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
                    if (this.debug) console.log(`[tiktok-live-events] reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => { this.connect().catch(() => {}); }, delay);
                }
            });

            this.ws.on('error', (err: Error) => {
                if (firstOpen) { firstOpen = false; reject(err); }
                else this.emit('error', err);
            });
        });
    }

    /** Close the socket. Auto-reconnect will not fire. */
    disconnect(): void {
        this.intentionalClose = true;
        if (this.ws) { try { this.ws.close(1000, 'client disconnect'); } catch {} this.ws = null; }
        if (this.directState) {
            const s = this.directState;
            if (s.heartbeat) { clearInterval(s.heartbeat); s.heartbeat = null; }
            if (s.ttws) { try { s.ttws.close(1000); } catch {} s.ttws = null; }
            if (s.decws) { try { s.decws.close(1000); } catch {} s.decws = null; }
            this.directState = null;
        }
        this._connected = false;
    }

    /**
     * Direct-mode connect. Two WebSockets: one to TikTok (your IP), one to our
     * /decode endpoint. We hand back the signed wss URL + ttwid + binary
     * heartbeat frames; the SDK pumps raw bytes from TikTok into /decode and
     * emits the JSON events that come back.
     */
    private async connectDirect(): Promise<void> {
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        if (this.apiKey) headers['x-api-key'] = this.apiKey;

        // Step 1: resolve unique_id -> room_id via the public live_status
        // endpoint (anon allowed).
        const statusRes = await fetch(`${HTTPS_ENDPOINT}/webcast/live_status`, {
            method: 'POST', headers, body: JSON.stringify({ unique_id: this.uniqueId }),
        });
        if (statusRes.status === 429) {
            const body = await statusRes.json().catch(() => null) as any;
            this.rateLimitTerminal = true;
            this.emit('rateLimited', { type: 'anon_limit', message: body?.error || 'rate limited' });
            throw new Error(body?.error || 'rate limited');
        }
        if (!statusRes.ok) throw new Error(`live_status failed: HTTP ${statusRes.status}`);
        const statusBody = await statusRes.json() as any;
        const roomId = statusBody?.data?.room_id;
        const isLive = !!statusBody?.data?.is_live;
        if (!roomId) throw new Error('could not resolve room_id for ' + this.uniqueId);
        if (!isLive) throw new Error('@' + this.uniqueId + ' is not currently live');

        // Step 2: get signed wss URL + cookies + heartbeat frames.
        const credsRes = await fetch(`${HTTPS_ENDPOINT}/webcast/ws_credentials`, {
            method: 'POST', headers, body: JSON.stringify({ unique_id: this.uniqueId, room_id: roomId }),
        });
        if (credsRes.status === 429) {
            const body = await credsRes.json().catch(() => null) as any;
            this.rateLimitTerminal = true;
            this.emit('rateLimited', { type: 'anon_limit', message: body?.error || 'rate limited' });
            throw new Error(body?.error || 'rate limited');
        }
        if (!credsRes.ok) throw new Error(`ws_credentials failed: HTTP ${credsRes.status}`);
        const creds = await credsRes.json() as any;
        const data = creds?.data;
        if (!data?.ws_url) throw new Error('no ws_url in credentials response');

        const ttUrl: string = data.ws_url;
        const cookies: string = data.cookies || '';
        const userAgent: string = data.user_agent || 'Mozilla/5.0';
        const imEnterB64: string | undefined = data.binary_frames?.im_enter_room_b64;
        const heartbeatB64: string | undefined = data.binary_frames?.heartbeat_b64;

        const decParams = new URLSearchParams();
        if (this.apiKey) decParams.set('apiKey', this.apiKey);
        const decUrl = `${ENDPOINT}/decode?${decParams.toString()}`;

        // Open both sockets in parallel.
        const ttws = new WebSocket(ttUrl, { headers: { Cookie: cookies, 'User-Agent': userAgent, Origin: 'https://www.tiktok.com' } });
        const decws = new WebSocket(decUrl);
        this.directState = { ttws, decws, heartbeat: null };

        let resolvedRoomInfo = false;
        return new Promise<void>((resolveP, rejectP) => {
            let ttOpen = false, decOpen = false;
            const checkReady = () => {
                if (ttOpen && decOpen) {
                    this._connected = true;
                    this.reconnectAttempts = 0;
                    this.emit('connected');
                    // Send the im_enter_room first frame so TikTok starts shipping events.
                    if (imEnterB64) { try { ttws.send(Buffer.from(imEnterB64, 'base64')); } catch {} }
                    // Heartbeat every 10s
                    if (heartbeatB64) {
                        this.directState!.heartbeat = setInterval(() => {
                            try { ttws.send(Buffer.from(heartbeatB64, 'base64')); } catch {}
                        }, 10_000);
                    }
                    if (!resolvedRoomInfo) {
                        resolvedRoomInfo = true;
                        this.emit('roomInfo', { roomId: data.room_id, wsHost: data.ws_host, clusterRegion: data.cluster_region, connectedAt: new Date().toISOString() });
                        resolveP();
                    }
                }
            };
            ttws.on('open', () => { ttOpen = true; checkReady(); });
            decws.on('open', () => { decOpen = true; checkReady(); });

            // Forward every TikTok binary frame into /decode for parsing.
            ttws.on('message', (raw: Buffer, isBinary: boolean) => {
                if (!isBinary || !decws || decws.readyState !== WebSocket.OPEN) return;
                try { decws.send(raw); } catch {}
            });

            // Each /decode response carries an `events` array of typed events.
            decws.on('message', (raw: Buffer) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg?.error) {
                        if (msg.type === 'rate_limited') {
                            this.rateLimitTerminal = true;
                            this.emit('rateLimited', { type: 'decode_limit', message: msg.error });
                        }
                        return;
                    }
                    if (msg?.events && Array.isArray(msg.events)) {
                        for (const ev of msg.events) {
                            const evName: string | undefined = (ev as any)?.type;
                            if (evName) (this as any).emit(evName, ev);
                            // viewer_count is the documented friendly alias for roomUserSeq.
                            if (evName === 'roomUserSeq') (this as any).emit('viewer_count', ev);
                            (this as any).emit('event', ev);
                        }
                    }
                } catch {}
            });

            let closeFired = false;
            const onClose = (code: number, reason: Buffer) => {
                if (closeFired) return;
                closeFired = true;
                this._connected = false;
                const r = reason?.toString() || '';
                this.emit('disconnected', code, r);
                if (this.directState?.heartbeat) { clearInterval(this.directState.heartbeat); this.directState.heartbeat = null; }
                try { ttws.terminate(); } catch {}
                try { decws.terminate(); } catch {}
                // Reconnect on involuntary close (keepalive ping timeout, network blip).
                if (!this.intentionalClose && !this.rateLimitTerminal && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
                    if (this.debug) console.log(`[tiktok-live-events] direct reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => { this.connectDirect().catch(() => {}); }, delay);
                }
            };
            ttws.on('close', onClose);
            decws.on('close', onClose);
            ttws.on('error', (err) => { if (!ttOpen) rejectP(err); else this.emit('error', err); });
            decws.on('error', (err) => { if (!decOpen) rejectP(err); else this.emit('error', err); });
        });
    }

    /** Tear down. Subsequent connects throw. */
    destroy(): void { this.disconnect(); this._destroyed = true; this.removeAllListeners(); }

    /** Typed `.on()` overload so `client.on('chat', e => ...)` autocompletes. */
    on<K extends keyof TikTokLiveEvents>(event: K, listener: TikTokLiveEvents[K]): this {
        return super.on(event, listener as any);
    }
}

export default TikTokLive;
