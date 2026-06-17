// M2 seam — provider-agnostic image reuse through the content-addressed store. Identical inputs
// (provider | model | styleId | aspectRatio | resolution | prompt) ⇒ same key ⇒ regeneration is free.
//
// `aspectRatio`/`resolution` are explicit (typed API args, not prose). `referenceImages` anchor the
// output to the scenario's reference sheet (character/setting consistency). `styled: false` sends the
// prompt verbatim — used for the reference sheet, whose prompt is already complete.

import * as store from "./store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, styledPrompt } from "../adapters/image-style";

export interface ImageRequest {
  aspectRatio: string;
  resolution: string;
  scenarioId?: string;
  objectiveId?: string;
  referenceImages?: string[]; // URLs / base64 data URIs / file_ids (≤3) — the reference-sheet anchor
  styled?: boolean; // default true; false = send prompt verbatim (reference sheet)
}

export async function getOrCreateImage(
  prompt: string,
  req: ImageRequest,
): Promise<{ bytes: Buffer; hit: boolean; key: string }> {
  const img = getE4();
  // Key on the RAW authored prompt (so prefix tweaks don't bust the cache) + the explicit format.
  // styleId folds in the reference-sheet version, so refs don't need to be in the key (bump styleId).
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, req.aspectRatio, req.resolution, prompt);
  const finalPrompt = req.styled === false ? prompt : styledPrompt(prompt);
  const { bytes, hit } = await store.getOrCreate(
    key,
    "image",
    {
      provider: img.name,
      voiceOrModel: `${img.model}:${IMAGE_STYLE.id}:${req.aspectRatio}:${req.resolution}`,
      prompt,
      scenarioId: req.scenarioId,
      objectiveId: req.objectiveId,
    },
    async () =>
      img.generate({
        prompt: finalPrompt,
        aspectRatio: req.aspectRatio,
        resolution: req.resolution,
        referenceImages: req.referenceImages,
      }),
  );
  return { bytes, hit, key };
}

// A stored image as a base64 data URI — what we pass as a reference image to anchor later generations.
export function asDataUri(bytes: Buffer): string {
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
