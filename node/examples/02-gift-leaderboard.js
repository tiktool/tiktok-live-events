// Live gift leaderboard. Refreshes every 5s.
// Run: USERNAME=streamername node 02-gift-leaderboard.js
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive(process.env.USERNAME || 'tiktokuser');
const board = new Map();

live.on('gift', e => {
    if (!e.repeatEnd) return;
    const total = (board.get(e.user.uniqueId) || 0) + e.diamondCount * e.repeatCount;
    board.set(e.user.uniqueId, total);
});

setInterval(() => {
    console.clear();
    console.log('-- TOP GIFTERS --');
    [...board.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([u, d], i) => console.log(`${i + 1}. ${u.padEnd(20)} ${d} diamonds`));
}, 5_000);

await live.connect();
