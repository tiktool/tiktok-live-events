// Tiny HTTP server an OBS Browser Source can subscribe to via Server-Sent Events.
// Run: USERNAME=streamer node 05-obs-overlay.js
// Then add an OBS Browser Source -> http://localhost:8765/
import { TikTokLive } from 'tiktok-live-events';
import http from 'http';

const live = new TikTokLive(process.env.USERNAME || 'tiktokuser');
const clients = new Set();

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui,sans-serif;color:#fff;background:transparent;padding:24px}
.chat{margin:8px 0;font-size:24px;text-shadow:0 1px 3px rgba(0,0,0,.7)}
.user{color:#ff4d4f;font-weight:700}
.gift{color:#f5a623;font-weight:700}
</style></head><body><div id="feed"></div>
<script>
const feed = document.getElementById('feed');
new EventSource('/events').onmessage = ev => {
    const data = JSON.parse(ev.data);
    const div = document.createElement('div');
    div.className = 'chat';
    if (data.kind === 'gift') div.innerHTML = '<span class="gift">' + data.user + ' sent ' + data.giftName + ' x' + data.repeatCount + '</span>';
    else div.innerHTML = '<span class="user">' + data.user + '</span>: ' + data.comment;
    feed.appendChild(div);
    while (feed.children.length > 30) feed.firstChild.remove();
};
</script></body></html>`;

http.createServer((req, res) => {
    if (req.url === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' });
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(HTML);
}).listen(8765, () => console.log('OBS overlay http://localhost:8765/'));

const broadcast = obj => {
    const line = `data: ${JSON.stringify(obj)}\n\n`;
    for (const c of clients) try { c.write(line); } catch {}
};

live.on('chat', e => broadcast({ kind: 'chat', user: e.user.uniqueId, comment: e.comment }));
live.on('gift', e => { if (e.repeatEnd) broadcast({ kind: 'gift', user: e.user.uniqueId, giftName: e.giftName, repeatCount: e.repeatCount }); });

await live.connect();
