// E3 adapter — ElevenLabs (native-quality Slovenian TTS).
// Returns mp3 audio. Key sent as the xi-api-key header, server-side only.
//
// Voice profiles (provider-specific binding): a named, provider-agnostic voice profile from the
// catalog (female-speaker / male-speaker) is bound HERE to a concrete ElevenLabs voice id via env.
// `female-speaker` deliberately maps to the legacy ELEVENLABS_VOICE_ID so its voiceTag — and thus
// every existing teacher/target/narration audio key — is byte-identical to before the catalog.

import type { E3Adapter, E3Result } from "../types";
import { TEACHER_VOICE_PROFILE } from "../catalog";

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";

// profile id → the env var holding its concrete ElevenLabs voice id. female-speaker = the legacy var
// (keeps existing keys); add a row + env var to introduce a new profile's voice.
const PROFILE_ENV: Record<string, string> = {
  "female-speaker": "ELEVENLABS_VOICE_ID",
  "male-speaker": "ELEVENLABS_VOICE_ID_MALE",
};

function requireKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set (see docs/SECRETS.md)");
  return key;
}

export class ElevenLabsE3 implements E3Adapter {
  readonly name = "elevenlabs";
  // Slovenian (slv) is only covered by eleven_v3 — multilingual_v2 / flash_v2_5 do NOT list it.
  private modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

  /** Concrete ElevenLabs voice id for a profile (default: the teacher voice). "" if its env is unset. */
  private voiceIdFor(voiceProfile: string = TEACHER_VOICE_PROFILE): string {
    const envVar = PROFILE_ENV[voiceProfile];
    if (!envVar) throw new Error(`No ElevenLabs voice binding for profile "${voiceProfile}" (add it to PROFILE_ENV)`);
    return process.env[envVar] || "";
  }

  /** Cache-key tag for a profile — `${voiceId}:${modelId}`. Omit → teacher voice (legacy tag). */
  voiceTagFor(voiceProfile?: string): string {
    return `${this.voiceIdFor(voiceProfile)}:${this.modelId}`;
  }

  get voiceTag(): string {
    return this.voiceTagFor();
  }

  async synthesize(input: { text: string; voiceProfile?: string }): Promise<E3Result> {
    const key = requireKey();
    const voiceId = this.voiceIdFor(input.voiceProfile);
    if (!voiceId) throw new Error(`No ElevenLabs voice id set for profile "${input.voiceProfile ?? TEACHER_VOICE_PROFILE}" (set ${PROFILE_ENV[input.voiceProfile ?? TEACHER_VOICE_PROFILE]})`);

    const res = await fetch(`${BASE}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: this.modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs HTTP ${res.status}: ${body.slice(0, 300)}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    return { audioBase64: buf.toString("base64"), mimeType: "audio/mpeg" };
  }

  // Level 1 streaming: progressive mp3 chunks so the client can start playback on the first chunk.
  async stream(input: { text: string; voiceProfile?: string }): Promise<ReadableStream<Uint8Array>> {
    const key = requireKey();
    const voiceId = this.voiceIdFor(input.voiceProfile);
    if (!voiceId) throw new Error(`No ElevenLabs voice id set for profile "${input.voiceProfile ?? TEACHER_VOICE_PROFILE}" (set ${PROFILE_ENV[input.voiceProfile ?? TEACHER_VOICE_PROFILE]})`);

    const res = await fetch(`${BASE}/${voiceId}/stream`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: input.text,
        model_id: this.modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ElevenLabs stream HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    if (!res.body) throw new Error("ElevenLabs stream returned no body");
    return res.body;
  }
}
