// E3 adapter — ElevenLabs (native-quality Slovenian TTS).
// Returns mp3 audio. Key sent as the xi-api-key header, server-side only.

import type { E3Adapter, E3Result } from "../types";

const BASE = "https://api.elevenlabs.io/v1/text-to-speech";

function requireKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set (see docs/SECRETS.md)");
  return key;
}

export class ElevenLabsE3 implements E3Adapter {
  readonly name = "elevenlabs";
  private voiceId = process.env.ELEVENLABS_VOICE_ID || "";
  // Slovenian (slv) is only covered by eleven_v3 — multilingual_v2 / flash_v2_5 do NOT list it.
  private modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_v3";

  get voiceTag(): string {
    return `${this.voiceId}:${this.modelId}`;
  }

  async synthesize(input: { text: string }): Promise<E3Result> {
    const key = requireKey();
    if (!this.voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set (pick a Slovenian voice)");

    const res = await fetch(`${BASE}/${this.voiceId}`, {
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
  async stream(input: { text: string }): Promise<ReadableStream<Uint8Array>> {
    const key = requireKey();
    if (!this.voiceId) throw new Error("ELEVENLABS_VOICE_ID is not set (pick a Slovenian voice)");

    const res = await fetch(`${BASE}/${this.voiceId}/stream`, {
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
