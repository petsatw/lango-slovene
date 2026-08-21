// Pregenerate audio for a scenario's REHEARSAL dialogues (the predetermined branching trees).
//
// For every node it synthesizes the speaker's line in that speaker's voice profile (dialogue.voices),
// keyed by the CLEAN display line (node.sl) so /api/speak — which only knows the on-screen text — finds
// it. When a node has `deliverySL` (the same line WITH inline eleven_v3 audio tags, e.g.
// "[hesitant] Dober dan…"), THAT is what gets synthesized, while the key stays node.sl. So delivery
// direction steers the voice without ever showing on screen or changing the cache key.
//
// A node may also carry `slowSL` — the same line chunked and re-spoken slowly. That is DIFFERENT text,
// so it is naturally its own key and its own clip, and it gets built alongside the natural one.
//
// After a level's nodes are all built (no failures), it flips that level's `audio` to "ready" so the
// client starts showing play buttons for it. Idempotent + FREE on re-run (disk hits). Bills only on new
// lines. Use --regen to force a re-roll (e.g. after changing a delivery note).
//
//   npm run build:dialogue-assets -- <scenarioId> [--level <n>] [--nodes <id,id,…>] [--regen]
//   npm run build:dialogue-assets -- bakery --level 1            # just the Survival level
//   npm run build:dialogue-assets -- bakery --level 1 --regen    # re-synthesize it (delivery changed)
//   npm run build:dialogue-assets -- bakery --level 1 --nodes n1,c1a,c1b   # AUDITION a few lines only
//
// --nodes is an AUDITION: it synthesizes just those node ids (a cheap pre-approval spot-check of a voice
// or a delivery tag) and does NOT flip the level's `audio` to "ready". Clips land in the shared store, so a
// later full build reuses them free. Pair it with --level to scope the ids to one level.

import "dotenv/config";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { validateDialogue, type Dialogue } from "../dialogues";

const args = process.argv.slice(2);
const scenarioId = args.find(
  (a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--level" && args[args.indexOf(a) - 1] !== "--nodes",
);
const levelIdx = args.indexOf("--level");
const onlyLevel = levelIdx >= 0 ? Number(args[levelIdx + 1]) : undefined;
const nodesIdx = args.indexOf("--nodes");
const auditionNodes =
  nodesIdx >= 0 ? new Set((args[nodesIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(Boolean)) : undefined;
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

// D7ii — VOICE/ENV PREFLIGHT. Synthesis is billed and a run that stops half-way (a missing voice binding,
// a quota stop) leaves a level's audio partially generated. So before touching the provider, verify every
// voice profile the target files reference actually resolves to a configured voice id — and fail fast,
// listing every problem at once, rather than discovering it mid-run on the Nth clip.
{
  const profiles = new Set<string>();
  for (const { d } of files) { profiles.add(d.voices.npc); profiles.add(d.voices.client); }
  const problems: string[] = [];
  for (const p of profiles) {
    let voiceId = "";
    try {
      voiceId = e3.voiceTagFor(p).split(":")[0] ?? ""; // tag = `${voiceId}:${modelId}`
    } catch (err: any) {
      problems.push(`voice profile "${p}": ${err?.message}`); // unknown profile (no binding row)
      continue;
    }
    if (!voiceId) problems.push(`voice profile "${p}": no voice id configured — set its env binding (see docs/SECRETS.md)`);
  }
  if (e3.name === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) problems.push(`ELEVENLABS_API_KEY is not set (see docs/SECRETS.md)`);
  if (problems.length) {
    console.error(`\n❌ preflight failed for "${scenarioId}" — nothing synthesized (would half-complete otherwise):`);
    for (const p of problems) console.error(`   • ${p}`);
    console.error(`\n   Set the missing binding(s) in .env, then re-run. build:dialogue-assets is idempotent — already-built clips are free.\n`);
    process.exit(1);
  }
  console.log(`\n✓ preflight ok — ${profiles.size} voice profile(s) bound: ${[...profiles].join(", ")}`);
}

// Rate control for the chunked-slow re-speak. Not in the cache key (the client finds a clip by
// text+voice), so changing it means --regen on the affected clips.
const SLOW_SPEED = 0.75;

let hits = 0, made = 0, failures = 0;

if (auditionNodes) console.log(`\n♪ audition mode — synthesizing only [${[...auditionNodes].join(", ")}]; audio state left unchanged`);

for (const { file, d } of files) {
  console.log(`\n▶ ${file}  L${d.level} ${d.levelLabel}  e3=${e3.name}  npc=${d.voices.npc} client=${d.voices.client}`);
  let levelFailures = 0;

  for (const [id, node] of Object.entries(d.nodes) as [string, Dialogue["nodes"][string]][]) {
    if (auditionNodes && !auditionNodes.has(id)) continue;
    // In a SPOKEN scene the client lines are what the LEARNER says aloud — they are never played back,
    // and synthesizing them would bill for clips nobody hears, in the character's voice rather than the
    // learner's. Only the character is voiced here.
    if ((d.advance ?? "tap") === "audio" && node.speaker === "client") continue;
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

    // Every OTHER spoken line this node owns, each keyed on its own clean text exactly as `sl` is:
    //   • slowSL       — the chunked-slow re-speak. Different text ⇒ its own key and its own clip (the
    //                    loader rejects a slowSL equal to sl, which would collapse the two into one).
    //                    Synthesized as written: the chunking IS the delivery direction.
    //   • stallHandlers — the lines that fill a learner's silence. They are spoken at the moment the
    //                    learner has gone quiet, so they must be on disk before the scene runs; a live
    //                    synthesis there would bill mid-turn and arrive late.
    const extras: { text: string; say: string; label: string; suffix: string; speed?: number }[] = [];
    if (node.slowSL) extras.push({ text: node.slowSL, say: node.deliverySlowSL ?? node.slowSL, label: "🐢", suffix: "slow", speed: SLOW_SPEED });
    // Stall rungs carry no Slovene of their own — they pulse the caption, re-speak the node's existing
    // slow clip, or soften the button label. Nothing to synthesize.

    for (const x of extras) {
      const xKey = store.audioKey(e3.name, voiceTag, x.text);
      if (regen) store.remove(xKey, "audio");
      try {
        const { hit } = await store.getOrCreate(
          xKey,
          "audio",
          { provider: e3.name, voiceOrModel: voiceTag, text: x.text, scenarioId: d.scenarioId, objectiveId: `dialogue:${d.id}:${id}:${x.suffix}` },
          async () => {
            const r = await e3.synthesize({ text: x.say, voiceProfile, ...(x.speed !== undefined ? { speed: x.speed } : {}) });
            return { bytes: Buffer.from(r.audioBase64, "base64"), mimeType: r.mimeType };
          },
        );
        hit ? hits++ : made++;
        console.log(`   ${hit ? "hit " : "gen "} ${x.label} ${id} [${node.speaker}] ${xKey.slice(0, 10)}…  "${x.text}"`);
      } catch (err: any) {
        failures++; levelFailures++;
        console.log(`   ❌  ${id} [${node.speaker}] ${x.suffix}: ${err?.message}`);
      }
    }
  }

  if (!auditionNodes && levelFailures === 0 && d.audio !== "ready") {
    d.audio = "ready";
    writeFileSync(path.join(DIALOGUES_DIR, file), JSON.stringify(d, null, 2) + "\n");
    console.log(`   ✓ ${file} audio → ready`);
  }
}

console.log(`\nDone. ${made} generated, ${hits} reused (free)` + (failures ? `, ${failures} failed.` : "."));
process.exit(failures > 0 ? 1 : 0);
