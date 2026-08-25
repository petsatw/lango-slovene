// build:alignments — MEASURE where each word falls in the character's clips that already exist.
//
// This is the L lane of the voice-key-phrases pipeline (docs/keyphrase-span-playback.md §3.2), and it is
// deliberately the only script in it. It makes NO choices: it takes the mp3s already on disk and reports,
// per word, where in the clip that word is spoken. Which delivery models which key phrase, and which words
// of it to play, is a teaching judgment made upstream by the `voice-key-phrases` skill. This is an
// instrument, the way `lint:a1` is an instrument — it reports a fact, it does not rule on it.
//
// It exists so the skill's judgment can be CHECKED. A model asked for timestamps from raw audio produces
// plausible numbers with no way to tell a good one from a hallucinated one; against a stored alignment,
// `lint:keyphrase-audio` can verify that every millisecond written into a dialogue was derived from a real
// measurement, and fail the ones that were not.
//
//   npm run build:alignments -- <scenarioId> [--level <n>] [--nodes <id,id,…>] [--regen] [--dry-run]
//   npm run build:alignments -- slavko-intro --dry-run          # what WOULD be measured — free
//   npm run build:alignments -- slavko-intro --nodes n5         # SMOKE TEST: measure one clip only
//   npm run build:alignments -- slavko-intro                    # measure the un-measured clips
//   npm run build:alignments -- slavko-intro --regen            # re-measure everything (after a re-roll)
//
// NEVER SYNTHESIZES. It only reads clips that are already in the store — a node whose audio has not been
// built is reported and skipped, never generated. Billing is at Speech-to-Text rates ($0.22 per HOUR of
// audio), so a scenario is a fraction of a cent, once; the artifact is cached like every other asset and
// re-runs are free.
//
// Only NPC lines are measured, and only their natural clips. Client lines own no audio in a spoken scene,
// and the slow re-speak is a teaching device, never a model of how a phrase is said — no span is ever cut
// from it, so measuring it would bill for something nothing reads.

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import { forcedAlign } from "../adapters/elevenlabs";
import * as store from "../assets/store";
import { validateDialogue, type Dialogue } from "../dialogues";
import { isSynthesized } from "./dialogue-lib";

const args = process.argv.slice(2);
const levelIdx = args.indexOf("--level");
const onlyLevel = levelIdx >= 0 ? Number(args[levelIdx + 1]) : undefined;
const regen = args.includes("--regen");
const dryRun = args.includes("--dry-run");
const nodesIdx = args.indexOf("--nodes");
// An AUDITION: measure only these node ids. One clip is enough to smoke-test the endpoint and see what
// the call actually costs before committing a whole scenario to it.
const onlyNodes =
  nodesIdx >= 0 ? new Set((args[nodesIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) : undefined;
const scenarioId = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--level" && args[i - 1] !== "--nodes");

if (!scenarioId) {
  console.error("Usage: npm run build:alignments -- <scenarioId> [--level <n>] [--nodes <id,id,…>] [--regen] [--dry-run]");
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
// Forced alignment is an ElevenLabs endpoint, not part of the provider-agnostic E3 interface. Refuse
// rather than silently measure clips against a provider that did not make them.
if (e3.name !== "elevenlabs") {
  console.error(`\n❌ build:alignments needs the ElevenLabs E3 (configured: "${e3.name}") — forced alignment is its endpoint.\n`);
  process.exit(1);
}
if (!dryRun && !process.env.ELEVENLABS_API_KEY) {
  console.error(`\n❌ ELEVENLABS_API_KEY is not set (see docs/SECRETS.md). Re-run with --dry-run to see what would be measured.\n`);
  process.exit(1);
}

interface Target {
  level: number;
  nodeId: string;
  text: string;
  key: string;
}

const targets: Target[] = [];
const unbuilt: Target[] = [];
for (const { d } of files) {
  const voiceTag = e3.voiceTagFor(d.voices.npc);
  for (const [id, node] of Object.entries(d.nodes) as [string, Dialogue["nodes"][string]][]) {
    // A span is only ever cut from the CHARACTER's natural delivery. Client lines own no clip in a spoken
    // scene; the slow re-speak is deliberately not a model of the phrase.
    if (node.speaker !== "npc" || !isSynthesized(d, node)) continue;
    if (onlyNodes && !onlyNodes.has(id)) continue;
    const t: Target = { level: d.level, nodeId: id, text: node.sl, key: store.audioKey(e3.name, voiceTag, node.sl) };
    (store.has(t.key, "audio") ? targets : unbuilt).push(t);
  }
}

if (unbuilt.length) {
  console.log(`\n⚠️  ${unbuilt.length} npc line(s) have no clip in the store — nothing to measure, and nothing`);
  console.log(`    is synthesized here. Run build:dialogue-assets first if these should be voiced:`);
  for (const t of unbuilt) console.log(`      L${t.level} ${t.nodeId}  "${t.text}"`);
}

const todo = targets.filter((t) => regen || !store.has(t.key, "align"));
const cached = targets.length - todo.length;

console.log(`\n▶ build:alignments — ${scenarioId}  (${files.length} level(s), e3=${e3.name})`);
console.log(`   ${targets.length} npc clip(s) on disk · ${cached} already measured (free) · ${todo.length} to measure`);

if (dryRun) {
  for (const t of todo) console.log(`   would measure  L${t.level} ${t.nodeId} ${t.key.slice(0, 10)}…  "${t.text}"`);
  console.log(`\n   --dry-run: nothing called, nothing billed.\n`);
  process.exit(0);
}

let made = 0, failures = 0;
for (const t of todo) {
  const mp3 = store.read(t.key, "audio");
  if (!mp3) { console.log(`   ❌  L${t.level} ${t.nodeId}: clip vanished between scan and read`); failures++; continue; }
  try {
    const r = await forcedAlign(mp3, t.text);
    const alignment: store.Alignment = {
      key: t.key,
      // The transcript the timings were measured against — stored so a later lint can tell a stale
      // alignment (the line was re-authored) from a current one without re-calling the API.
      text: t.text,
      words: r.words,
      ...(r.loss !== undefined ? { loss: r.loss } : {}),
      provider: e3.name,
      createdAt: new Date().toISOString(),
    };
    // put() is a no-op on an existing key, so --regen must clear the old artifact first.
    if (regen) store.remove(t.key, "align");
    store.put(t.key, "align", Buffer.from(JSON.stringify(alignment, null, 2) + "\n"), {
      provider: e3.name,
      voiceOrModel: e3.voiceTagFor(files.find((f) => f.d.level === t.level)!.d.voices.npc),
      text: t.text,
      mimeType: "application/json",
      scenarioId,
      objectiveId: `align:${scenarioId}-l${t.level}:${t.nodeId}`,
    });
    made++;
    const lossTag = r.loss !== undefined ? ` loss=${r.loss.toFixed(3)}` : "";
    console.log(`   ✓  L${t.level} ${t.nodeId} ${t.key.slice(0, 10)}…  ${r.words.length} words${lossTag}  "${t.text}"`);
  } catch (err: any) {
    failures++;
    console.log(`   ❌  L${t.level} ${t.nodeId}: ${err?.message}`);
  }
}

console.log(`\nDone. ${made} measured, ${cached} reused (free)` + (failures ? `, ${failures} failed.` : "."));
console.log(`   Next: the voice-key-phrases skill reads these to choose spans; lint:keyphrase-audio checks them.\n`);
process.exit(failures > 0 ? 1 : 0);
