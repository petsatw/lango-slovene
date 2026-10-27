// Per-turn OBSERVABILITY log — the single most important diagnostic for the mastery loop.
// Every E2 turn (free chat, seed, scenario) appends one JSONL line holding the full TEXT in/out:
// the system prompt, the history, and the model's complete output (verbatim transcription, reply,
// correction, and the per-learnable credit verdicts). Text is logged IN FULL and kept.
//
// The input recording is never written: the row keeps its mime type and the marker "(not retained)".
// `sweepMedia` deletes any clip under media/ older than TURNLOG_MEDIA_TTL_MIN.
//
// Local-only: lives under the gitignored /assets/ next to learner.json. Best-effort by design — a
// logging failure is caught and never breaks a turn. Disable entirely with TURNLOG=0.

import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./store";
import * as retention from "./retention";

const DIR = process.env.TURNLOG_DIR || path.join(DATA_DIR, "turnlog");
const MEDIA_DIR = path.join(DIR, "media");
export const LOG_PATH = path.join(DIR, "turns.jsonl");
const MEDIA_TTL_MS = Math.max(0, Number(process.env.TURNLOG_MEDIA_TTL_MIN ?? 30)) * 60_000;
const ENABLED = process.env.TURNLOG !== "0";

let seq = 0;

export interface TurnLogInput {
  path: "free" | "seed" | "scenario" | "live";
  /** Did this session agree to its data being kept. `false` marks the row for the retention sweep,
   *  which empties its text and leaves the credit (server/assets/retention.ts). Omitted = kept. */
  retain?: boolean;
  /** Whose turn this is, the allowlisted code it came in on, and the sitting it belongs to. */
  learnerId: string;
  testerCode: string | null;
  sessionId?: string;
  runId?: string;
  level?: 1 | 2;
  scenarioId?: string;
  seedId?: string;
  provider: string;
  model?: string;
  e2Ms: number;
  systemPrompt: string;
  history: { role: string; text: string }[];
  // The input clip — only its mime type is kept in the line.
  audio?: { mimeType: string; base64?: string };
  // The model's full text output for the turn.
  output: {
    userVerbatim: string;
    userSaid: string;
    tutorReply: string;
    correction: string;
    learnableProgress: { id: string; result: string }[];
    objectiveProgress?: { id: string; result: string }[];
    focusObjectiveId?: string;
  };
  // Free-conversation witness evidence (the model↔server handoff) — the per-target linguistic facts the
  // model reported and the catalog candidates the server queued. Present only on free-chat turns.
  witness?: {
    utteranceLang: string;
    targets: Array<{
      id: string;
      produced: boolean;
      said: string | null;
      saidLang: string | null;
      correct: boolean;
      confidence: number;
    }>;
    observed: Array<{ surface: string; gloss: string }>;
    candidates: Array<{ surface: string; gloss: string }>;
  };
  // Live-session grading (server/live/grader.ts). One row per session rather than per turn: what the
  // grader read for every learnable the learner produced, and the lesson score over the lesson's own
  // targets.
  live?: {
    sessionId: string;
    lessonId: string;
    liveProvider: string;
    channels: Array<{
      id: string;
      inLesson: boolean;
      uptake: boolean;
      saidLine: number;
      correct: boolean;
      recast: boolean;
      said: string;
      saidLang: string;
      verdict: string;
    }>;
    lessonScore: { total: number; succeeded: string[]; attempted: string[] };
  };
  // Post-credit durable counts for exactly the ids credited this turn — so the log shows whether the
  // verdict bundled multiple items or moved one earned production.
  creditedCounts?: Record<string, { successes: number; attempts: number }>;
}

/** Delete media clips older than the TTL. Best-effort; called on every record and on startup. */
export function sweepMedia(now = Date.now()): void {
  if (MEDIA_TTL_MS <= 0) return;
  let names: string[];
  try {
    names = readdirSync(MEDIA_DIR);
  } catch {
    return; // dir not created yet — nothing to sweep
  }
  for (const name of names) {
    const f = path.join(MEDIA_DIR, name);
    try {
      if (now - statSync(f).mtimeMs > MEDIA_TTL_MS) unlinkSync(f);
    } catch {
      /* raced with another sweep or already gone — ignore */
    }
  }
}

/** Append one turn to the JSONL log. Never throws — observability must not break the turn loop. */
export function record(input: TurnLogInput): void {
  if (!ENABLED) return;
  try {
    mkdirSync(DIR, { recursive: true });
    sweepMedia();
    retention.sweep();

    const ts = new Date().toISOString();
    const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;

    // A recording of a voice is identifying on its own, so no clip is written.
    const audioRef = input.audio ? { file: "(not retained)", mimeType: input.audio.mimeType, bytes: 0 } : undefined;

    const line = {
      id,
      ts,
      path: input.path,
      learnerId: input.learnerId,
      testerCode: input.testerCode,
      sessionId: input.sessionId,
      runId: input.runId,
      ...(input.retain === false ? { retain: false } : {}),
      level: input.level,
      scenarioId: input.scenarioId,
      seedId: input.seedId,
      provider: input.provider,
      model: input.model,
      e2Ms: input.e2Ms,
      audio: audioRef,
      input: {
        systemPrompt: input.systemPrompt,
        history: input.history,
      },
      output: input.output,
      witness: input.witness,
      live: input.live,
      creditedCounts: input.creditedCounts,
    };

    appendFileSync(LOG_PATH, JSON.stringify(line) + "\n");
  } catch (err: any) {
    console.error("[turnlog] failed:", err?.message);
  }
}
