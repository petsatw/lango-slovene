// M2 seam — provider-agnostic image reuse through the same content-addressed store as audio.
// Identical (provider|model|styleId|prompt) ⇒ same key ⇒ regenerating a frame/scene is free.
// This is fully wired; it only needs a concrete ImageAdapter registered at the M2 provider gate
// (getImage() throws until then). M3's build:assets and M4's story playback call into here.

import * as store from "./store";
import { getImage } from "../adapters/index";
import { IMAGE_STYLE, styledPrompt } from "../adapters/image-style";

export async function getOrCreateImage(
  prompt: string,
  meta: { scenarioId?: string; objectiveId?: string } = {},
): Promise<{ bytes: Buffer; hit: boolean; key: string }> {
  const img = getImage(); // throws with a clear message until a provider is registered (M2 gate)
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
    async () => img.generate({ prompt: styledPrompt(prompt) }),
  );
  return { bytes, hit, key };
}
