// lint:keyphrase-audio — the GATE on Key Phrases voicing pointers (docs/keyphrase-span-playback.md §3.4).
//
// A voicing pointer says: play THESE words of THAT clip when the learner asks to hear this phrase. Every
// part of that is checkable, and this checks all of it — because the part that cannot be checked by
// reading the JSON is exactly the part that fails silently. A span whose milliseconds drifted from its
// audio still plays; it just plays the wrong words, and nothing errors.
//
//   npm run lint:keyphrase-audio -- [scenarioId]     # all scenarios if omitted
//
// What it enforces, in the order a pointer can go wrong:
//   1. the referenced node exists, in the level named, and is an NPC node;
//   2. its clip is in the store (nothing here synthesizes, so a missing clip is a dead button);
//   3. for a span: an alignment exists, and it was measured against THE TEXT THE NODE SAYS NOW —
//      a re-authored line with a stale measurement is the drift this whole design is guarding against;
//   4. the word range exists in that alignment, and the stored ms EQUAL the values re-derived from it,
//      so a hand-edited or hallucinated timestamp fails rather than plays;
//   5. the client node and the npc node share the catalog id the join rests on — an equality test, never
//      a similarity score;
//   6. what will be HEARD reproduces the phrase's fixed words exactly, with variation confined to the one
//      slot the catalog frame declares, and `heard` recording the actual filler.
//
// It also reports every clip whose audio exists with NO alignment beside it, and every align artifact
// orphaned from its audio — the `--regen` hazard: a re-rolled clip that kept its old timings.

import "dotenv/config"; // the store key is built from the env-bound voiceTag — see reconcile-keyphrase-audio
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { validateDialogue, type Dialogue } from "../dialogues";
import { LEARNABLES } from "../learnables";
import { words as tokenize, frameFor, normSurface } from "./dialogue-lib";

const onlyScenario = process.argv.slice(2).find((a) => !a.startsWith("--"));
const DIALOGUES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dialogues");

const all = readdirSync(DIALOGUES_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8"))));

const byScenario = new Map<string, Dialogue[]>();
for (const d of all) {
  if (onlyScenario && d.scenarioId !== onlyScenario) continue;
  (byScenario.get(d.scenarioId) ?? byScenario.set(d.scenarioId, []).get(d.scenarioId)!).push(d);
}
if (!byScenario.size) {
  console.error(`\n❌ lint:keyphrase-audio: no dialogues${onlyScenario ? ` for scenario "${onlyScenario}"` : ""}.\n`);
  process.exit(1);
}

const e3 = getE3();
const problems: string[] = [];
const notes: string[] = [];
let pointers = 0, spans = 0, wholes = 0;

/** The catalog frame's fixed words and the position of its slot.
 *  A frame is stored with its slot marked "___" and may carry OPTIONAL segments in parentheses —
 *  "(Ne) govorim (dobro) ___." — because one taught shape genuinely covers the positive and the negative,
 *  the bare and the qualified. Optional words are therefore not "fixed": their presence may differ between
 *  the learner's line and the delivery. What may NEVER differ is a non-optional word. */
function frameParts(sl: string): { fixed: Set<string>; optional: Set<string>; hasSlot: boolean } {
  const optional = new Set<string>();
  for (const m of sl.matchAll(/\(([^)]*)\)/g)) for (const w of tokenize(m[1] ?? "")) optional.add(w);
  const fixed = new Set(tokenize(sl.replace(/\([^)]*\)/g, " ")).filter((w) => w !== "___"));
  return { fixed, optional, hasSlot: sl.includes("___") };
}

for (const [scenarioId, levels] of byScenario) {
  const byLevel = new Map(levels.map((d) => [d.level, d]));

  for (const d of levels) {
    for (const [nodeId, node] of Object.entries(d.nodes)) {
      const v = node.audio;
      if (!v) continue;
      pointers++;
      const at = `${scenarioId} L${d.level}/${nodeId} "${node.sl}"`;

      // 1 — the target exists, in the level named, and is the character's.
      const src = byLevel.get(v.level);
      if (!src) { problems.push(`${at}: points at level ${v.level}, which this scenario does not have`); continue; }
      const srcNode = src.nodes[v.from];
      if (!srcNode) { problems.push(`${at}: points at node "${v.from}" in L${v.level}, which does not exist`); continue; }
      if (srcNode.speaker !== "npc") { problems.push(`${at}: points at L${v.level}/${v.from}, a ${srcNode.speaker} node — only the character owns clips`); continue; }

      // 2 — the bytes are on disk. Nothing here or at request time may synthesize to satisfy a pointer.
      const key = store.audioKey(e3.name, e3.voiceTagFor(src.voices.npc), srcNode.sl);
      if (!store.has(key, "audio")) {
        problems.push(`${at}: the clip for L${v.level}/${v.from} ("${srcNode.sl}") is not in the store — the button would be dead`);
        continue;
      }

      // 5 — THE ID JOIN. Both nodes must carry the same catalog learnable: equality, not similarity.
      const shared = (node.learnables ?? []).filter((id) => (srcNode.learnables ?? []).includes(id));
      if (!shared.length) {
        problems.push(`${at}: shares no catalog learnable with L${v.level}/${v.from} `
          + `(phrase: [${(node.learnables ?? []).join(", ") || "none"}], delivery: [${(srcNode.learnables ?? []).join(", ") || "none"}]) `
          + `— the join is an id equality, so this delivery is not a candidate`);
        continue;
      }

      // What the learner will actually hear.
      let heard = srcNode.sl;

      if (v.kind === "span") {
        spans++;
        // 3 — a measurement exists, and it measured the words this node says NOW.
        const a = store.readAlign(key);
        if (!a) {
          problems.push(`${at}: L${v.level}/${v.from} has no alignment — run: npm run build:alignments -- ${scenarioId}`);
          continue;
        }
        if (a.text !== srcNode.sl) {
          problems.push(`${at}: STALE ALIGNMENT — L${v.level}/${v.from} was measured against "${a.text}" but now says `
            + `"${srcNode.sl}". Every span cut from it has drifted. Re-run build:alignments --regen.`);
          continue;
        }
        // 4 — the range is real, and the stored ms are the DERIVED ms. This is what makes a hallucinated
        // timestamp impossible to ship: the numbers must reproduce from the measurement, exactly.
        const [i, j] = v.words!;
        if (j >= a.words.length) {
          problems.push(`${at}: words [${i}, ${j}] but the clip has only ${a.words.length} words`);
          continue;
        }
        const startMs = Math.round(a.words[i]!.start * 1000);
        const endMs = Math.round(a.words[j]!.end * 1000);
        if (v.startMs !== startMs || v.endMs !== endMs) {
          problems.push(`${at}: startMs/endMs (${v.startMs}/${v.endMs}) do not match the alignment for words `
            + `[${i}, ${j}] (${startMs}/${endMs}) — the timestamps were edited or invented, not measured`);
          continue;
        }
        heard = a.words.slice(i, j + 1).map((w) => w.text).join(" ");
      } else {
        wholes++;
      }

      // 6 — is what will be heard honest under the phrase on screen? The fixed words of the shared frame
      // must survive word for word; only its declared slot may carry a different filler.
      const heardWords = tokenize(heard);
      const phraseWords = tokenize(node.sl);

      if (v.heard !== undefined && tokenize(v.heard).join(" ") !== heardWords.join(" ")) {
        problems.push(`${at}: "heard" says "${v.heard}" but the span actually says "${heard}"`);
        continue;
      }
      const differs = heardWords.join(" ") !== phraseWords.join(" ");
      if (differs && v.heard === undefined) {
        problems.push(`${at}: the delivery says "${heard}", which is not the phrase — that must be disclosed in "heard"`);
        continue;
      }
      if (!differs && v.heard !== undefined) {
        notes.push(`${at}: carries "heard" although the delivery reproduces the phrase exactly — harmless, but the panel will show a frame for nothing`);
      }

      if (differs) {
        // A substitution is only legitimate inside a slot the catalog actually declares.
        const frames = shared.map((id) => ({ id, sl: LEARNABLES[id]?.sl ?? "" })).filter((f) => f.sl);
        const slotted = frames.filter((f) => frameParts(f.sl).hasSlot);
        if (!slotted.length) {
          problems.push(`${at}: the delivery differs from the phrase ("${heard}"), but the shared learnable(s) `
            + `[${shared.join(", ")}] declare no slot — a frame with no slot admits no substitution at all`);
          continue;
        }
        if (heardWords.length !== phraseWords.length) {
          problems.push(`${at}: the delivery "${heard}" does not line up with the phrase word for word `
            + `(${heardWords.length} vs ${phraseWords.length}) — only a single slot may differ`);
          continue;
        }
        const differing = phraseWords.map((w, k) => (w !== heardWords[k] ? k : -1)).filter((k) => k >= 0);
        if (differing.length !== 1) {
          problems.push(`${at}: the delivery "${heard}" differs from the phrase in ${differing.length} places `
            + `— fixed words are fixed; exactly one slot may vary`);
          continue;
        }
        // The one word that differs must not be one the frame names as fixed.
        const slotWord = phraseWords[differing[0]!]!;
        const anyFrameFixesIt = slotted.some((f) => frameParts(f.sl).fixed.has(slotWord));
        if (anyFrameFixesIt) {
          problems.push(`${at}: the substituted word "${slotWord}" is a FIXED word of frame `
            + `"${slotted.find((f) => frameParts(f.sl).fixed.has(slotWord))!.sl}" — that is not its slot`);
          continue;
        }
        // And the panel must be able to render the shape, or the learner reads a word they will not hear.
        // A phrase authored WITH the blank ("Sem ___.") is already its own frame: there is no word on
        // screen to contradict the ear, and nothing for the panel to reduce.
        if (!node.sl.includes("___") && frameFor(node.sl, heard) === node.sl && normSurface(node.sl) !== normSurface(heard)) {
          notes.push(`${at}: the panel cannot reduce "${node.sl}" to a frame against "${heard}", so it will show the `
            + `phrase as written while the ear hears something else`);
        }
      }
    }
  }

  // The --regen hazard, in both directions.
  for (const d of levels) {
    const voiceTag = e3.voiceTagFor(d.voices.npc);
    for (const [nodeId, node] of Object.entries(d.nodes)) {
      if (node.speaker !== "npc") continue;
      const key = store.audioKey(e3.name, voiceTag, node.sl);
      const hasAudio = store.has(key, "audio");
      const align = store.readAlign(key);
      if (align && !hasAudio)
        problems.push(`${scenarioId} L${d.level}/${nodeId}: an ALIGNMENT survives with no audio behind it — `
          + `something deleted the clip without deleting its timings. Use store.removeAudioAndAlign.`);
      if (align && hasAudio && align.text !== node.sl)
        problems.push(`${scenarioId} L${d.level}/${nodeId}: its alignment was measured against "${align.text}" but the `
          + `line now says "${node.sl}" — re-run build:alignments --regen before any span is cut from it`);
    }
  }
}

console.log(`\n▶ lint:keyphrase-audio${onlyScenario ? ` — ${onlyScenario}` : ""}`);
console.log(`   ${pointers} voicing pointer(s): ${wholes} whole-clip, ${spans} span`);
for (const n of notes) console.log(`   ⚠️  ${n}`);
if (problems.length) {
  console.log(`\n❌ ${problems.length} problem(s):`);
  for (const p of problems) console.log(`   • ${p}`);
  console.log("");
  process.exit(1);
}
console.log(`   ✓ every pointer resolves to a real clip, and every span reproduces from its measurement.\n`);
process.exit(0);
