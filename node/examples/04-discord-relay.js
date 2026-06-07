// Forward chat + gifts to a Discord webhook.
// Run: USERNAME=streamer DISCORD_WEBHOOK=https://discord.com/api/webhooks/... node 04-discord-relay.js
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive(process.env.USERNAME || 'tiktokuser');
const webhook = process.env.DISCORD_WEBHOOK;
if (!webhook) throw new Error('Set DISCORD_WEBHOOK to a Discord webhook URL.');

async function send(content) {
    try {
        await fetch(webhook, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content }),
        });
    } catch (err) { console.error('discord send failed', err); }
}

live.on('chat', e => send(`**${e.user.uniqueId}**: ${e.comment}`));
live.on('gift', e => { if (e.repeatEnd) send(`:gift: ${e.user.uniqueId} sent ${e.giftName} x${e.repeatCount} (${e.diamondCount} diamonds)`); });
live.on('disconnected', (code, reason) => send(`Stream closed (${code}) ${reason}`));

await live.connect();
