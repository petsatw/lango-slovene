// Adapter registry — the swap point. E2_PROVIDER / E3_PROVIDER env vars choose the
// implementation. To run the blind A/B across providers, add a class here and flip the env var.

import type { E2Adapter, E3Adapter, ImageAdapter } from "../types";
import { GeminiE2 } from "./gemini";
import { ElevenLabsE3 } from "./elevenlabs";

const E2_REGISTRY: Record<string, () => E2Adapter> = {
  gemini: () => new GeminiE2(),
  // grok:   () => new GrokE2(),   // add for A/B
  // openai: () => new OpenAIE2(),
};

const E3_REGISTRY: Record<string, () => E3Adapter> = {
  elevenlabs: () => new ElevenLabsE3(),
  // google: () => new GoogleChirpE3(),  // add for A/B
  // azure:  () => new AzureE3(),
};

export function getE2(): E2Adapter {
  const name = (process.env.E2_PROVIDER || "gemini").toLowerCase();
  const make = E2_REGISTRY[name];
  if (!make) throw new Error(`Unknown E2_PROVIDER "${name}". Known: ${Object.keys(E2_REGISTRY).join(", ")}`);
  return make();
}

export function getE3(): E3Adapter {
  const name = (process.env.E3_PROVIDER || "elevenlabs").toLowerCase();
  const make = E3_REGISTRY[name];
  if (!make) throw new Error(`Unknown E3_PROVIDER "${name}". Known: ${Object.keys(E3_REGISTRY).join(", ")}`);
  return make();
}

// M2 image providers. Empty until a provider is chosen at the M2 gate (verify-first: fetch the
// provider's official docs + confirm the latest model id before adding a class here). Add an impl
// and set IMAGE_PROVIDER to go live — no other code changes (same swap philosophy as E2/E3).
const IMAGE_REGISTRY: Record<string, () => ImageAdapter> = {
  // gemini: () => new GeminiImage(),   // e.g. Imagen / Gemini image — add at the gate
  // openai: () => new OpenAIImage(),   // e.g. gpt-image — add at the gate
};

export function getImage(): ImageAdapter {
  const name = (process.env.IMAGE_PROVIDER || "").toLowerCase();
  const make = IMAGE_REGISTRY[name];
  if (!make) {
    const known = Object.keys(IMAGE_REGISTRY).join(", ") || "(none registered yet — see docs/asset-engine-spec.md §M2)";
    throw new Error(`Unknown/unset IMAGE_PROVIDER "${name}". Known: ${known}`);
  }
  return make();
}
