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
  referenceKeys?: string[]; // store keys of those references — recorded as provenance (not sent)
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

  const existing = store.read(key, "image");
  if (existing) return { bytes: existing, hit: true, key };

  // Everything that produced this image — computed here, recorded once at creation (provenance).
  const effectivePrompt = req.styled === false ? prompt : styledPrompt(prompt);
  const endpoint = req.referenceImages?.length ? "images/edits" : "images/generations";
  const { bytes, mimeType } = await img.generate({
    prompt: effectivePrompt,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    referenceImages: req.referenceImages,
  });
  store.put(key, "image", bytes, {
    provider: img.name,
    voiceOrModel: img.model,
    prompt, // raw authored intent
    effectivePrompt, // exact string sent
    styleId: IMAGE_STYLE.id,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    endpoint,
    referenceKeys: req.referenceKeys,
    mimeType,
    scenarioId: req.scenarioId,
    objectiveId: req.objectiveId,
  });
  return { bytes, hit: false, key };
}

// A stored image as a base64 data URI — what we pass as a reference image to anchor later generations.
export function asDataUri(bytes: Buffer): string {
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
