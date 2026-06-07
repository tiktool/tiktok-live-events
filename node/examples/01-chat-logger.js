// Log every chat message from a TikTok LIVE stream.
// Run: USERNAME=streamername node 01-chat-logger.js
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive(process.env.USERNAME || 'tiktokuser');

live.on('connected', () => console.log('[live] connected'));
live.on('chat', e => console.log(`${e.user.uniqueId}: ${e.comment}`));

await live.connect();
