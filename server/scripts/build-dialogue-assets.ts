// Pregenerate audio for a scenario's REHEARSAL dialogues (the predetermined branching trees).
//
// For every node it synthesizes the speaker's line in that speaker's voice profile (dialogue.voices),
// keyed by the CLEAN display line (node.sl) so /api/speak — which only knows the on-screen text — finds
// it. When a node has `deliverySL` (the same line WITH inline eleven_v3 audio tags, e.g.
// "[hesitant] Dober dan…"), THAT is what gets synthesized, while the key stays node.sl. So delivery
// direction steers the voice without ever showing on screen or changing the cache key.
//
// After a level's nodes are all built (no failures), it flips that level's `audio` to "ready" so the
// client starts showing play buttons for it. Idempotent + FREE on re-run (disk hits). Bills only on new
// lines. Use --regen to force a re-roll (e.g. after changing a delivery note).
//
//   npm run build:dialogue-assets -- <scenarioId> [--level <n>] [--regen]
//   npm run build:dialogue-assets -- bakery --level 1            # just the Survival level
//   npm run build:dialogue-assets -- bakery --level 1 --regen    # re-synthesize it (delivery changed)

import "dotenv/config";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { validateDialogue, type Dialogue } from "../dialogues";

const args = process.argv.slice(2);
const scenarioId = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--level");
const levelIdx = args.indexOf("--level");
const onlyLevel = levelIdx >= 0 ? Number(args[levelIdx + 1]) : undefined;
const regen = args.includes("--regen");

if (!scenarioId) {
  console.error("Usage: npm run build:dialogue-assets -- <scenarioId> [--level <n>] [--regen]");
  process.exit(1);
}

const DIALOGUES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dialogues");
const files = readdirSync(DIALOGUES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => ({ file: f, d: validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8"))) }))
  .filter(({ d }) => d.scenarioId === scenarioId && (onlyLevel === undefined || d.level === onlyLevel))
  .sort((a, b) => a.d.level - b.d.level);

if (!files.length) {
  console.error(`No dialogues for scenario "${scenarioId}"${onlyLevel !== undefined ? ` level ${onlyLevel}` : ""}.`);
  process.exit(1);
}

const e3 = getE3();
let hits = 0, made = 0, failures = 0;

for (const { file, d } of files) {
  console.log(`\n▶ ${file}  L${d.level} ${d.levelLabel}  e3=${e3.name}  baker=${d.voices.baker} client=${d.voices.client}`);
  let levelFailures = 0;

  for (const [id, node] of Object.entries(d.nodes) as [string, Dialogue["nodes"][string]][]) {
    const voiceProfile = d.voices[node.speaker];
    const voiceTag = e3.voiceTagFor(voiceProfile);
    const key = store.audioKey(e3.name, voiceTag, node.sl); // KEY on the clean display line
    const genText = node.deliverySL ?? node.sl;              // SYNTHESIZE the delivery-tagged text if any
    if (regen) store.remove(key, "audio");
    try {
      const { hit } = await store.getOrCreate(
        key,
        "audio",
        { provider: e3.name, voiceOrModel: voiceTag, text: node.sl, scenarioId: d.scenarioId, objectiveId: `dialogue:${d.id}:${id}` },
        async () => {
          const r = await e3.synthesize({ text: genText, voiceProfile });
          return { bytes: Buffer.from(r.audioBase64, "base64"), mimeType: r.mimeType };
        },
      );
      hit ? hits++ : made++;
      const tag = node.deliverySL ? " ✎" : "  ";
      console.log(`   ${hit ? "hit " : "gen "}${tag} ${id} [${node.speaker}] ${key.slice(0, 10)}…  "${node.sl}"`);
    } catch (err: any) {
      failures++; levelFailures++;
      console.log(`   ❌  ${id} [${node.speaker}]: ${err?.message}`);
    }
  }

  if (levelFailures === 0 && d.audio !== "ready") {
    d.audio = "ready";
    writeFileSync(path.join(DIALOGUES_DIR, file), JSON.stringify(d, null, 2) + "\n");
    console.log(`   ✓ ${file} audio → ready`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
