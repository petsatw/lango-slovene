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
// WHAT IS STILL DIFFERENT, and it is not small:
//   - The prompt is built ONCE, at connect. Free chat is stateless and rebuilds it every turn, so its
//     targets re-select as the learner progresses. A live session's targets are frozen at second zero.
//   - No evidence contract. The JSON tail that lets the server credit has no return path in a speech
//     stream, so nothing is credited (docs/live-tutor.md). The teaching half is identical; the
//     bookkeeping half is absent.

import { DIALOGUES, type Dialogue, type DialogueNode } from "../dialogues";
import { LEARNABLES } from "../learnables";
import * as learner from "../assets/learner";
import { selectForWitness } from "../mastery";
import { conversationTeachingBody } from "../prompt";
import { getScenario } from "../scenarios";

/** Every dialogue by id — the live session addresses a lesson the same way the rehearsal player does. */
function lessonIndex(): Map<string, Dialogue> {
  const map = new Map<string, Dialogue>();
  for (const list of Object.values(DIALOGUES)) for (const d of list) map.set(d.id, d);
  return map;
}

export function lessonExists(lessonId: string): boolean {
  return lessonIndex().has(lessonId);
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
const SPOKEN_TAIL = [
  "",
  "",
  "THIS IS A LIVE SPOKEN CONVERSATION. Everything you produce is heard, not read. Never describe what",
  "you are doing, never read out labels or field names, never output JSON or any other structured text —",
  "just talk. The learner can interrupt you at any moment; when they do, stop and listen.",
  "",
  "OPEN with the single Slovene word «Začnemo?» and then wait for them to answer.",
].join("\n");

export interface LessonPrompt {
  lessonId: string;
  title: string;
  /** The one string both adapters receive verbatim. */
  instructions: string;
}

export function buildLessonPrompt(lessonId: string, learnerId: string): LessonPrompt {
  const d = lessonIndex().get(lessonId);
  if (!d) throw new Error(`no such lesson: ${lessonId}`);

  // The witness selection, same call the free-chat turn makes: `familiar` is everything the learner has
  // touched (the tutor's palette), `targets` is the bounded in-play set led by this lesson's material.
  // The palette is THIS session's learner, taken from the live session rather than a global, so two
  // testers running the same lesson at the same time are given the same prompt.
  const model = learner.load(learnerId);
  const { familiar, targets } = selectForWitness(model, 2, focusIdsFor(d));

  // The scene, built the way the rehearsal handoff builds it — the situation and what the level just
  // practised, in English. Priming only: the tutor still composes its own Slovene from the palette.
  const scenario = getScenario(d.scenarioId);
  const sceneName = scenario ? scenario.name || scenario.title : null;
  const context = sceneName
    ? { scene: `${sceneName} — ${d.title}`, practiced: d.objectives.map((o) => o.descriptorEN) }
    : null;

  const instructions = conversationTeachingBody(
    familiar,
    targets,
    undefined, // the default directive — a relaxed everyday chat, same as free chat
    scenario?.role ?? null,
    context,
  ) + SPOKEN_TAIL;

  return { lessonId, title: d.title, instructions };
}
