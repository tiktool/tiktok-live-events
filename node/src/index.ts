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
    private reconnectAttempts = 0;
    private _connected = false;
    private _destroyed = false;

    private readonly uniqueId: string;
    private readonly apiKey: string;
    private readonly autoReconnect: boolean;
    private readonly maxReconnectAttempts: number;
    private readonly debug: boolean;

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
                    // Treat as terminal: server will close socket after this
                    // nudge. Reconnecting would just hit the same cap and
                    // spam the console. Caller must back off or pass apiKey.
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
                if (!this.intentionalClose && this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
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
        this._connected = false;
    }

    /** Tear down. Subsequent connects throw. */
    destroy(): void { this.disconnect(); this._destroyed = true; this.removeAllListeners(); }

    /** Typed `.on()` overload so `client.on('chat', e => ...)` autocompletes. */
    on<K extends keyof TikTokLiveEvents>(event: K, listener: TikTokLiveEvents[K]): this {
        return super.on(event, listener as any);
    }
}

export default TikTokLive;
