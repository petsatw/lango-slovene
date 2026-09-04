// Shared types and the two swappable adapter contracts (E2, E3).
// Swapping a provider = implementing one of these interfaces. Nothing else changes.

export interface ConversationTurn {
  role: "user" | "tutor";
  text: string;
}

// ---- Mastery loop: objectives & session state ----

export type ObjectiveStatus = "pending" | "recast" | "completed";

/** A micro-objective the student should learn to PRODUCE in a scenario. */
export interface Objective {
  id: string;
  label: string; // short English label for the UI dot
  targetSL: string; // canonical correct Slovenian the student should produce (default/primary line)
  hintEN: string; // internal guidance for the model — never lectured to the student
  /** Catalog learnable ids this objective exercises (carrier pattern + fillers). Optional: a scenario
   *  without it keeps today's behaviour exactly (no durable mastery for that objective). See
   *  docs/learnable-subsystem-spec.md §2.2. */
  learnables?: string[];
  /** Per-filler full inflected target line, keyed by the filler learnable id, e.g.
   *  { "kava": "Eno kavo, prosim.", "voda": "Eno vodo, prosim." }. The single-filler case omits this
   *  and presentation falls back to targetSL. */
  fillerLines?: Record<string, string>;
}

export interface ObjectiveState {
  id: string;
  status: ObjectiveStatus;
  attempts: number;
}

export interface SessionState {
  scenarioId: string;
  objectives: ObjectiveState[];
  complete: boolean;
  turns: number;
}

/** The model's per-turn verdict on an objective the student addressed. */
export type TurnVerdict = "completed" | "attempted";
export interface ObjectiveProgress {
  id: string;
  result: TurnVerdict;
}

// ---- Mastery loop: the durable LEARNABLE layer (cross-session) ----

/** The model's per-turn verdict on a LEARNABLE the student exercised — the durable mastery layer.
 *  "success" = produced understandably AND correctly AND without needing a recast; "attempt" = anything
 *  less. The model reports only learnables the student actually addressed; the server owns all durable
 *  rules (threshold, flub) and tells the model nothing about stored state. */
export type LearnableResult = "success" | "attempt";
export interface LearnableProgress {
  id: string;
  result: LearnableResult;
}

/** Per-learnable durable counts. Status is DERIVED, never stored: absent ⇒ unseen; successes ≥ threshold
 *  ⇒ mastered; otherwise attempted (shaky/due). */
export interface LearnableMastery {
  attempts: number; // rises on every swing (success or fail)
  successes: number; // rises only on a successful production; mastery measures this
}

/** The whole learner model — one durable, local, single-learner model (assets/learner.json).
 *
 *  Two kinds of knowledge live here and stay separate. `learnables` is what the learner can SAY, earned
 *  on the mic. `facts` is what the learner IS — the answers the language needs before it can address them
 *  or put words in their mouth (server/facts.ts). A fact is given once, by the learner, at a beat that
 *  asks for it; nothing infers one.
 *
 *  BOTH fields are rebuilt by hand in `learner.load`/`learner.save` (assets/learner.ts). Adding a third
 *  means editing those two functions as well as this interface — the field would otherwise round-trip to
 *  undefined with nothing raised. */
export interface LearnerModel {
  learnables: Record<string, LearnableMastery>;
  /** fact id → the stored answer, e.g. `{ gender: "f" }`. Present once the learner has answered one. */
  facts: Record<string, string>;
  updatedAt: string; // ISO
}

// ---- Free conversation: the WITNESS contract (model = blind linguistic reporter, server owns credit) ----
// The server hands the model a bounded in-play TARGET set + a FAMILIAR palette; the model holds the
// conversation in-bounds and reports linguistic EVIDENCE (what the learner said, in which language,
// whether each target was produced correctly). The model knows nothing about counts/thresholds/credit.
// All crediting is deterministic and server-side (see mastery.creditFromEvidence).

/** One in-play target the server asks the model to watch for (SERVER → MODEL). */
export interface WitnessTarget {
  id: string;
  kind: string; // vocabulary | chunk | pattern
  sl: string; // canonical Slovene (frame with "___" for patterns)
  gloss: string;
}

/** The model's per-target evidence for one turn (MODEL → SERVER). Facts only — no crediting. */
export interface TargetEvidence {
  id: string;
  produced: boolean; // did the learner actually say this target this turn (echo counts)
  said: string | null; // the exact slice of the verbatim transcript, or null
  saidLang: string | null; // language of that slice: "sl" | "en" | "other"
  correct: boolean; // understandable, correct Slovene (any case/gender/number is fine)
  confidence: number; // 0..1
}

/** Any other Slovene the learner produced that wasn't a target — the catalog-growth signal. */
export interface ObservedItem {
  surface: string;
  gloss: string;
}

/** The full witness turn (MODEL → SERVER). */
export interface WitnessResult {
  reply: string; // the tutor's short Slovene reply (spoken by E3)
  replyGloss: string; // plain-English translation of `reply` — the on-demand subtitle
  transcriptVerbatim: string; // exactly what the learner said, warts and all
  userGloss: string; // plain-English translation of what the learner meant
  utteranceLang: string; // "sl" | "en" | "mixed"
  targets: TargetEvidence[];
  observed: ObservedItem[];
  /** Free-chat role the tutor is playing — a short Slovene noun phrase (e.g. "natakarica"), or null
   *  for the default plain language tutor. The model chooses this on the FIRST real turn (when the
   *  server passes no pinned role) and the server pins it for the rest of the session. */
  role?: string | null;
}

/** E2 — audio understanding + in-character tutoring (one model, one hop). */
export interface E2Result {
  /** EXACTLY what the student said, as the model heard it — unsanitized, errors/code-switching preserved. */
  userVerbatim: string;
  /** The English interpretation of what the learner meant. */
  userSaid: string;
  /** The tutor's reply in Slovenian — this is the text that gets spoken by E3. */
  tutorReply: string;
  /** Brief note on what was gently corrected (shown in overlay; the recast itself lives in tutorReply). */
  correction: string;
  /** Per-objective verdict for THIS turn — the model's read of what the student produced (SCENE layer). */
  objectiveProgress: ObjectiveProgress[];
  /** Per-learnable verdict for THIS turn — drives the durable MASTERY layer. Empty when the scenario
   *  authors no learnables (back-compat) or in non-scenario modes that exercise none. */
  learnableProgress: LearnableProgress[];
  /** The objective the tutor is now steering toward. */
  focusObjectiveId: string;
}

export interface E2Adapter {
  readonly name: string;
  understand(input: {
    audioBase64: string;
    mimeType: string;
    systemPrompt: string;
    history: ConversationTurn[];
  }): Promise<E2Result>;
  /** Free-conversation WITNESS turn (mastery loop): holds the chat + returns linguistic EVIDENCE over a
   *  server-supplied target set, deciding no credit. Optional so non-conversation adapters (scripted
   *  seed) can omit it. */
  witness?(input: {
    audioBase64: string;
    mimeType: string;
    systemPrompt: string;
    history: ConversationTurn[];
  }): Promise<WitnessResult>;
  /** One Slovene line → a short plain-English gloss. Text only, no audio, no evidence — the tap-to-
   *  reveal translation on a LIVE transcript, where there is no JSON turn to carry a gloss back.
   *  Optional so adapters without a text path can omit it. */
  gloss?(sl: string): Promise<string>;
  /** Cheap credential/endpoint check used by `npm run probe:e2`. Must NOT log the key. */
  ping(): Promise<string>;
}

/** E3 — native-quality Slovenian text-to-speech. */
export interface E3Result {
  audioBase64: string;
  mimeType: string;
}

export interface E3Adapter {
  readonly name: string;
  /** Stable cache-key tag for the TEACHER/default voice profile — part of the audio cache key, so a
   *  voice/model change doesn't replay stale audio. Equals `voiceTagFor(teacherProfile)`. */
  readonly voiceTag: string;
  /** Cache-key tag for a NAMED voice profile (e.g. "male-speaker"). Audio reuse keys by the speaker's
   *  voice profile: the same text in two profiles is two distinct clips. Omit → the teacher voice. */
  voiceTagFor(voiceProfile?: string): string;
  /** Full-buffer synthesis — used by probes and the replay harness. `voiceProfile` omitted → teacher.
   *  `speed` is an optional provider-side rate control (<1 slower). It is deliberately NOT part of the
   *  audio cache key: the client asks for a clip by (text, voice) alone, so a key carrying speed could
   *  never be found again. Consequence: changing the speed of an already-built clip needs a --regen. */
  synthesize(input: { text: string; voiceProfile?: string; speed?: number }): Promise<E3Result>;
  /** Progressive streaming synthesis (Level 1) — returns a web ReadableStream of audio bytes.
   *  Optional: providers without streaming fall back to synthesize(). `voiceProfile` omitted → teacher. */
  stream?(input: { text: string; voiceProfile?: string }): Promise<ReadableStream<Uint8Array>>;
}

/** M2 — pluggable image generation. Swapping providers = implementing this, exactly like E2/E3. */
export interface ImageResult {
  bytes: Buffer;
  mimeType: string; // e.g. "image/png"
}

export interface ImageAdapter {
  readonly name: string;
  /** Stable model identifier — part of the image cache key, so a model change is a distinct asset. */
  readonly model: string;
  /** Generate one image. `aspectRatio`/`resolution` are explicit typed args (not prose — the model
   *  can ignore prose, not an API field). `referenceImages` are ≤3 anchors (URL / base64 data URI /
   *  file_id) that pin character/setting consistency. `params` carries any extra provider knobs. */
  generate(input: {
    prompt: string;
    aspectRatio?: string;
    resolution?: string;
    referenceImages?: string[];
    params?: Record<string, unknown>;
  }): Promise<ImageResult>;
}

/** E2-only result — what /api/turn returns now that audio streams separately via /api/speak. */
export interface UnderstandResult {
  userVerbatim: string;
  userSaid: string;
  tutorReply: string;
  correction: string;
  session: SessionState; // updated after the deterministic SCENE rules
  /** Per-learnable verdicts the model returned this turn (already credited to the durable model). */
  learnableProgress: LearnableProgress[];
  timings: { e2Ms: number };
  providers: { e2: string };
}

/** Free-conversation turn result (spec §3.5) — no scenario, no objectives, no session; the same
 *  per-learnable verdict drives the durable mastery layer. */
export interface ConverseResult {
  userVerbatim: string;
  userSaid: string;
  tutorReply: string;
  /** Plain-English translation of the Slovene reply — the click-to-reveal subtitle (free chat). */
  replyGloss?: string;
  correction: string;
  learnableProgress: LearnableProgress[];
  /** Free chat only: the role the tutor is playing (short Slovene noun phrase), or null for a plain
   *  tutor. The client pins the first non-null value and POSTs it back each turn so the role holds. */
  role?: string | null;
  /** Seed onboarding only: true once the scripted dialogue has finished its last step. */
  seedDone?: boolean;
  timings: { e2Ms: number };
  providers: { e2: string };
}

/** What the orchestrator returns for one full (non-streaming) turn — used by the replay harness. */
export interface TurnResult {
  userSaid: string;
  tutorReply: string;
  correction: string;
  audio: E3Result;
  timings: { e2Ms: number; e3Ms: number; totalMs: number };
  providers: { e2: string; e3: string };
}
