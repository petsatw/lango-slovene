// playthrough:lesson — print a spoken lesson AS IT PLAYS ON SCREEN: every beat, with the thing the app
// does to it. The companion to `script:lesson`, and deliberately its opposite.
//
//   npm run playthrough:lesson -- <scenarioId> [--level <n>] [--as <fact>=<value>] [--json]
//   npm run playthrough:lesson -- --from <reconcile-input.json> [--level <n>] […]
//
// `script:lesson` answers "does the talking make sense" by throwing the app away. This answers the
// question that survives that reading: WHICH OF THOSE PROBLEMS DOES THE APP ALREADY ANSWER, and which
// does it make worse. A line that reads as an ambiguous question on the page is not ambiguous in play if
// the learner's own answer is sitting on screen beside the button; a question the caption never
// emphasises is more buried in play than it looked on the page. Neither call can be made from the script
// alone, and neither can be made without it.
//
// Everything here is the SURFACE THE RENDERER IS SENT — `sceneShape`, the same function `/api/scene`
// calls — plus the timings from the lesson's pacing profile and what `public/app.js` does with each
// field. Nothing is re-derived from the dialogue file: a second copy of those rules would drift from the
// app within a release, and a review grounded in a drifted copy is worse than one grounded in nothing.
//
// BEAT NUMBERS MATCH `script:lesson` EXACTLY — including the learner's own turns, which the renderer
// folds into the beat that hands them over but which are numbered here as the script numbers them. That
// is what lets a finding from the first reading ("14 · n11") be answered by the second.

import { readFileSync } from "node:fs";
import { DIALOGUES, resolveNode, type Dialogue, type DialogueNode, type DialogueObjective,
         type TutorialStep } from "../dialogues";
import { SCENARIOS } from "../scenarios";
import { getFact } from "../facts";
import { pacingFor, type PacingProfile } from "../pacing";
import { sceneShape, type BeatSurface } from "../scene-shape";
import { LEARNABLES } from "../learnables";

// ---- Arguments ------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const asJson = argv.includes("--json");
const levelArg = flag("level");
const fromPath = flag("from");
let scenarioId: string | undefined;
for (let i = 0; i < argv.length; i++) {
  if (argv[i]!.startsWith("--")) { if (argv[i] !== "--json") i++; continue; }
  scenarioId = argv[i];
  break;
}

const USAGE = "usage: npm run playthrough:lesson -- <scenarioId> [--level <n>] [--as <fact>=<value>] [--json]\n" +
              "       npm run playthrough:lesson -- --from <reconcile-input.json> [--level <n>] […]";

/** What this script needs of a lesson, from either source. */
interface Lesson {
  scenarioId: string;
  level: number;
  levelLabel: string;
  title: string;
  root: string;
  nodes: Record<string, DialogueNode>;
  npcVoice: string;
  spoken: boolean;
  onboarding: boolean;
  pacing: PacingProfile;
  pacingId: string;
  objectives: DialogueObjective[];
  introduces: string[];
  audioState: string;
  frameEN: string[];
  tutorial: TutorialStep[];
}

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
    scenarioId: id, level: d.level, levelLabel: d.levelLabel, title: d.title, root: d.root,
    nodes: d.nodes as Record<string, DialogueNode>,
    npcVoice: d.voices.npc ?? "npc",
    spoken: d.advance === "audio",
    onboarding: !!SCENARIOS.find((s) => s.id === id)?.onboarding,
    pacing: pacingFor(d.pacing), pacingId: d.pacing ?? "onboarding",
    objectives: d.objectives ?? [], introduces: d.introduces ?? [],
    audioState: String(d.audio), frameEN: d.frameEN ?? [], tutorial: d.tutorial ?? [],
  };
}

// A lesson written but not yet reconciled. Reading the play of a DRAFT is the point: it is the last
// moment at which what the app will do to a line can still change the line.
function fromInput(path: string): Lesson {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const all: any[] = raw.levels ?? [];
  const lv = levelArg ? all.find((l) => l.level === Number(levelArg)) : all[0];
  if (!lv) {
    console.error(`${path} has no level ${levelArg ?? "(any)"} (have: ${all.map((l) => l.level).join(", ")})`);
    process.exit(2);
  }
  const pacingId = lv.pacing ?? raw.dialoguePacing ?? "onboarding";
  return {
    scenarioId: raw.scenario?.id ?? path, level: lv.level, levelLabel: lv.levelLabel ?? "",
    title: lv.title ?? "", root: lv.root, nodes: lv.nodes ?? {},
    npcVoice: raw.dialogueVoices?.npc ?? "npc",
    spoken: raw.dialogueAdvance === "audio",
    onboarding: !!raw.scenario?.onboarding,
    pacing: pacingFor(pacingId), pacingId,
    objectives: lv.objectives ?? [], introduces: lv.introduces ?? [],
    audioState: String(lv.audio ?? "pending"), frameEN: lv.frameEN ?? [], tutorial: lv.tutorial ?? [],
  };
}

if (!fromPath && !scenarioId) { console.error(USAGE); process.exit(2); }
const lesson = fromPath ? fromInput(fromPath) : fromCatalog(scenarioId!);

// ---- The spine ------------------------------------------------------------------------------------
const spine: Array<{ id: string; node: DialogueNode }> = [];
for (let id: string | undefined = lesson.root; id; id = spine[spine.length - 1]!.node.next[0]) {
  const node = lesson.nodes[id];
  if (!node) break;
  spine.push({ id, node });
  if (spine.length > 500) break;
}

// The learner this playthrough is FOR. The app answers a real person whose facts it already holds, so a
// beat's wording, and which beats exist as a choice at all, depend on them.
const factsOnSpine = [...new Set(spine.map((b) => b.node.variesBy).filter(Boolean) as string[])];
const facts: Record<string, string> = {};
for (const id of factsOnSpine) facts[id] = getFact(id)?.values[0]?.value ?? "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] !== "--as") continue;
  const [f, v] = (argv[i + 1] ?? "").split("=");
  if (f && v) facts[f] = v;
}

// Beat numbers, assigned over the WHOLE spine so they match `script:lesson` — the renderer folds a
// client node into the beat that hands over to it, but a finding cites the number the script printed.
const numberOf = new Map<string, number>();
spine.forEach((b, i) => numberOf.set(b.id, i + 1));

// ---- Rendering ------------------------------------------------------------------------------------
const tone = (n: DialogueNode) =>
  (n.deliverySL?.match(/\[([^\]]+)\]/g) ?? []).map((t) => t.slice(1, -1)).join(", ") || null;

const secs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 ? 1 : 0)}s` : `${ms}ms`);

/** The caption as the eye meets it: the emphasised span marked, because emphasis is an authored claim
 *  about which words the beat is about, and a beat can emphasise the wrong half of its own line. */
const marked = (sl: string, focus: string | null) => {
  if (!focus) return sl;
  const at = sl.indexOf(focus);
  return at < 0 ? `${sl}   [emphasis "${focus}" — NOT FOUND in the line]`
                : sl.slice(0, at) + `»${focus}«` + sl.slice(at + focus.length);
};

// ---- What each line is MADE OF ---------------------------------------------------------------------
// A learner produces a FRAME with a filler in it. The frame is the thing being taught; the filler is
// whichever one that moment supplies — the character's name, the learner's own, a role noun. A native
// saying the frame with their own filler is therefore a complete model of it.
//
// Rendered Slovene hides this. `Sem Slavko.`, `Sem ___.` and `Ti si učitelj.` read as three unrelated
// sentences, so a reader given only the strings reasons about strings: they conclude a line "has no
// source" because no node says it verbatim, or that a production went unconfirmed because the character
// never repeated the learner's own filler back. Both are true of the string and false of the frame, and
// both have shipped as findings.
//
// The catalog has always known the difference — `kind: "pattern"` carries a `___` slot, `vocabulary` and
// `chunk` do not. This surfaces it on every beat, so the frame a line instantiates is as visible as the
// words, and the same frame is recognisable across the beats that share it.

/** The frame with its slot filled from this line, where the citation form literally fits. */
function fillerIn(frame: string, sl: string): string | null {
  const slot = frame.indexOf("___");
  if (slot < 0) return null;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const [head, tail] = [frame.slice(0, slot), frame.slice(slot + 3)];
  // The frame is cited capitalised ("Sem ___."); mid-sentence it is not, and its final stop may give way
  // to a comma or a question mark. Match the words, and let the edges move.
  const re = new RegExp(`${esc(head.trim())}\\s+(.+?)\\s*${esc(tail.trim()) || "(?=[.,!?]|$)"}`, "iu");
  const m = sl.match(re);
  return m?.[1]?.trim() || null;
}

/** One line's material: the frames it carries, each with the filler it puts in the slot, then the
 *  single words. `learnables` on a client node is what the learner produces; on an npc node it is what
 *  they hear. Either way it is the same catalog, so the frames line up across speakers. */
function material(sl: string, ids: string[], learnerSlot: boolean): Row[] {
  const rows: Row[] = [];
  const patterns = ids.map((id) => [id, LEARNABLES[id]] as const).filter(([, l]) => l?.kind === "pattern");
  const words = ids.map((id) => [id, LEARNABLES[id]] as const).filter(([, l]) => l && l.kind !== "pattern");
  for (const [id, l] of patterns) {
    const frame = l!.sl;
    const filler = fillerIn(frame, sl);
    const shown = frame.replace(/\.$/, "");
    // A pattern is one shape across person, number, case and tense, so a line can carry the frame without
    // the citation form appearing in it — `Ti si učitelj.` is `Sem ___.` in the second person. Say which
    // it is, because "the frame is not here" and "the frame is here in another person" are the two
    // readings that get confused.
    rows.push({ label: "frame", text: filler
      ? `${id} · ${shown}   →  filler here: ${learnerSlot && /^_+$/.test(filler) ? "the learner's own" : `"${filler}"`}`
      : `${id} · ${shown}   →  same frame, realised as "${sl.replace(/[.!?]+$/, "")}"` });
  }
  if (words.length)
    rows.push({ label: "words", text: words.map(([id, l]) => `${id} (${l!.kind})`).join(" · ") });
  return rows;
}

interface Row { label: string; text: string }
interface Block {
  n: number; id: string; tone: string | null; surface: BeatSurface;
  rows: Row[];
  turn: { n: number; id: string; head: string; rows: Row[] } | null;
}

const blocks: Block[] = [];
for (const [i, b] of spine.entries()) {
  if (b.node.speaker !== "npc") continue;          // a client node is a turn, drawn inside the beat above it
  const s = sceneShape(lesson.nodes, facts, lesson.pacing, b.id)!;
  const p = lesson.pacing;
  const rows: Row[] = [];

  // The caption and the voice are one event — the text goes up and the line is spoken over it.
  rows.push({ label: "caption", text: marked(s.sl, s.focusSpan) });
  rows.push(...material(s.sl, b.node.learnables ?? [], false));
  rows.push({
    label: "voice",
    text: s.captionLeadMs
      ? `spoken over the caption, ${secs(s.captionLeadMs)} after it appears`
      : `spoken as the caption appears`,
  });
  rows.push({
    label: "tortoise",
    text: s.slowSL ? `live from the first syllable — tapping it CUTS the line and restarts it slowly`
                   : `dimmed — this beat has no slow re-speak`,
  });
  // The English never withdraws from the data; it withdraws from the screen.
  rows.push({
    label: "english",
    text: s.glossPolicy === "after"
      ? `appears on its own ${secs(p.glossDelayMs)} after the line ends — "${s.en}"`
      : `HIDDEN until the learner taps the caption — "${s.en}"`,
  });

  if (s.terminal) {
    rows.push({ label: "then", text: `the goodbye is held ${secs(p.closeHoldMs)} and the level ENDS — no turn is offered` });
  } else if (!s.handsOver) {
    // The one caption a learner cannot go back to.
    const shown = Math.max(s.sl.length, s.glossPolicy === "after" ? s.en.length : 0);
    rows.push({
      label: "then",
      text: `NO TURN — the character carries on. Held ${secs(p.beatHoldMs + p.beatCharMs * shown)}, then this caption is REPLACED (the learner cannot get it back)`,
    });
  } else {
    rows.push({ label: "then", text: `the turn is handed over after ${secs(p.handoverMs)}; the caption dims and stays up beside the learner's slot` });
  }

  const clientRaw = spine[i + 1];
  let turn: Block["turn"] = null;
  if (s.handsOver && clientRaw) {
    const trows: Row[] = [];
    if (s.choice) {
      // The buttons ARE the prompt; the slot above carries the beat's instruction instead.
      // On screen the MOMENT the turn opens, not on a stall rung — a choice beat's instruction replaces
      // the `soften` rung rather than arriving ten seconds after it. Say so, or a reader counting stall
      // rungs reads the beat as the one turn with no help behind it.
      trows.push({ label: "above", text: s.choice.en
        ? `${s.choice.en.split("\n").join(" / ")}   — on screen from the moment the turn opens`
        : "(nothing — the options stand alone)" });
      s.choice.options.forEach((o, k) => {
        trows.push({ label: `  ${String.fromCharCode(97 + k)})`, text: `${marked(o.sl, o.focusSpan)}   "${o.en}"` });
        trows.push(...material(o.sl, clientRaw.node.learnables ?? [], true).map((r) => ({ ...r, label: `    ${r.label}` })));
      });
      trows.push({ label: "skip", text: `DISABLED — a beat that asks about the learner cannot be stepped past` });
    } else if (s.prompt) {
      trows.push({
        label: "slot",
        text: s.prompt.sl ? marked(s.prompt.sl, s.prompt.focusSpan)
                          : `(no Slovene stem — the English instruction carries the turn alone)`,
      });
      trows.push(...material(s.prompt.sl ?? clientRaw.node.sl, clientRaw.node.learnables ?? [], true));
      trows.push({
        label: "english",
        text: s.prompt.glossPolicy === "after"
          ? `shown with the line — "${s.prompt.en}"`
          : `HELD until the learner taps their own slot — "${s.prompt.en}"`,
      });
      trows.push({ label: "button", text: `reads "Continue"` });
    }
    // The quiet-learner ladder — what the app offers someone who does not act, and when.
    for (const h of s.stallHandlers) {
      const what = h.kind === "pulse" ? `the character's caption PULSES`
                 : h.kind === "respeak" ? (s.slowSL ? `the line is re-spoken SLOWLY, unasked` : `(respeak rung, but this beat has no slowSL — nothing happens)`)
                 : `the button's label becomes "${h.label}"`;
      trows.push({ label: `+${secs(h.afterMs)}`, text: what });
    }
    if (!s.stallHandlers.length)
      trows.push({ label: "quiet", text: `NO stall ladder — a learner who does not know what to do is offered nothing` });
    turn = {
      n: numberOf.get(clientRaw.id)!, id: clientRaw.id,
      head: s.choice ? "YOU CHOOSE" : "YOU SAY", rows: trows,
    };
  }

  blocks.push({ n: numberOf.get(b.id)!, id: b.id, tone: tone(b.node), surface: s, rows, turn });
}

// Every other answer to a fact, and the lines it changes — the same second student `script:lesson`
// lists, so a finding about one path can be checked against the other.
const forks: Array<{ label: string; lines: Array<{ n: number; id: string; sl: string }> }> = [];
for (const f of factsOnSpine) {
  for (const v of getFact(f)?.values ?? []) {
    if (v.value === facts[f]) continue;
    const lines: Array<{ n: number; id: string; sl: string }> = [];
    spine.forEach((b, i) => {
      // A choice beat already shows every form on its own buttons; it is not a fork.
      if (spine[i - 1]?.node.choice) return;
      const alt = resolveNode(b.node, { ...facts, [f]: v.value }).sl;
      if (alt !== resolveNode(b.node, facts).sl) lines.push({ n: numberOf.get(b.id)!, id: b.id, sl: alt });
    });
    if (lines.length) forks.push({ label: v.label, lines });
  }
}

// ---- Output ---------------------------------------------------------------------------------------
if (asJson) {
  console.log(JSON.stringify({
    lesson: { scenarioId: lesson.scenarioId, level: lesson.level, title: lesson.title,
              pacing: lesson.pacingId, audio: lesson.audioState },
    path: facts, objectives: lesson.objectives, introduces: lesson.introduces,
    frameEN: lesson.frameEN, tutorial: lesson.tutorial,
    beats: blocks.map((b) => ({ n: b.n, id: b.id, tone: b.tone, surface: b.surface,
                                rows: b.rows, turn: b.turn })),
    forks,
  }, null, 2));
  process.exit(0);
}

const W = 10;
const row = (r: Row) => {
  const lines = r.text.split("\n");
  console.log(`      ${r.label.padEnd(W)}${lines[0]}`);
  for (const l of lines.slice(1)) console.log(`      ${" ".repeat(W)}${l}`);
};

console.log(`PLAYTHROUGH: ${lesson.scenarioId} · level ${lesson.level} — "${lesson.title}"`);
console.log(`Every beat as it plays on screen. Beat numbers match \`script:lesson\`.`);
console.log(`»…« marks the span the caption emphasises. Timings are the "${lesson.pacingId}" pacing profile.`);
if (lesson.onboarding) console.log(`This is the learner's first Slovene, ever.`);
if (!lesson.spoken) console.log(`This lesson branches; the run below is one way through it.`);
for (const f of factsOnSpine) {
  const label = getFact(f)?.values.find((v) => v.value === facts[f])?.label ?? facts[f];
  console.log(`Playing as: ${label}.`);
}
console.log(`Audio: ${lesson.audioState}.`);
console.log("");

// What the learner is told the level is FOR, before a word of it is spoken. A finding about a beat that
// nothing in this list accounts for is a finding about the level's shape, not the beat's.
if (lesson.objectives.length) {
  console.log(`── WHAT THE LEVEL SAYS IT TEACHES ───────`);
  for (const o of lesson.objectives) console.log(`  • ${o.label} — ${o.descriptorEN}`);
  console.log("");
}
if (lesson.introduces.length) {
  console.log(`  Introduces: ${lesson.introduces.join(", ")}`);
  // `introduces` is what this level MEETS FIRST — heard or said. It is not the list of things the
  // learner is asked to produce; that is whichever of them turn up in a slot below. A reader told the
  // two are the same reports a level for "claiming credit" for every word it only ever speaks.
  console.log(`  (What this level meets first — heard OR said. The turns below are what it asks for.)`);
  console.log("");
}
if (lesson.frameEN.length) {
  console.log(`── BEFORE ANY SLOVENE ───────────────────`);
  console.log(`  English on-ramp; lines accumulate rather than replacing each other.`);
  for (const l of lesson.frameEN)
    console.log(`   ${secs(lesson.pacing.frameLineMs + lesson.pacing.frameCharMs * l.length).padStart(6)}  ${l.replace(/<[^>]+>/g, "")}`);
  console.log("");
}
if (lesson.tutorial.length) {
  console.log(`── THE APP EXPLAINS ITSELF ──────────────`);
  for (const t of lesson.tutorial) console.log(`  [${t.target}] ${t.text}`);
  console.log("");
}

console.log(`── THE RUN ──────────────────────────────`);
console.log("");
for (const b of blocks) {
  const head = `${String(b.n).padStart(2)}  ${b.id.padEnd(4)} ${lesson.npcVoice.toUpperCase()}`;
  console.log(b.tone ? `${head}   (${b.tone})` : head);
  for (const r of b.rows) row(r);
  if (b.turn) {
    console.log("");
    console.log(`${String(b.turn.n).padStart(2)}  ${b.turn.id.padEnd(4)} ${b.turn.head}`);
    for (const r of b.turn.rows) row(r);
  }
  console.log("");
}

if (forks.length) {
  console.log(`── THE OTHER LEARNER ────────────────────`);
  for (const f of forks) {
    console.log(`${f.label}:`);
    for (const l of f.lines) console.log(`${String(l.n).padStart(2)}  ${l.id.padEnd(4)} ${l.sl}`);
  }
}
