// script:lesson — print a spoken lesson AS THE STUDENT EXPERIENCES IT: the conversation, in order, and
// nothing else.
//
//   npm run script:lesson -- <scenarioId> [--level <n>] [--as <fact>=<value>] [--json]
//   npm run script:lesson -- --from <reconcile-input.json> [--level <n>] […]
//
// `--from` reads the authoring pipeline's own reconcile input, so a lesson can be read as a conversation
// while it is still a draft — before reconcile has written anything into server/dialogues/.
//
// This exists so a reviewer can judge the SCRIPT — is the dialogue clear, does it hold together, does the
// student know what to say — without reading the app. Everything a reader would otherwise have to learn
// from the codebase is resolved here and never surfaces: which order the beats actually play in (the
// `next[0]` spine), which wording a learner fact selects, and where a beat asks the student to choose.
//
// What reaches the page is what would be said if two people sat in a room with no screen between them:
// who speaks, the tone they say it in, the Slovene, and what it means. Captions, glosses, emphasis,
// timing, slow re-speaks, stall prompts, audio state, catalog ids and level metadata all stop here —
// a reviewer given those judges the app, which is a different question than the one this serves.
//
// The one thing beyond the words that survives is the DELIVERY TAG, rendered as a stage direction: until
// audio is generated it is the only record of how a line is meant to sound, and tone is part of whether
// a line lands.

import { readFileSync } from "node:fs";
import { DIALOGUES, resolveNode, type Dialogue, type DialogueNode } from "../dialogues";
import { SCENARIOS } from "../scenarios";
import { getFact } from "../facts";

// ---- Arguments ------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const asJson = argv.includes("--json");
const levelArg = flag("level");
const fromPath = flag("from");
// The first bare word that is not some flag's value.
let scenarioId: string | undefined;
for (let i = 0; i < argv.length; i++) {
  if (argv[i]!.startsWith("--")) { if (argv[i] !== "--json") i++; continue; }
  scenarioId = argv[i];
  break;
}

const USAGE = "usage: npm run script:lesson -- <scenarioId> [--level <n>] [--as <fact>=<value>] [--json]\n" +
              "       npm run script:lesson -- --from <reconcile-input.json> [--level <n>] […]";

/** What this script needs of a lesson, from either source. */
interface Lesson {
  scenarioId: string;
  level: number;
  title: string;
  root: string;
  nodes: Record<string, DialogueNode>;
  npcVoice: string;
  spoken: boolean;
  onboarding: boolean;
}

// A lesson the app has loaded — a level that has been reconciled and shipped.
function fromCatalog(id: string): Lesson {
  const levels = DIALOGUES[id] ?? [];
  if (!levels.length) {
    console.error(`no dialogue found for scenario "${id}" (have: ${Object.keys(DIALOGUES).join(", ")})`);
    process.exit(2);
  }
  const d: Dialogue | undefined = levelArg ? levels.find((x) => x.level === Number(levelArg)) : levels[0];
  if (!d) {
    console.error(`scenario "${id}" has no level ${levelArg} (have: ${levels.map((x) => x.level).join(", ")})`);
    process.exit(2);
  }
  return {
    scenarioId: id, level: d.level, title: d.title, root: d.root,
    nodes: d.nodes as Record<string, DialogueNode>,
    npcVoice: d.voices.npc ?? "npc",
    spoken: d.advance === "audio",
    onboarding: !!SCENARIOS.find((s) => s.id === id)?.onboarding,
  };
}

// A lesson that has been WRITTEN but not yet reconciled — the authoring pipeline's own reconcile input
// (docs/authoring-pipeline.md › The reconcile input contract), read straight off the draft. This is what
// lets a lesson be read as a conversation while it is still a proposal, which is the only moment at which
// the reading can still change it cheaply.
function fromInput(path: string): Lesson {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const all: any[] = raw.levels ?? [];
  const lv = levelArg ? all.find((l) => l.level === Number(levelArg)) : all[0];
  if (!lv) {
    console.error(`${path} has no level ${levelArg ?? "(any)"} (have: ${all.map((l) => l.level).join(", ")})`);
    process.exit(2);
  }
  return {
    scenarioId: raw.scenario?.id ?? path, level: lv.level, title: lv.title ?? "",
    root: lv.root, nodes: lv.nodes ?? {},
    npcVoice: raw.dialogueVoices?.npc ?? "npc",
    spoken: raw.dialogueAdvance === "audio",
    onboarding: !!raw.scenario?.onboarding,
  };
}

if (!fromPath && !scenarioId) { console.error(USAGE); process.exit(2); }
const lesson = fromPath ? fromInput(fromPath) : fromCatalog(scenarioId!);

// ---- The spine ------------------------------------------------------------------------------------
// A spoken lesson plays `next[0]` and only `next[0]`. Resolving that here is the whole reason the
// reviewer never has to know it: they get a conversation, not a graph.
const spine: Array<{ id: string; node: DialogueNode }> = [];
for (let id: string | undefined = lesson.root; id; id = spine[spine.length - 1]!.node.next[0]) {
  const node = lesson.nodes[id];
  if (!node) break;
  spine.push({ id, node });
  if (spine.length > 500) break; // a cycle is lint:tree's problem, not this script's
}

// Which learner facts this lesson's wording turns on, and the answer we render the main pass in — the
// first the fact declares, unless the caller asks for another. Every other answer becomes a FORKS entry,
// because a second answer is a second student hearing a slightly different conversation.
const factsOnSpine = [...new Set(spine.map((b) => b.node.variesBy).filter(Boolean) as string[])];
const chosen: Record<string, string> = {};
for (const id of factsOnSpine) chosen[id] = getFact(id)?.values[0]?.value ?? "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== "--as") continue;
  const [f, v] = (argv[i + 1] ?? "").split("=");
  if (f && v) chosen[f] = v;
}

// ---- Rendering one beat ---------------------------------------------------------------------------
// The character's tone, lifted out of the delivery direction and set down as a stage direction. The
// direction itself is written for a synthesiser ("[speaking very slowly and clearly]"); what a reader
// needs is the adjective.
const tone = (n: DialogueNode) =>
  (n.deliverySL?.match(/\[([^\]]+)\]/g) ?? []).map((t) => t.slice(1, -1)).join(", ") || null;

const npcName = lesson.npcVoice.toUpperCase();

interface Beat {
  n: number;
  id: string;
  speaker: string;
  tone: string | null;
  sl: string | null;
  en: string | null;
  chooseEN?: string;
  options?: Array<{ sl: string; en: string }>;
}

const beats: Beat[] = [];
spine.forEach((b, i) => {
  const line = resolveNode(b.node, chosen);
  const n = beats.length + 1;
  if (b.node.speaker === "npc") {
    beats.push({ n, id: b.id, speaker: npcName, tone: tone(line), sl: line.sl, en: line.en });
    return;
  }
  // A beat the student answers by picking between whole lines. The options are the same ones they would
  // be offered: one per answer the fact declares, each shown in the wording that answer produces.
  const asking = spine[i - 1]?.node.choice?.fact;
  const fact = asking ? getFact(asking) : undefined;
  if (fact) {
    beats.push({
      n, id: b.id, speaker: "YOU CHOOSE", tone: null, sl: null, en: null,
      chooseEN: b.node.chooseEN,
      options: fact.values.map((v) => {
        const form = resolveNode(b.node, { [asking!]: v.value });
        return { sl: form.sl, en: form.en };
      }),
    });
    return;
  }
  beats.push({ n, id: b.id, speaker: "YOU SAY", tone: null, sl: line.sl, en: line.en });
});

// Every other answer to a fact, and the lines it changes. A choice beat already shows all its forms, so
// it is not repeated here.
const forks: Array<{ fact: string; value: string; label: string; lines: Array<{ n: number; id: string; sl: string }> }> = [];
for (const f of factsOnSpine) {
  for (const v of getFact(f)?.values ?? []) {
    if (v.value === chosen[f]) continue;
    const lines: Array<{ n: number; id: string; sl: string }> = [];
    spine.forEach((b, i) => {
      const beat = beats.find((x) => x.id === b.id);
      if (!beat || beat.options) return;
      const alt = resolveNode(b.node, { ...chosen, [f]: v.value }).sl;
      if (alt !== resolveNode(b.node, chosen).sl) lines.push({ n: beat.n, id: b.id, sl: alt });
    });
    if (lines.length) forks.push({ fact: f, value: v.value, label: v.label, lines });
  }
}

// ---- Output ---------------------------------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({
    lesson: { scenarioId: lesson.scenarioId, level: lesson.level, title: lesson.title },
    path: chosen, beats, forks,
  }, null, 2));
  process.exit(0);
}

const PAD = " ".repeat(14);
const say = (s: string) => console.log(PAD + s);

console.log(`LESSON: ${lesson.scenarioId} · level ${lesson.level} — "${lesson.title}"`);
if (lesson.onboarding)
  console.log(`The student has never heard Slovene before.`);
// A spoken lesson IS this one conversation. A branching tree is many, and this prints the first —
// enough to read it as a conversation, but say so, because the rest of the tree is not on the page.
if (!lesson.spoken)
  console.log(`This lesson branches; the conversation below is one way through it.`);
for (const f of factsOnSpine) {
  const label = getFact(f)?.values.find((v) => v.value === chosen[f])?.label ?? chosen[f];
  console.log(`Path: ${label}. Lines that differ on the other path are listed at the end.`);
}
console.log("");

for (const b of beats) {
  const head = `${String(b.n).padStart(2)}  ${b.id.padEnd(4)} ${b.speaker}`;
  console.log(b.tone ? `${head}   (${b.tone})` : head);
  if (b.chooseEN) for (const l of b.chooseEN.split("\n")) say(`"${l}"`);
  if (b.sl) { say(b.sl); say(`"${b.en}"`); }
  for (const [i, o] of (b.options ?? []).entries()) {
    say(`${String.fromCharCode(97 + i)})  ${o.sl.padEnd(16)} "${o.en}"`);
  }
  console.log("");
}

if (forks.length) {
  console.log(`── FORKS ────────────────────────────────`);
  for (const f of forks) {
    console.log(`${f.label}:`);
    for (const l of f.lines) console.log(`${String(l.n).padStart(2)}  ${l.id.padEnd(4)} ${l.sl}`);
  }
}
