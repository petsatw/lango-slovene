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
  targetSL: string; // canonical correct Slovenian the student should produce
  hintEN: string; // internal guidance for the model — never lectured to the student
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
  /** Per-objective verdict for THIS turn — the model's read of what the student produced. */
  objectiveProgress: ObjectiveProgress[];
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
  /** Stable identifier of the current voice/model config — part of the audio cache key, so a
   *  voice/model change doesn't replay stale audio. */
  readonly voiceTag: string;
  /** Full-buffer synthesis — used by probes and the replay harness. */
  synthesize(input: { text: string }): Promise<E3Result>;
  /** Progressive streaming synthesis (Level 1) — returns a web ReadableStream of audio bytes.
   *  Optional: providers without streaming fall back to synthesize(). */
  stream?(input: { text: string }): Promise<ReadableStream<Uint8Array>>;
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
  /** Generate one image from a (style-prefixed) prompt. params carries provider-specific knobs. */
  generate(input: { prompt: string; params?: Record<string, unknown> }): Promise<ImageResult>;
}

/** E2-only result — what /api/turn returns now that audio streams separately via /api/speak. */
export interface UnderstandResult {
  userVerbatim: string;
  userSaid: string;
  tutorReply: string;
  correction: string;
  session: SessionState; // updated after the deterministic mastery rules
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
