// Per-turn OBSERVABILITY log — the single most important diagnostic for the mastery loop.
// Every E2 turn (free chat, seed, scenario) appends one JSONL line holding the full TEXT in/out:
// the system prompt, the history, and the model's complete output (verbatim transcription, reply,
// correction, and the per-learnable credit verdicts). Text is logged IN FULL and kept.
//
// The resource-heavy AUDIO clip (the input recording) is written alongside under media/ but SWEPT on
// a short TTL (TURNLOG_MEDIA_TTL_MIN, default 30 min) so the log stays light — the JSONL keeps only a
// pointer + byte size, never the bytes inline.
//
// Local-only: lives under the gitignored /assets/ next to learner.json. Best-effort by design — a
// logging failure is caught and never breaks a turn. Disable entirely with TURNLOG=0.

import { appendFileSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";

const DIR = process.env.TURNLOG_DIR || path.join(ASSET_DIR, "turnlog");
const MEDIA_DIR = path.join(DIR, "media");
export const LOG_PATH = path.join(DIR, "turns.jsonl");
const MEDIA_TTL_MS = Math.max(0, Number(process.env.TURNLOG_MEDIA_TTL_MIN ?? 30)) * 60_000;
const ENABLED = process.env.TURNLOG !== "0";

let seq = 0;

const EXT: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export interface TurnLogInput {
  path: "free" | "seed" | "scenario";
  level?: 1 | 2;
  scenarioId?: string;
  seedId?: string;
  provider: string;
  model?: string;
  e2Ms: number;
  systemPrompt: string;
  history: { role: string; text: string }[];
  // The heavy input clip — bytes are persisted to media/ (swept), only a pointer is kept in the line.
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

    const ts = new Date().toISOString();
    const id = `${Date.now().toString(36)}-${(seq++).toString(36)}`;

    let audioRef: { file: string; mimeType: string; bytes: number } | undefined;
    if (input.audio?.base64 && MEDIA_TTL_MS > 0) {
      try {
        mkdirSync(MEDIA_DIR, { recursive: true });
        const ext = EXT[input.audio.mimeType] ?? "bin";
        const buf = Buffer.from(input.audio.base64, "base64");
        const file = `${id}.${ext}`;
        writeFileSync(path.join(MEDIA_DIR, file), buf);
        audioRef = { file: path.join("media", file), mimeType: input.audio.mimeType, bytes: buf.length };
      } catch (mediaErr: any) {
        // The text record still goes out even if the clip couldn't be written.
        audioRef = { file: "(write failed)", mimeType: input.audio.mimeType, bytes: 0 };
      }
    } else if (input.audio) {
      audioRef = { file: "(not retained)", mimeType: input.audio.mimeType, bytes: 0 };
    }

    const line = {
      id,
      ts,
      path: input.path,
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
      creditedCounts: input.creditedCounts,
    };

    appendFileSync(LOG_PATH, JSON.stringify(line) + "\n");
  } catch (err: any) {
    console.error("[turnlog] failed:", err?.message);
  }
}
