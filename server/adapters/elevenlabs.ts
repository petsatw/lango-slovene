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
  "shop-assistant": "ELEVENLABS_VOICE_ID_SHOP_ASSISTANT",
  // Slavko shares male-speaker's binding on purpose: he IS the voice the restaurant client already
  // speaks in, so every clip already synthesized for him stays a cache hit (the key is the voice ID,
  // not the profile name). Giving him his own env var later re-keys all of his audio.
  slavko: "ELEVENLABS_VOICE_ID_MALE",
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

  async synthesize(input: { text: string; voiceProfile?: string; speed?: number }): Promise<E3Result> {
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
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          // Provider-side rate control, 0.7–1.2 (1.0 = default). Sent only when asked for; v3's support
          // for it is undocumented, so the slow-clip path pairs it with a [slower] audio tag, which the
          // v3 prompting guide names as its pacing lever.
          ...(input.speed !== undefined ? { speed: input.speed } : {}),
        },
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

// ---- Forced alignment — a MEASUREMENT of audio we already own, never a generation -------------------
//
// POST /v1/forced-alignment, multipart `file` + `text`. It reports where each word falls in an mp3 that
// already exists; it synthesizes nothing, re-rolls nothing, and costs nothing in TTS credits (it bills at
// Speech-to-Text rates — $0.22 per HOUR of audio, so a scenario's worth of clips is a fraction of a cent).
//
// It is deliberately NOT part of the E3Adapter interface. E3 is "turn text into speech", provider-agnostic;
// this is an ElevenLabs-specific instrument that the alignment build reaches for directly, after asserting
// the configured E3 is in fact ElevenLabs. Adding it to the interface would oblige every future provider
// to have an endpoint most of them don't.
//
// The alternative endpoint — /text-to-speech with `with-timestamps` — returns alignment too, but only for
// audio IT generates: using it would re-synthesize and re-bill every approved clip, and the new bytes
// would not even be the ones on disk. Forced alignment touches nothing.

const ALIGN_URL = "https://api.elevenlabs.io/v1/forced-alignment";

export interface ForcedAlignmentResult {
  words: Array<{ text: string; start: number; end: number; loss?: number }>;
  loss?: number;
}

/** Align `text` against `mp3`, returning per-word start/end in SECONDS. `text` must be the words actually
 *  spoken — the clean caption, never a delivery-tagged variant, whose "[hesitant]" is not in the audio. */
export async function forcedAlign(mp3: Buffer, text: string): Promise<ForcedAlignmentResult> {
  const key = requireKey();
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  form.append("text", text); // plain string only — the API rejects JSON-wrapped input

  const res = await fetch(ALIGN_URL, { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs forced-alignment HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const json: any = await res.json();
  if (!Array.isArray(json?.words) || !json.words.length)
    throw new Error(`ElevenLabs forced-alignment returned no words for "${text.slice(0, 60)}"`);
  return {
    // The API interleaves WHITESPACE tokens between the real words — "Se", " ", "spomniš?", " ", … — so a
    // four-word line comes back as seven entries. Those are dropped here, and dropping them is the whole
    // reason this returns a shaped result rather than the raw JSON: the indices downstream are chosen by a
    // human-reviewed judgment ("play words 2–3"), and an index that counts the gaps is unreviewable.
    //
    // Nothing is lost by it. A gap token's span is exactly the silence between two words, and a cut wants
    // the word boundaries — the previous word's `end`, the next word's `start` — not the pause between.
    //
    // `characters` comes back too and is an order of magnitude larger; nothing downstream cuts below a word
    // boundary, so it is dropped rather than stored.
    words: json.words
      .filter((w: any) => String(w.text).trim().length > 0)
      .map((w: any) => ({ text: String(w.text), start: Number(w.start), end: Number(w.end), ...(typeof w.loss === "number" ? { loss: w.loss } : {}) })),
    ...(typeof json.loss === "number" ? { loss: json.loss } : {}),
  };
}
