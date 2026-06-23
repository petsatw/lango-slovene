// M2 seam — provider-agnostic image reuse through the content-addressed store. Identical inputs
// (provider | model | styleId | aspectRatio | resolution | prompt) ⇒ same key ⇒ regeneration is free.
//
// `aspectRatio`/`resolution` are explicit (typed API args, not prose). `referenceImages` anchor the
// output to the scenario's reference sheet (character/setting consistency). `styled: false` sends the
// prompt verbatim — used for the reference sheet, whose prompt is already complete.

import * as store from "./store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, styledPrompt, singleAssetSheetPrompt } from "../adapters/image-style";

// Grok's edits endpoint anchors to at most this many reference images.
export const MAX_REFS = 3;

export interface ImageRequest {
  aspectRatio: string;
  resolution: string;
  scenarioId?: string;
  objectiveId?: string;
  // The anchor image(s) — typically ONE locally-composed labelled reference sheet (see
  // reference-sheet.ts). URLs / base64 data URIs / file_ids; capped to MAX_REFS.
  referenceImages?: string[];
  referenceKeys?: string[]; // store keys of those references — recorded as provenance (not sent)
  sheetLabels?: string[]; // the labels depicted on the reference sheet, in order — builds the reference instruction
  styled?: boolean; // default true; false = send prompt verbatim (a single-asset canonical render)
  mode?: "flashcard" | "scene"; // composition: minimal-compose atomic card vs full tableau (default scene)
}

export async function getOrCreateImage(
  prompt: string,
  req: ImageRequest,
): Promise<{ bytes: Buffer; hit: boolean; key: string }> {
  const img = getE4();
  // Key on the LITERAL authored prompt (exactly what's sent, braces included) + the explicit format.
  // If the prompt changes, the key changes and the image regenerates — normal, no special handling.
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, req.aspectRatio, req.resolution, prompt);

  const existing = store.read(key, "image");
  if (existing) return { bytes: existing, hit: true, key };

  // Anchor to the provided reference image(s) — typically one composed labelled sheet. The instruction
  // names every asset depicted on that sheet (req.sheetLabels), matched by its printed label.
  const refImages = (req.referenceImages ?? []).slice(0, MAX_REFS);
  const anchored = refImages.length > 0;
  const refLabels = anchored ? req.sheetLabels ?? [] : [];
  const effectivePrompt =
    req.styled === false ? prompt : styledPrompt(prompt, { referenceLabels: refLabels, mode: req.mode });
  const endpoint = anchored ? "images/edits" : "images/generations";
  const { bytes, mimeType } = await img.generate({
    prompt: effectivePrompt,
    aspectRatio: req.aspectRatio,
    resolution: req.resolution,
    referenceImages: refImages,
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

// The per-asset CANONICAL RENDER through the store. Content-addressed on the single-asset prompt, so a
// shared (catalog) asset — identical descriptor everywhere — renders ONCE and is reused across
// scenarios. Plain text-to-image (no anchor); the prompt already carries the full house style.
export async function getOrCreateAssetRender(
  asset: { label: string; descriptor: string },
): Promise<{ bytes: Buffer; hit: boolean; key: string }> {
  const f = IMAGE_FORMAT.asset;
  const prompt = singleAssetSheetPrompt(asset.label, asset.descriptor);
  return getOrCreateImage(prompt, {
    aspectRatio: f.aspectRatio,
    resolution: f.resolution,
    objectiveId: `asset:${asset.label}`,
    styled: false, // prompt is already complete (style + isolate instruction)
  });
}

// The store key a single asset's canonical render lands at (same inputs getOrCreateAssetRender uses).
// Lets build/audit look one up — or detect it's missing — without generating.
export function assetRenderKey(asset: { label: string; descriptor: string }): string {
  const img = getE4();
  const f = IMAGE_FORMAT.asset;
  return store.imageKey(img.name, img.model, IMAGE_STYLE.id, f.aspectRatio, f.resolution, singleAssetSheetPrompt(asset.label, asset.descriptor));
}

// A stored image as a base64 data URI — what we pass as a reference image to anchor later generations.
export function asDataUri(bytes: Buffer): string {
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}
