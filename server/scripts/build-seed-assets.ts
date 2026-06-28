// Pre-build the SEED conversation's audio so it ships in the starter pack like the scenarios' audio.
// Each seed step's TUTOR line (tutorSL) is what the learner hears (auto-played + the bubble ▶ replay),
// spoken in the TEACHER voice. Keys are identical to what /api/speak computes, so a prebuilt clip is
// served free + offline at runtime (no synthesis, no bill).
//
// Generation BILLS — operator-run only (npm run build:seed-assets). Like build:assets, reused clips are
// free; only missing ones are synthesized. Add the produced files to the fetch:assets bundle to ship them.

import "dotenv/config";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { SEEDS } from "../seeds";

const e3 = getE3();
const voiceTag = e3.voiceTagFor(); // teacher voice (learner-facing example)

let made = 0;
let hits = 0;
let failures = 0;

const lines = new Map<string, string>(); // dedupe identical lines across steps/seeds
for (const seed of Object.values(SEEDS)) {
  for (const step of seed.steps) lines.set(step.tutorSL, seed.id);
}

console.log(`▶ build:seed-assets  e3=${e3.name}  voice=${voiceTag}  lines=${lines.size}`);

for (const [text, seedId] of lines) {
  const key = store.audioKey(e3.name, voiceTag, text);
  try {
    const { hit } = await store.getOrCreate(
      key,
      "audio",
      { provider: e3.name, voiceOrModel: voiceTag, text, scenarioId: `seed:${seedId}` },
      async () => {
        const r = await e3.synthesize({ text });
        return { bytes: Buffer.from(r.audioBase64, "base64"), mimeType: r.mimeType };
      },
    );
    hit ? hits++ : made++;
    console.log(`   ${hit ? "hit " : "gen "} ${key.slice(0, 12)}…  "${text}"`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  "${text}": ${err?.message}`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures ? 1 : 0);
