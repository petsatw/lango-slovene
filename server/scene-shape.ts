// The BEAT SURFACE — everything the renderer is told about one beat of a spoken lesson, and the only
// thing it is told. `/api/scene` sends this and nothing else; `public/app.js` draws from this and reads
// no dialogue file of its own.
//
// It lives in its own module because it is read from two places and must be the same in both: the server
// answering a learner, and `playthrough:lesson` showing a reviewer what that learner would meet. A second
// copy of these rules written for the reviewer would drift from the app within a release, and a review
// grounded in a drifted copy is worse than one grounded in nothing.

import { resolveNode, type DialogueNode } from "./dialogues";
import { getFact } from "./facts";
import type { PacingProfile } from "./pacing";

export interface BeatSurface {
  id: string;
  sl: string;
  en: string;
  slowSL: string | null;
  captionLeadMs: number;
  focusSpan: string | null;
  glossPolicy: string;
  stallHandlers: Array<{ kind: string; label: string | null; afterMs: number }>;
  prompt: { sl: string | null; en: string; glossPolicy: string; focusSpan: string | null } | null;
  choice: {
    fact: string;
    en: string | null;
    options: Array<{ value: string; sl: string; en: string; focusSpan: string | null }>;
  } | null;
  handsOver: boolean;
  terminal: boolean;
}

/** One beat as the renderer receives it. `facts` is read at call time, not snapshotted: the beat that
 *  ASKS a learner fact is immediately followed by the beat that uses the answer. */
export function sceneShape(
  nodes: Record<string, DialogueNode>,
  facts: Record<string, string>,
  pacing: PacingProfile,
  id: string | null,
): BeatSurface | null {
  const raw = id ? nodes[id] : null;
  if (!raw) return null;
  const n = resolveNode(raw, facts);
  // What the learner is asked to say is the upcoming CLIENT node's own line — not a gloss of what the
  // character just said. A beginner who hears nine words and must produce two cannot tell which two,
  // and the character's caption can never tell them; their own line can.
  const clientRaw = n.next.map((i) => nodes[i]).find((x) => x?.speaker === "client");
  const client = clientRaw ? resolveNode(clientRaw, facts) : undefined;
  // A client line that is nothing but a blank ("___" — the learner saying their own name) has no
  // Slovene stem to show. Rendering the blank on its own is worse than showing nothing: it is a bold
  // placeholder that says only "something goes here". In that case the English instruction IS the
  // prompt, and it carries the beat alone.
  const stem = client && /\p{L}/u.test(client.sl) ? client.sl : null;
  // A beat that asks the learner for a fact hands the turn over as one button PER ANSWER, each
  // carrying the whole line that answer makes them say. The buttons are the prompt, so the prompt is
  // not shown twice; the surface reads `choice` first and falls back to `prompt` for every other beat.
  const fact = raw.choice ? getFact(raw.choice.fact) : undefined;
  const choice = fact && clientRaw
    ? {
        fact: raw.choice!.fact,
        // The one line that speaks for the whole beat, above the options. Read from the UNRESOLVED
        // client node: it is shared by every form of the line and is on screen before any answer exists.
        en: clientRaw.chooseEN ?? null,
        options: fact.values.map((v) => {
          const line = resolveNode(clientRaw, { [raw.choice!.fact]: v.value });
          return { value: v.value, sl: line.sl, en: line.en, focusSpan: line.focusSpan ?? null };
        }),
      }
    : null;
  return {
    id: id!,
    sl: n.sl,
    en: n.en,
    slowSL: n.slowSL ?? null,
    // Resolved here so the renderer never has to know a default: the node's own lead, else the profile's.
    captionLeadMs: n.captionDelayMs ?? pacing.captionLeadMs,
    focusSpan: n.focusSpan ?? null,
    glossPolicy: n.glossPolicy ?? "tap",
    // Each rung's timing resolved from the profile by position unless the rung overrides it.
    stallHandlers: (n.stallHandlers ?? []).map((h, i) => ({
      kind: h.kind,
      label: h.label ?? null,
      afterMs: h.afterMs ?? pacing.stallMs[i]!,
    })),
    // The Slovene never withdraws; the English does. The client node's own gloss policy rides along so
    // the surface can show the translation the first time the learner produces a line and hold it
    // after — the gloss is never dropped from the data, so a tap can always bring it back.
    prompt: client
      ? { sl: stem, en: client.en, glossPolicy: client.glossPolicy ?? "tap", focusSpan: client.focusSpan ?? null }
      : null,
    choice,
    // Whether this beat ends in a turn at all. A node that hands to another npc node is the character
    // carrying himself forward — the renderer plays it and continues rather than arming the button.
    handsOver: !!client,
    // A closing beat has nobody to hand the turn to. Without this the renderer armed the button anyway
    // and the run ended sitting on "Hold and say it" after the character had said goodbye.
    terminal: !n.next.length,
  };
}
