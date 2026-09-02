// Grok Voice (xAI Realtime) behind the LiveAdapter seam.
//
// Verified against docs.x.ai (Speech to Speech / Voice Agent), Sept 2026:
//   socket   wss://api.x.ai/v1/realtime?model=<model>, Authorization: Bearer <key> on THIS hop only
//   config   one `session.update`, acknowledged by `session.updated`
//   up       `input_audio_buffer.append` with base64 PCM
//   down     `response.output_audio.delta` (also seen as `response.audio.delta`)
//
// Two things the provider brief got slightly wrong, corrected here:
//   1. The audio format is a nested object (`{"type":"audio/pcm","rate":N}`), not a flat `"pcm16"`,
//      and 16000 is an ACCEPTED input rate — so we declare 16 kHz in / 24 kHz out and no resampling
//      happens anywhere. The brief's "resample 16k → 24k in this adapter" is unnecessary.
//   2. Transcripts do not arrive as one event pair. The user's is CUMULATIVE (each update restates the
//      whole utterance), the tutor's is a delta stream. Both are buffered here and emitted once, so the
//      session log holds one line per utterance rather than a hundred partials.

import WebSocket from "ws";
import type { LiveAdapter, LiveCallbacks } from "../types";

const MODEL = process.env.XAI_MODEL || "grok-voice-think-fast-2.0";
const VOICE = process.env.XAI_VOICE || "eve";

export class GrokAdapter implements LiveAdapter {
  readonly provider = "grok" as const;
  private ws: WebSocket | null = null;
  private ready = false;
  private closed = false;
  /** Mic frames that arrived before `session.updated`. Both vendors drop pre-setup audio, and the
   *  learner is already holding the button by then, so we hold rather than lose them. */
  private queue: Buffer[] = [];
  /** The tutor's turn counter — Grok's response events carry no id we can use as one. */
  private turn = 0;
  private tutorText = "";
  /** The Slovene language hint is best-effort; if xAI rejects the code we retry once without it. */
  private hintDropped = false;

  constructor(private cb: LiveCallbacks) {}

  connect(_sessionId: string, instructions: string): Promise<void> {
    // Same vendor account as E4 image generation, which already has a key under GROK_API_KEY. A
    // dedicated XAI_API_KEY wins if it is set — a separate key is how you meter voice apart from
    // images — but a single-key setup should not have to duplicate itself to turn the tutor on.
    const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
    if (!key) return Promise.reject(new Error("XAI_API_KEY / GROK_API_KEY is not set"));

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${encodeURIComponent(MODEL)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      this.ws = ws;

      let settled = false;
      const fail = (code: "vendor_connect" | "vendor_setup", err: Error) => {
        if (settled) return;
        settled = true;
        this.cb.onError(code);
        reject(err);
      };

      ws.on("open", () => this.sendSessionUpdate(instructions));

      ws.on("message", (raw, isBinary) => {
        if (isBinary) return; // we asked for JSON transport; binary here would be unexpected
        let evt: any;
        try {
          evt = JSON.parse(raw.toString());
        } catch {
          return;
        }

        if (evt.type === "session.updated") {
          this.ready = true;
          for (const b of this.queue) this.pushAudio(b);
          this.queue = [];
          this.cb.onState("connected");
          if (!settled) {
            settled = true;
            resolve();
          }
          return;
        }

        if (evt.type === "error") {
          // A rejected language hint is recoverable and worth recovering from: the Slovene-only
          // instruction carries the lesson either way, but transcription quality is what we score.
          if (!this.ready && !this.hintDropped) {
            this.hintDropped = true;
            this.sendSessionUpdate(instructions);
            return;
          }
          if (!this.ready) return fail("vendor_setup", new Error("session.update rejected"));
          this.cb.onError("vendor_audio");
          return;
        }

        this.handleEvent(evt);
      });

      ws.on("error", (err) => {
        if (!settled) return fail("vendor_connect", err as Error);
        if (!this.closed) this.cb.onError("vendor_audio");
      });

      ws.on("close", () => {
        this.emitTutor(true);
        this.cb.onState("ended");
        if (!settled) fail("vendor_connect", new Error("xAI socket closed before setup"));
      });
    });
  }

  private sendSessionUpdate(instructions: string): void {
    const transcription: Record<string, unknown> = {};
    if (!this.hintDropped) transcription.language_hint = "sl";
    this.send({
      type: "session.update",
      session: {
        instructions,
        voice: VOICE,
        turn_detection: { type: "server_vad" },
        audio: {
          input: {
            format: { type: "audio/pcm", rate: 16000 },
            transport: "json",
            transcription,
          },
          output: { format: { type: "audio/pcm", rate: 24000 }, transport: "json" },
        },
      },
    });
  }

  private handleEvent(evt: any): void {
    switch (evt.type) {
      case "response.output_audio.delta":
      case "response.audio.delta": {
        const b64 = evt.delta ?? evt.audio;
        if (typeof b64 === "string" && b64) {
          this.cb.onState("speaking");
          this.cb.onAudio(Buffer.from(b64, "base64"));
        }
        return;
      }

      // The user's transcript restates itself as it firms up. Every restatement is forwarded under the
      // SAME id, so the screen and the log show the finished sentence rather than the first guess at it.
      case "conversation.item.input_audio_transcription.updated": {
        const text = evt.transcript ?? evt.text;
        if (typeof text === "string" && text.trim()) {
          this.cb.onTranscript("user", text.trim(), `u:${evt.item_id ?? "user"}`, false);
        }
        return;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const text = evt.transcript ?? evt.text;
        if (typeof text === "string" && text.trim()) {
          this.cb.onTranscript("user", text.trim(), `u:${evt.item_id ?? "user"}`, true);
        }
        return;
      }

      // The tutor's own words. The first real session logged NONE of these, so the names below are a
      // net rather than a guess — xAI documents `response.text.*`, and the OpenAI-compatible surface
      // it mirrors uses `response.audio_transcript.*` for the spoken half. Unknown events are logged
      // under LIVE_DEBUG so the next miss names itself instead of vanishing.
      case "response.text.delta":
      case "response.output_text.delta":
      case "response.audio_transcript.delta":
      case "response.output_audio_transcript.delta": {
        const d = evt.delta ?? evt.text;
        if (typeof d === "string") {
          this.tutorText += d;
          this.emitTutor(false);
        }
        return;
      }
      case "response.text.done":
      case "response.output_text.done":
      case "response.audio_transcript.done":
      case "response.output_audio_transcript.done": {
        const t = evt.text ?? evt.transcript;
        if (typeof t === "string") this.tutorText = t;
        this.emitTutor(true);
        return;
      }

      case "response.created":
        this.turn++;
        this.tutorText = "";
        return;

      case "response.done":
        this.emitTutor(true);
        this.tutorText = "";
        // Generation is finished. This is NOT "playback finished" — the client must not stop speaking
        // on it, and does not.
        this.cb.onState("listening");
        return;

      default:
        if (process.env.LIVE_DEBUG) console.log(`[live/grok] unhandled event: ${evt.type}`);
    }
  }

  private emitTutor(final: boolean): void {
    const t = this.tutorText.trim();
    if (t) this.cb.onTranscript("tutor", t, `t:${this.turn}`, final);
  }

  sendPcm16(bytes: Buffer): void {
    if (this.closed) return;
    if (!this.ready) {
      this.queue.push(bytes);
      return;
    }
    this.pushAudio(bytes);
  }

  private pushAudio(bytes: Buffer): void {
    this.send({ type: "input_audio_buffer.append", audio: bytes.toString("base64") });
  }

  private send(msg: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.closed = true;
    this.queue = [];
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.ws = null;
  }
}
