// PACING — the timing of a spoken lesson, as named server-owned data.
//
// A spoken scene is a sequence of engineered SILENCES as much as a sequence of lines: how long a line
// is allowed to be sound before it becomes text, how long the plain caption sits before it breaks into
// chunks, how long the learner gets to think before the character fills the gap. Those are teaching
// decisions (invariant: the app owns the pedagogy), and they are the difference between a beat that
// lands and one that reads as a hang.
//
// They used to be three different things at once — magic numbers in the renderer, per-node authored
// fields, and the implicit duration of whatever audio happened to come back. That is why they drifted:
// there was nowhere to look to answer "how is this lesson paced?". Now there is exactly one place.
//
// A dialogue names a profile; a node may override a single value where one beat genuinely needs it
// (`captionDelayMs`). Withdrawing scaffolding across a course is then a profile swap, not a renderer
// change and not a re-authoring pass.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export interface PacingProfile {
  /** Human label — why this profile exists. Never shown to the learner. */
  label: string;

  // ---- The English on-ramp (frameEN), before any Slovene -----------------------------------------
  /** Base dwell for each on-ramp line before the next arrives. */
  frameLineMs: number;
  /** Added to `frameLineMs` per CHARACTER of the line. These sentences are the first thing a learner
   *  ever reads and they are not the same length; a fixed dwell either rushes the long one or strands
   *  the short one. Reading time scales with the text, so the timing does too. */
  frameCharMs: number;
  /** Hold after the last on-ramp line before the whole frame fades. */
  frameHoldMs: number;
  /** The frame's fade-out, before the first character line begins. */
  frameFadeMs: number;

  // ---- One character beat ------------------------------------------------------------------------
  /** How long the caption is on screen BEFORE its audio starts. 0 (the default everywhere) means the
   *  text and the voice arrive together, which is what a learner expects: seeing a sentence appear and
   *  hearing it spoken are one event. This used to be the opposite — the renderer awaited the whole clip
   *  and only then set the caption, so the text always trailed the speech by the length of the line and
   *  the two never lined up. A node's own `captionDelayMs` overrides this. */
  captionLeadMs: number;
  /** How long the plain caption sits before the chunked-slow re-speak takes over. The caption has to be
   *  readable WHOLE before it breaks apart, or the "appears, then re-speaks" beat collapses. */
  captionReadMs: number;
  /** After the slow re-speak ends, before the English gloss appears. Slovene first, English confirming. */
  glossDelayMs: number;
  /** After the gloss, before the turn is handed over (the button and the prompt appear). The pause that
   *  makes the hand-over read as an offer rather than a cue. */
  handoverMs: number;
  /** How long the CLOSING line is left on screen before the run ends. A goodbye needs a moment to land,
   *  but nothing is being asked for — the button must not invite a turn that does not exist. */
  closeHoldMs: number;

  // ---- The learner's turn ------------------------------------------------------------------------
  /** How long the character's backchannel ("Mhm.") is protected from being cut off by the next line.
   *  Without this the next beat's audio stops it within ~50ms and the instant-acknowledgement beat —
   *  the whole reason the clip is cached — never actually reaches the learner. */
  backchannelMs: number;
  /** The quiet-learner ladder, in milliseconds FROM THE LEARNER'S TURN OPENING (not from the start of
   *  the run). One entry per rung, strictly ascending; a node's stall handlers take their timing from
   *  this array by position. Keeping the numbers here rather than on every node is what stops each new
   *  lesson from re-inventing (and mis-transcribing) the ladder. */
  stallMs: number[];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACING_FILE = path.join(__dirname, "catalog", "pacing.json");

const MS_FIELDS = [
  "frameLineMs", "frameCharMs", "frameHoldMs", "frameFadeMs",
  "captionLeadMs", "captionReadMs", "glossDelayMs", "handoverMs", "closeHoldMs", "backchannelMs",
] as const;

function fail(msg: string): never {
  throw new Error(`Invalid pacing.json: ${msg}`);
}

function validateProfile(id: string, raw: any): PacingProfile {
  if (!raw || typeof raw !== "object") fail(`profile "${id}" is not an object`);
  if (typeof raw.label !== "string" || !raw.label) fail(`profile "${id}": "label" must be a non-empty string`);
  for (const f of MS_FIELDS) {
    const v = raw[f];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
      fail(`profile "${id}": "${f}" must be a non-negative number of milliseconds`);
  }
  if (!Array.isArray(raw.stallMs) || !raw.stallMs.length)
    fail(`profile "${id}": "stallMs" must be a non-empty array of milliseconds`);
  let prev = 0;
  for (const [i, ms] of raw.stallMs.entries()) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0)
      fail(`profile "${id}": stallMs[${i}] must be a positive number of milliseconds`);
    if (ms <= prev) fail(`profile "${id}": stallMs[${i}] (${ms}) must be greater than the previous rung (${prev})`);
    prev = ms;
  }
  return raw as PacingProfile;
}

function load(): Record<string, PacingProfile> {
  const raw = JSON.parse(readFileSync(PACING_FILE, "utf8"));
  const profiles = raw?.profiles;
  if (!profiles || typeof profiles !== "object" || !Object.keys(profiles).length)
    fail(`"profiles" must be a non-empty object`);
  const out: Record<string, PacingProfile> = {};
  for (const [id, p] of Object.entries(profiles)) out[id] = validateProfile(id, p);
  return out;
}

/** Every pacing profile, validated once at startup. */
export const PACING: Record<string, PacingProfile> = load();

/** The profile a dialogue with no explicit `pacing` gets. The most generous one: a lesson that has not
 *  said how it wants to be paced is safer slow than fast. */
export const DEFAULT_PACING = "onboarding";

export function pacingFor(id: string | undefined): PacingProfile {
  const profile = PACING[id ?? DEFAULT_PACING];
  if (!profile) throw new Error(`Unknown pacing profile "${id}"`);
  return profile;
}
