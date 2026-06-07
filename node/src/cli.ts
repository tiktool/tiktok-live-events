#!/usr/bin/env node
/**
 * tiktok-live-events CLI.
 *
 * Usage:
 *   tiktok-live-events <username> [--filter chat,gift,...] [--json]
 */
import { TikTokLive } from './index.js';
import * as readline from 'readline';

interface Args {
    username?: string;
    filter?: Set<string>;
    json?: boolean;
    apiKey?: string;
}

function parseArgs(argv: string[]): Args {
    const out: Args = {};
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--filter' || a === '-f') {
            out.filter = new Set((argv[++i] || '').split(',').map(s => s.trim()).filter(Boolean));
        } else if (a === '--json') out.json = true;
        else if (a === '--api-key') out.apiKey = argv[++i];
        else if (a === '--help' || a === '-h') { help(); process.exit(0); }
        else if (!out.username) out.username = a;
    }
    return out;
}

function help() {
    console.log(`tiktok-live-events <username> [options]

Options:
  -f, --filter <list>     Comma-separated event types to show (default: all)
                          e.g. chat,gift,follow,viewer,like
      --json              Emit each event as one JSON line (machine-readable)
  -h, --help              Show this help

Examples:
  tiktok-live-events streamer
  tiktok-live-events streamer --filter chat,gift
  tiktok-live-events streamer --json > events.ndjson
`);
}

function fmt(name: string, e: any): string {
    e = e || {};
    switch (name) {
        case 'chat':       return `[chat]    ${e.user?.uniqueId || '?'}: ${e.comment || ''}`;
        case 'gift':       return `[gift]    ${e.user?.uniqueId || '?'} -> ${e.giftName} x${e.repeatCount || 1}`;
        case 'like':       return `[like]    ${e.user?.uniqueId || '?'} (${e.likeCount || 1})`;
        case 'follow':     return `[follow]  ${e.user?.uniqueId || '?'}`;
        case 'share':      return `[share]   ${e.user?.uniqueId || '?'}`;
        case 'join':       return `[join]    ${e.user?.uniqueId || '?'}`;
        case 'subscribe':  return `[sub]     ${e.user?.uniqueId || '?'}`;
        case 'viewer':     return `[viewer]  ${e.viewerCount}`;
        case 'roomUser':   return `[viewer]  ${e.viewerCount || e.totalUser || '?'}`;
        case 'connected':  return `[ready]   connected to @${e.uniqueId || ''} (room ${e.roomId || '?'})`;
        case 'streamEnd':  return `[end]     stream ended`;
        case 'disconnected': return `[bye]     disconnected`;
        case 'error':      return `[error]   ${e?.message || e}`;
        case 'rateLimited': return `[limit]   ${e?.message || e?.reason || 'rate-limited'}`;
        default:
            return `[${name}] ${JSON.stringify(e).slice(0, 200)}`;
    }
}

function promptKey(message: string): Promise<string> {
    return new Promise((resolveP) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        console.log('');
        console.log(`[limit]   ${message}`);
        rl.question('[events] Paste your API key (or press Enter to quit): ', (answer) => {
            rl.close();
            resolveP((answer || '').trim());
        });
    });
}

async function connectLoop(username: string, args: Args): Promise<void> {
    let apiKey = args.apiKey || process.env.TIKTOOL_API_KEY || '';

    while (true) {
        if (!args.json) console.log(`[events] connecting to @${username} ...`);

        const live = new TikTokLive(username, { apiKey });
        const filter = args.filter;
        const shouldShow = (name: string) => !filter || filter.has(name);

        const wrap = (name: string) => (e: any) => {
            if (!shouldShow(name)) return;
            if (args.json) process.stdout.write(JSON.stringify({ type: name, data: e }) + '\n');
            else console.log(fmt(name, e));
        };

        const names = ['chat','gift','like','follow','share','join','subscribe','viewer','roomUser','connected','streamEnd'];
        for (const n of names) live.on(n as any, wrap(n));

        let limitMsg = '';
        const limitFired: Promise<void> = new Promise<void>((resolveP) => {
            live.on('rateLimited', (e: any) => {
                limitMsg = e?.message || e?.reason || 'Anonymous limit reached. Grab a free API key at https://tik.tools to lift the cap.';
                resolveP();
            });
        });
        const endFired: Promise<void> = new Promise<void>((resolveP) => {
            live.on('disconnected', () => {
                if (!args.json) console.log(fmt('disconnected', {}));
                resolveP();
            });
        });

        live.on('error', (e: any) => console.error(fmt('error', e)));

        const cleanup = () => { try { live.disconnect(); } catch {} process.exit(0); };
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        try { await live.connect(); }
        catch (e: any) {
            console.error(`[events] failed: ${e?.message || e}`);
            process.exit(1);
        }

        const wasLimit = await Promise.race([
            limitFired.then(() => true),
            endFired.then(() => false),
        ]);

        try { live.disconnect(); } catch {}

        if (!wasLimit) return;

        // Rate-limited. Prompt user for an API key + retry.
        const newKey = await promptKey(limitMsg);
        if (!newKey) {
            console.log('[events] no key entered. Exiting.');
            return;
        }
        apiKey = newKey;
        // Loop again with the new key.
    }
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.username) { help(); process.exit(1); }
    const username = args.username.replace(/^@/, '').trim();
    await connectLoop(username, args);
}

main();
