// reconcile:keyphrase-audio — the DETERMINISTIC L-lane writer for Key Phrases voicing pointers.
//
// The `voice-key-phrases` skill judges WHICH of the character's deliveries models each key phrase and
// WHICH WORDS of it to play. It never writes files. This does — and it does the one thing that makes the
// judgment safe to trust:
//
//   THE SKILL CHOOSES WORD INDICES. THIS SCRIPT DERIVES THE MILLISECONDS.
//
// A model asked for a timestamp will produce a plausible number, and a plausible number is
// indistinguishable from a measured one once it is in a file. So a timestamp is never accepted as input.
// The draft names word indices into the clip's stored alignment; the arithmetic happens here against that
// measurement, and `lint:keyphrase-audio` re-derives it independently. A hallucinated span cannot survive
// any of the three steps.
//
//   npm run reconcile:keyphrase-audio -- <path-to-keyphrase-pointers.json> [--dry-run]
//   npm run reconcile:keyphrase-audio -- .scratch/keyphrase-drafts/slavko-intro/pointers.json --dry-run
//
// It writes the pointers into the scenario's authoring/dialogues/<id>/reconcile-input.json — the
// hand-authored source of truth — NOT into server/dialogues/*.json, which `reconcile:dialogue` owns and
// which nothing else may touch. Run `npm run reconcile:dialogue` afterwards to propagate, then restart the
// server (dialogue JSON loads at startup only).
//
// Input shape:
//   { "scenarioId": "slavko-intro",
//     "pointers": [
//       { "level": 2, "node": "c4", "from": "n5", "fromLevel": 2, "kind": "whole",
//         "why": "the phrase IS the whole line — no cut, true prosody" },
//       { "level": 1, "node": "c2", "from": "n2", "fromLevel": 2, "kind": "span", "words": [2, 3],
//         "why": "sentence-final 'Sem Slavko.' — the frame with his own filler" }
//     ] }
//
// `heard` is DERIVED too, from the alignment's own words, not authored — so what the diff claims the
// learner will hear is what the clip actually says. A pointer whose span reproduces the phrase exactly
// gets no `heard` at all.

// dotenv FIRST: a clip's store key is sha256(provider|voiceTag|text), and the voiceTag is built from the
// concrete voice id in the env. Without this every key resolves against an empty voice id, every lookup
// misses, and the script reports perfectly-present clips as absent.
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getE3 } from "../adapters/index";
import * as store from "../assets/store";
import { validateDialogue } from "../dialogues";
import { words as tokenize } from "./dialogue-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const DIALOGUES_DIR = path.join(__dirname, "..", "dialogues");

function die(msg: string): never {
  console.error(`\n❌ reconcile:keyphrase-audio: ${msg}\n`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const inputArg = argv.find((a) => !a.startsWith("--"));
if (!inputArg) die("usage: npm run reconcile:keyphrase-audio -- <path-to-pointers.json> [--dry-run]");
const inputPath = path.resolve(process.cwd(), inputArg);
if (!existsSync(inputPath)) die(`input not found: ${inputPath}`);

let draft: any;
try {
  draft = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (e: any) {
  die(`input is not valid JSON: ${e.message}`);
}

const scenarioId: string = draft.scenarioId;
if (typeof scenarioId !== "string" || !scenarioId) die(`"scenarioId" is required`);
if (!Array.isArray(draft.pointers)) die(`"pointers" must be an array`);

// The scenario's committed levels — the source of truth for what a node id means and which clip it owns.
const levels = new Map<number, any>();
for (const f of readdirSync(DIALOGUES_DIR).filter((x: string) => x.endsWith(".json"))) {
  const d = validateDialogue(f, JSON.parse(readFileSync(path.join(DIALOGUES_DIR, f), "utf8")));
  if (d.scenarioId === scenarioId) levels.set(d.level, d);
}
if (!levels.size) die(`no dialogues for scenario "${scenarioId}"`);

const e3 = getE3();

interface Resolved {
  level: number;
  node: string;
  sl: string;
  voicing: any;
  srcText: string;
  why: string;
}

const resolved: Resolved[] = [];
for (const p of draft.pointers) {
  const where = `pointer ${p.level}/${p.node}`;
  const dst = levels.get(p.level);
  if (!dst) die(`${where}: scenario has no level ${p.level}`);
  const client = dst.nodes[p.node];
  if (!client) die(`${where}: no such node`);
  if (client.speaker !== "client") die(`${where}: "${p.node}" is an ${client.speaker} node — a voicing pointer belongs on the LEARNER's line`);

  const src = levels.get(p.fromLevel);
  if (!src) die(`${where}: source level ${p.fromLevel} does not exist`);
  const srcNode = src.nodes[p.from];
  if (!srcNode) die(`${where}: source node "${p.from}" does not exist in level ${p.fromLevel}`);
  if (srcNode.speaker !== "npc") die(`${where}: source "${p.from}" is a client node — only the CHARACTER's clips exist to play`);

  // THE ID JOIN (docs §2.1). Both nodes must carry the same catalog learnable: they are instances of one
  // taught shape. This is an equality test, never a similarity score — no shared id means no pointer, and
  // there is no partial-credit fallback.
  const shared = (client.learnables ?? []).filter((id: string) => (srcNode.learnables ?? []).includes(id));
  if (!shared.length)
    die(`${where}: "${p.node}" and ${p.fromLevel}/${p.from} share no catalog learnable — the join is an id `
      + `equality, so this is not a candidate. Tag the npc line, or choose another delivery.`);

  const key = store.audioKey(e3.name, e3.voiceTagFor(src.voices.npc), srcNode.sl);
  if (!store.has(key, "audio")) die(`${where}: source clip for ${p.fromLevel}/${p.from} is not in the store — nothing is synthesized here`);

  let voicing: any = { from: p.from, level: p.fromLevel, kind: p.kind };

  if (p.kind === "whole") {
    if (p.words) die(`${where}: a "whole" voicing plays the clip end to end — drop "words"`);
    // A whole-clip voicing still discloses what will be heard when the line differs from the phrase.
    if (tokenize(srcNode.sl).join(" ") !== tokenize(client.sl).join(" ")) voicing.heard = srcNode.sl;
  } else if (p.kind === "span") {
    const a = store.readAlign(key);
    if (!a) die(`${where}: ${p.fromLevel}/${p.from} has no alignment — run: npm run build:alignments -- ${scenarioId}`);
    // The alignment is keyed to the audio, but a re-authored LINE with unchanged audio would leave the
    // stored transcript behind. Refuse rather than cut a span from timings measured against other words.
    if (a.text !== srcNode.sl)
      die(`${where}: the stored alignment for ${p.fromLevel}/${p.from} was measured against `
        + `"${a.text}" but the node now says "${srcNode.sl}" — re-run build:alignments --regen`);
    const w = p.words;
    if (!Array.isArray(w) || w.length !== 2) die(`${where}: a "span" needs "words": [firstIndex, lastIndex]`);
    const [i, j] = w;
    if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < i || j >= a.words.length)
      die(`${where}: words [${i}, ${j}] is not a range within this clip's ${a.words.length} words `
        + `(${a.words.map((x, k) => `${k}:${x.text}`).join(" ")})`);
    if (p.startMs !== undefined || p.endMs !== undefined)
      die(`${where}: timestamps are DERIVED from the alignment, never authored. Supply word indices only.`);

    voicing.words = [i, j];
    voicing.startMs = Math.round(a.words[i]!.start * 1000);
    voicing.endMs = Math.round(a.words[j]!.end * 1000);
    const heard = a.words.slice(i, j + 1).map((x) => x.text).join(" ");
    if (tokenize(heard).join(" ") !== tokenize(client.sl).join(" ")) voicing.heard = heard;
  } else {
    die(`${where}: "kind" must be "whole" | "span"`);
  }

  resolved.push({ level: p.level, node: p.node, sl: client.sl, voicing, srcText: srcNode.sl, why: p.why ?? "" });
}

// ---- Write into the AUTHORING input, which reconcile:dialogue owns downstream ----------------------
const authoringFile = path.join(ROOT, "authoring", "dialogues", scenarioId, "reconcile-input.json");
if (!existsSync(authoringFile)) die(`no authoring input at ${path.relative(ROOT, authoringFile)} — this writer edits the hand-authored source, never server/dialogues/*.json`);
const authoring = JSON.parse(readFileSync(authoringFile, "utf8"));

let changed = 0;
for (const r of resolved) {
  const lvl = (authoring.levels ?? []).find((l: any) => l.level === r.level);
  if (!lvl) die(`authoring input has no level ${r.level}`);
  const node = lvl.nodes?.[r.node];
  if (!node) die(`authoring input level ${r.level} has no node "${r.node}"`);
  if (JSON.stringify(node.audio) !== JSON.stringify(r.voicing)) changed++;
  node.audio = r.voicing;
}

console.log(`\n▶ reconcile:keyphrase-audio — ${scenarioId}  (${resolved.length} pointer(s), ${changed} changed)`);
for (const r of resolved) {
  const v = r.voicing;
  const span = v.kind === "span" ? `  words ${v.words[0]}–${v.words[1]}  ${v.startMs}–${v.endMs}ms` : "  whole clip";
  console.log(`   L${r.level} ${r.node}  "${r.sl}"`);
  console.log(`      ← L${v.level}/${v.from} "${r.srcText}"${span}`);
  if (v.heard) console.log(`      hears "${v.heard}"  → the panel shows the phrase as its frame`);
  if (r.why) console.log(`      why: ${r.why}`);
}

if (dryRun) {
  console.log(`\n   --dry-run: nothing written.\n`);
  process.exit(0);
}

writeFileSync(authoringFile, JSON.stringify(authoring, null, 2) + "\n");
console.log(`\n✅ wrote ${path.relative(ROOT, authoringFile)}`);
console.log(`   Next: npm run reconcile:dialogue -- ${path.relative(ROOT, authoringFile)}`);
console.log(`         npm run lint:keyphrase-audio -- ${scenarioId}`);
console.log(`         restart the server — dialogue JSON loads at startup only.\n`);
process.exit(0);
