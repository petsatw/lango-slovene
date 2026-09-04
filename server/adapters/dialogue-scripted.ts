// The DIALOGUE-TREE adapter — one step of a predetermined tree, for either input mode.
//
// A rehearsal tree and a spoken scene are the same authored data (server/dialogues/*.json); they differ
// only in what moves them forward. `dialogue.advance` names which:
//
//   "tap"    the learner PICKS a client line. Pure rehearsal, credits nothing — the witness contract
//            holds (docs/free-conversation.md): mastery is only ever earned on the live mic.
//   "audio"  the learner SPEAKS. The tree advances on the audio ARRIVING, never on what it says. There
//            is no model here and nothing inspects the recording — so the turn is unfailable by
//            construction, and the beat's `learnables` are planted as ATTEMPTS, never masteries.
//
// This is the seed adapter's contract (adapters/seed-scripted.ts) generalized to a tree: PURE (no I/O,
// no network, no judging), position derived from where the caller says it is, and CREDITING IS THE
// CALLER'S JOB — this returns the allowlist, the orchestrator applies it.
//
// The mode matters to one authoring rule: in "audio" mode an npc node's `next` is NOT a menu. The
// learner is speaking, so the tree follows `next[0]` — the canonical spine — and any further entries
// are alternates a surface may show as previews without them advancing anything. Author the spine first.
//
// A spoken lesson does have one place where the learner's own answer reaches the app: a beat carrying a
// `choice` asks them for a FACT about themselves (their gender, first of these) and hands the turn over
// as several lines rather than one. That answer changes the WORDING of later lines — each varying node
// resolves against the stored facts — and leaves the spine exactly as it was. A spoken lesson stays one
// straight line through the tree; what varies is which form each line takes when it gets there.

import type { Dialogue, DialogueNode } from "../dialogues";
import type { LearnableProgress } from "../types";

/** What the learner just did. `tap` names the client line they picked; `audio` carries no content on
 *  purpose — the recording is never inspected, only its arrival is the signal.
 *
 *  `answer` is the exception, and it is not the recording: it is the value the learner PRESSED at a beat
 *  that asks them for a fact about themselves (DialogueChoice). A spoken lesson has no other way to learn
 *  one — nothing listens — so the button they chose is the whole signal, and it is a deliberate act
 *  rather than an inference. Beats without a `choice` never carry it. */
export type DialogueInput = { kind: "tap"; choice: string } | { kind: "audio"; answer?: string };

export interface DialogueStep {
  /** The client line the learner just produced (picked, or spoken along the spine) — null when the npc
   *  node they advanced from was terminal. */
  clientNodeId: string | null;
  /** The npc node now current — the response to play/caption next. Null once the tree has ended. */
  npcNodeId: string | null;
  /** The just-produced beat's learnables, as attempts. Always empty in "tap" mode (rehearsal credits
   *  nothing) and for a beat that carries no learnables (e.g. the learner saying their own name). */
  learnableProgress: LearnableProgress[];
  /** The fact the learner just answered, when the beat they left was one that asked. The caller stores
   *  it — this returns the answer exactly as it returns the learnable allowlist, and writes neither. */
  fact: { id: string; value: string } | null;
  /** True once there is no further npc line — the tree is over. */
  done: boolean;
}

function nodeOrThrow(d: Dialogue, id: string): DialogueNode {
  const n = d.nodes[id];
  if (!n) throw new Error(`Dialogue "${d.id}": unknown node "${id}"`);
  return n;
}

/** The mode this dialogue advances in. Absent in the file ⇒ "tap" (every dialogue predating the field). */
export function advanceModeOf(d: Dialogue): "tap" | "audio" {
  return d.advance ?? "tap";
}

/** Take one step of `dialogue` from the npc node `fromNodeId`.
 *
 *  Both modes do the same structural walk — npc node → a client line → that client's single `next` npc
 *  response — and differ only in how the client line is chosen and whether anything is credited. */
export function advanceDialogue(dialogue: Dialogue, fromNodeId: string, input: DialogueInput): DialogueStep {
  const mode = advanceModeOf(dialogue);
  if (mode !== input.kind) {
    throw new Error(`Dialogue "${dialogue.id}" advances by "${mode}" but was given a "${input.kind}" input`);
  }

  const from = nodeOrThrow(dialogue, fromNodeId);
  if (from.speaker !== "npc") throw new Error(`Dialogue "${dialogue.id}": can only advance from an npc node, got "${fromNodeId}"`);

  // A terminal npc node ends the tree — there is nothing to produce and nothing to credit.
  if (!from.next.length) return { clientNodeId: null, npcNodeId: null, learnableProgress: [], fact: null, done: true };

  // A beat that ASKS. The learner presses one of several lines rather than the single "Continue", and
  // which one they pressed is the answer. Advancing it without one would be the app deciding a fact about
  // the person on their behalf, so the step refuses instead — the same refusal the dimmed skip control
  // expresses on screen, stated once more where it cannot be routed around.
  let fact: DialogueStep["fact"] = null;
  if (from.choice) {
    if (input.kind !== "audio" || !input.answer)
      throw new Error(`Dialogue "${dialogue.id}": node "${fromNodeId}" asks the learner for "${from.choice.fact}" — advancing it needs their answer`);
    fact = { id: from.choice.fact, value: input.answer };
  }

  // A beat the learner is not asked to answer — an acknowledgement, a slow re-model, a nudge onward. In
  // "audio" mode the spine may run npc → npc so the character can say more than one thing before handing
  // over. Without it every line he speaks demands a turn, and a lesson can never hold a beat that only
  // carries him forward; the alternative is packing several sentences into one node, which puts far more
  // words in front of the learner than the turn that follows them is worth. Nothing is produced here, so
  // nothing is credited.
  if (input.kind === "audio" && nodeOrThrow(dialogue, from.next[0]!).speaker === "npc") {
    return { clientNodeId: null, npcNodeId: from.next[0]!, learnableProgress: [], fact, done: false };
  }

  const clientNodeId =
    input.kind === "tap"
      ? input.choice
      : from.next[0]!; // spoken: follow the canonical spine; the rest are previews, not branches

  if (input.kind === "tap" && !from.next.includes(clientNodeId)) {
    throw new Error(`Dialogue "${dialogue.id}": "${clientNodeId}" is not a choice offered by node "${fromNodeId}"`);
  }
  const client = nodeOrThrow(dialogue, clientNodeId);
  if (client.speaker !== "client") throw new Error(`Dialogue "${dialogue.id}": node "${clientNodeId}" is not a client line`);

  // Attempts only, and only when the learner actually SPOKE. Tapping is exposure, not production.
  const learnableProgress: LearnableProgress[] =
    input.kind === "audio" ? (client.learnables ?? []).map((id) => ({ id, result: "attempt" as const })) : [];

  const npcNodeId = client.next[0] ?? null;
  return { clientNodeId, npcNodeId, learnableProgress, fact, done: npcNodeId === null };
}
