// Print PK MVPs + booster cards as they fire.
// Run: USERNAME=streamername node 03-pk-mvp-tracker.js
import { TikTokLive } from 'tiktok-live-events';

const live = new TikTokLive(process.env.USERNAME || 'tiktokuser');

live.on('battle', e => console.log(`[battle] status=${e.status} id=${e.battleId} duration=${e.battleDuration}s`));

live.on('battleArmies', e => {
    console.log(`[armies] remaining=${e.secsRemaining}s`);
    for (const host of e.hosts ?? []) {
        console.log(`  Host ${host.hostUserId} total=${host.teamTotalScore}`);
        const mvp = host.contributors?.[0];
        if (mvp) console.log(`    MVP ${mvp.nickname} ${mvp.score} diamonds`);
    }
});

live.on('battleItemCard', e => {
    if (e.multiplier > 0) console.log(`[card] x${e.multiplier} booster from ${e.senderNickname}`);
    else console.log(`[card] effect=${e.effect} from ${e.senderNickname} duration=${e.durationSec}s`);
});

await live.connect();
