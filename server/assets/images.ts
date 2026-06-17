// M2 seam — provider-agnostic image reuse through the same content-addressed store as audio.
// Identical (provider|model|styleId|prompt) ⇒ same key ⇒ regenerating a frame/scene is free.
// This is fully wired; it only needs a concrete ImageAdapter registered at the M2 provider gate
// (getImage() throws until then). M3's build:assets and M4's story playback call into here.

import * as store from "./store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, styledPrompt } from "../adapters/image-style";

export async function getOrCreateImage(
  prompt: string,
  meta: { scenarioId?: string; objectiveId?: string } = {},
): Promise<{ bytes: Buffer; hit: boolean; key: string }> {
  const img = getE4(); // the E4 image provider (grok); throws clearly if E4_PROVIDER is unknown
  // Key on styleId (not the expanded prompt) so the cache is stable across prompt-prefix tweaks but
  // changes when the style id is bumped. (styledPrompt is what we SEND; the key tracks the style id.)
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, prompt);
  const { bytes, hit } = await store.getOrCreate(
    key,
    "image",
    {
      provider: img.name,
      voiceOrModel: `${img.model}:${IMAGE_STYLE.id}`,
      prompt,
      scenarioId: meta.scenarioId,
      objectiveId: meta.objectiveId,
    },
    async () => img.generate({ prompt: styledPrompt(prompt), referenceImages: IMAGE_STYLE.referenceImages }),
  );
  return { bytes, hit, key };
}
