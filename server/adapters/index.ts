// Adapter registry — the swap point. E2_PROVIDER / E3_PROVIDER env vars choose the implementation. To
// run the blind A/B across providers, add a class here and select it per request.
//
// A CALLER MAY NAME ONE, and a named-but-unregistered provider falls back to the configured one rather
// than failing the turn. That is what lets a tester compare two providers inside one sitting, the same
// way the live surface does it (server/live/registry.ts resolveProvider) — without it, comparing them
// means restarting the server between runs, and a restart between runs only adds noise.

import type { E2Adapter, E3Adapter, ImageAdapter } from "../types";
import { GeminiE2 } from "./gemini";
import { ElevenLabsE3 } from "./elevenlabs";
import { GrokImageE4 } from "./grok-image";

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

export function getE2(requested?: unknown): E2Adapter {
  const asked = typeof requested === "string" ? requested.toLowerCase() : "";
  if (E2_REGISTRY[asked]) return E2_REGISTRY[asked]!();
  const name = (process.env.E2_PROVIDER || "gemini").toLowerCase();
  const make = E2_REGISTRY[name];
  if (!make) throw new Error(`Unknown E2_PROVIDER "${name}". Known: ${Object.keys(E2_REGISTRY).join(", ")}`);
  return make();
}

export function getE3(requested?: unknown): E3Adapter {
  const asked = typeof requested === "string" ? requested.toLowerCase() : "";
  if (E3_REGISTRY[asked]) return E3_REGISTRY[asked]!();
  const name = (process.env.E3_PROVIDER || "elevenlabs").toLowerCase();
  const make = E3_REGISTRY[name];
  if (!make) throw new Error(`Unknown E3_PROVIDER "${name}". Known: ${Object.keys(E3_REGISTRY).join(", ")}`);
  return make();
}

// E4 — the image slot (M2), same swap philosophy as E2/E3: implement ImageAdapter, register here,
// select with E4_PROVIDER. Verify-first before adding a provider: fetch its official docs + confirm
// the latest model id (memory: verify-apis-and-versions-before-building).
const E4_REGISTRY: Record<string, () => ImageAdapter> = {
  grok: () => new GrokImageE4(),
  // gemini: () => new GeminiImageE4(),  // add for an A/B
};

export function getE4(): ImageAdapter {
  const name = (process.env.E4_PROVIDER || "grok").toLowerCase();
  const make = E4_REGISTRY[name];
  if (!make) throw new Error(`Unknown E4_PROVIDER "${name}". Known: ${Object.keys(E4_REGISTRY).join(", ")}`);
  return make();
}
