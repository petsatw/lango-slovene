// The live tutor's instructions — the SAME prompt the production free-chat surface runs on, plus the
// few lines the realtime medium forces.
//
// The provider brief specified its own ten-line prompt. That prompt is gone. It named a lesson plan and
// a term list and nothing else: no register, no role, no scene, no palette, and none of the turn policy
// this app has spent its whole design on. Handing two vendors that string would have compared them on a
// tutoring job neither was actually being asked to do.
//
// So a live session now opens exactly the way tapping "now try it for real" at the end of a rehearsal
// does. It builds the same three inputs the free-chat turn builds — the witness selection (palette +
// bounded targets), the scenario's pinned role, and the scene priming — and hands them to the shared
// body in server/prompt.ts. One string, two callers: the live tutor cannot drift from the production
// prompt without the drift showing up in free chat too.
//
// A SCENE is the exception, by design: a scenario with a `live` surface brings its own harness — the
// scene's Slovene instructions to the tutor — and the app appends the day's scheduled lines and the shape
// of the lesson (scenePrompt below). Opened by the scenario id, or by one of the scenario's trees, whose
// handoff takes the tree's lines as the day's.
//
// WHAT IS STILL DIFFERENT, and it is not small:
//   - The prompt is built ONCE, at connect. Free chat is stateless and rebuilds it every turn, so its
//     targets re-select as the learner progresses. A live session's targets are frozen at second zero.
//   - No evidence contract in the prompt. A speech stream has no return path for the JSON tail, and a
//     speech model handed an output schema would try to say it out loud. Crediting instead happens
//     after the session, from the transcript (server/live/grader.ts) — which is why `targets` leaves
//     this file: the grader scores the same frozen set the session was taught against.

import { DIALOGUES, type Dialogue, type DialogueNode } from "../dialogues";
import { LEARNABLES, type Learnable } from "../learnables";
import * as learner from "../assets/learner";
import { selectForScene, selectForWitness, type SceneSelection } from "../mastery";
import { conversationTeachingBody } from "../prompt";
import { getScenario, harnessText, SCENARIOS, type LiveSurface, type Scenario } from "../scenarios";

/** Every dialogue by id — the live session addresses a lesson the same way the rehearsal player does. */
function lessonIndex(): Map<string, Dialogue> {
  const map = new Map<string, Dialogue>();
  for (const list of Object.values(DIALOGUES)) for (const d of list) map.set(d.id, d);
  return map;
}

export function lessonExists(lessonId: string): boolean {
  return lessonIndex().has(lessonId) || !!liveScene(lessonId);
}

/** Every node of a lesson, root included — root is authored as an array of opening nodes. */
function allNodes(d: Dialogue): DialogueNode[] {
  const root: any = (d as any).root;
  const opening: DialogueNode[] = Array.isArray(root) ? root : root ? [root] : [];
  return [...opening, ...Object.values(((d as any).nodes ?? {}) as Record<string, DialogueNode>)];
}

/** What this lesson had the learner PRODUCE — the client lines' learnables, falling back to what the
 *  level introduces. Deliberately the same derivation the client uses for the rehearsal→free-chat
 *  handoff: on a level that mostly re-practises earlier phrases `introduces` is nearly empty, and those
 *  earlier phrases are exactly what the live session should keep working. */
function focusIdsFor(d: Dialogue): string[] {
  const produced = [
    ...new Set(
      allNodes(d)
        .filter((n) => n.speaker === "client")
        .flatMap((n) => n.learnables ?? []),
    ),
  ].filter((id) => LEARNABLES[id]);
  return produced.length ? produced : (d.introduces ?? []).filter((id) => LEARNABLES[id]);
}

// The realtime tail. It replaces the evidence contract, and it says the only two things the shared body
// cannot know: that this is speech rather than a request, and how to open. The opening is the free-chat
// opening — "Začnemo?" is a static line there, and the learner already knows it from the tutorial, so a
// live session starts on the same word rather than on whatever the vendor improvises.
const SPOKEN_MEDIUM = [
  "THIS IS A LIVE SPOKEN CONVERSATION. Everything you produce is heard, not read. Never describe what",
  "you are doing, never read out labels or field names, never output JSON or any other structured text —",
  "just talk. The learner can interrupt you at any moment; when they do, stop and listen.",
].join("\n");

const SPOKEN_TAIL = [
  "",
  "",
  SPOKEN_MEDIUM,
  "",
  "OPEN with the single Slovene word «Začnemo?» and then wait for them to answer.",
].join("\n");

/** A scenario whose `live` surface makes it a scene the tutor plays from its own harness. */
function liveScene(id: string): (Scenario & { surfaces: { live: LiveSurface } }) | undefined {
  const s = SCENARIOS.find((x) => x.id === id && x.status === "active");
  return s?.surfaces?.live ? (s as Scenario & { surfaces: { live: LiveSurface } }) : undefined;
}

/** Today's lines as the scene prompt lists them: headed groups, in the order the tutor works through
 *  them. A scenario-id session has the schedule's three; a tree handoff has one, the tree's lines. */
type LineGroup = { heading: string; lines: Learnable[] };

function scheduleGroups(sel: SceneSelection): LineGroup[] {
  return [
    { heading: "FIRST — lines they said on an earlier day. Make an opening for each of these before anything new:",
      lines: sel.review },
    { heading: "EVERY VISIT:", lines: sel.core },
    { heading: "NEW TODAY:", lines: sel.fresh },
  ].filter((g) => g.lines.length);
}

/** A harness may hold one section per session, each headed `## @<id>` — a tree's dialogue id, or the
 *  scenario id for a session opened by the scene itself. Everything before the first such heading is the
 *  shared preamble. A session plays the preamble plus its own section, or the preamble alone when it has
 *  none. A harness with no sections (trznica.md) is the whole text. */
export function harnessFor(raw: string, id: string): string {
  const text = raw.replace(/<!--[\s\S]*?-->\n?/g, "").trim(); // authoring notes never reach the tutor
  // split with two capture groups: [preamble, id, title, body, id, title, body, …]
  const parts = text.split(/^## @(\S+)[ \t]*([^\n]*)\n/m);
  const preamble = parts[0]!.trim();
  for (let i = 1; i < parts.length; i += 3) {
    if (parts[i] !== id) continue;
    const title = parts[i + 1]!.replace(/^[—-]\s*/, "");
    return [preamble, "", "---", "", `THIS SITUATION — play only this one: ${title}`, parts[i + 2]!.trim()].join("\n");
  }
  return preamble;
}

/** The scene's own harness, then the lesson the app runs through it: today's lines, and the shape of
 *  the lesson up to its closing line. The harness says who the tutor is, the situation, its people and
 *  its register; the app says which lines the learner practises and when the lesson is over. */
function scenePrompt(harness: string, groups: LineGroup[], close: string, opening: string): string {
  const lines = (ls: Learnable[]) => ls.map((l) => `  «${l.sl}» — ${l.gloss}`);
  return [
    harness,
    "",
    "---",
    "",
    "THE LESSON. The person in front of you is learning to handle the situation above in Slovene. Below",
    "are the lines they are practising today. Give them a natural opening to say each one — by what you",
    "do, what you ask, and how you answer.",
    "",
    ...groups.flatMap((g) => [g.heading, ...lines(g.lines), ""]),
    "HOW THE LESSON RUNS",
    `- Open the way the situation above says; if it says nothing, open with «${opening}» Then wait for the learner.`,
    "- Stay in this situation: its people, its things, the lines above. No praise, no grammar, no words from",
    "  outside it, and no English — not even when asked.",
    "- Once the encounter is finished and the learner has said each of today's lines, begin a second, shorter",
    "  encounter of the same kind in which each of today's lines comes up once more — unless the situation",
    "  above says to end after the first.",
    `- Then end the lesson by saying «${close}» Say it once, and only there.`,
    "- After that the learner may keep talking as long as they like. Stay who you are, in this situation, in Slovene.",
    "",
    SPOKEN_MEDIUM,
  ].join("\n");
}

export interface LessonPrompt {
  lessonId: string;
  title: string;
  /** The one string both adapters receive verbatim. */
  instructions: string;
  /** What the grader scores the finished session against (server/live/grader.ts) — frozen here, at
   *  connect: a set re-selected afterwards would be marking a different exam from the one that was sat.
   *  For a lesson it is the bounded in-play set the tutor steers toward. For a scene it is the whole
   *  card: the day's schedule decides what the tutor steers toward, and anything on the card the learner
   *  actually says is credit due. */
  targets: Learnable[];
  /** What the tutor steers toward — the lines the objectives overlay shows. For a lesson it is
   *  `targets`; for a scene it is today's lines, a short list out of the whole card. */
  objectives: Learnable[];
}

const resolve = (ids: string[]) => ids.map((id) => LEARNABLES[id]!);

export function buildLessonPrompt(lessonId: string, learnerId: string): LessonPrompt {
  const scene = liveScene(lessonId);
  if (scene) {
    const live = scene.surfaces.live;
    const groups = scheduleGroups(selectForScene(learner.load(learnerId), live));
    const card = [...new Set([...live.core, ...live.bank, ...(live.stock ?? [])])];
    return {
      lessonId,
      title: scene.name ?? scene.title,
      instructions: scenePrompt(harnessFor(harnessText(live), lessonId), groups, live.close, scene.opening || "Dober dan."),
      targets: resolve(card),
      objectives: groups.flatMap((g) => g.lines),
    };
  }

  const d = lessonIndex().get(lessonId);
  if (!d) throw new Error(`no such lesson: ${lessonId}`);

  // A tree of a scene hands off to the scene itself — the harness's preamble plus the section keyed by
  // this tree's dialogue id (e.g. sprehod-l4), if it has one — with the lines the tree just had the
  // learner say as today's lines, all of them. The lines off the card join the targets, so the lesson
  // score can count what the tutor was told to steer toward.
  const treeScene = liveScene(d.scenarioId);
  if (treeScene) {
    const live = treeScene.surfaces.live;
    const lines = focusIdsFor(d);
    return {
      lessonId,
      title: d.title,
      instructions: scenePrompt(
        harnessFor(harnessText(live), d.id),
        [{ heading: "TODAY — the lines they just rehearsed in this situation:", lines: resolve(lines) }],
        live.close,
        treeScene.opening || "Dober dan.",
      ),
      targets: resolve([...new Set([...live.core, ...live.bank, ...(live.stock ?? []), ...lines])]),
      objectives: resolve(lines),
    };
  }

  // The witness selection, same call the free-chat turn makes: `knows` is the learner model's contents
  // (the tutor's palette), `targets` is the bounded in-play set led by this lesson's material.
  // The palette is THIS session's learner, taken from the live session rather than a global, so two
  // testers running the same lesson at the same time are given the same prompt.
  const model = learner.load(learnerId);
  const { knows, targets } = selectForWitness(model, 2, focusIdsFor(d));

  // The scene, built the way the rehearsal handoff builds it — the situation and what the level just
  // practised, in English. Priming only: the tutor still composes its own Slovene from the palette.
  const scenario = getScenario(d.scenarioId);
  const sceneName = scenario ? scenario.name || scenario.title : null;
  const context = sceneName
    ? { scene: `${sceneName} — ${d.title}`, practiced: d.objectives.map((o) => o.descriptorEN) }
    : null;

  const instructions = conversationTeachingBody(
    knows,
    targets,
    undefined, // the default directive — a relaxed everyday chat, same as free chat
    scenario?.role ?? null,
    context,
  ) + SPOKEN_TAIL;

  return { lessonId, title: d.title, instructions, targets, objectives: targets };
}
