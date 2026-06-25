// Render any catalog NODE to its canonical render — composing recursively. An object/character renders
// as one isolated asset; a CONCEPT is montaged from its constituents (each itself a node, so a scene can
// anchor on a location concept like `cafe`, which itself anchors on counter + fixture) and generated
// anchored to that labelled sheet. Shared by the render:concept script AND the scenario build — the one
// place that knows how to turn "a catalog id" into "its render tile", whatever kind it is.

import * as store from "./store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels } from "../adapters/image-style";
import { CATALOG, getAssetVisual, type CatalogConcept } from "../catalog";
import { getOrCreateImage, getOrCreateAssetRender, asDataUri } from "./images";
import { getOrCreateReferenceSheet } from "./reference-sheet";

export interface RenderTile {
  label: string;
  bytes: Buffer;
  key: string;
  hit: boolean;
}

// Composed concepts render at 2k (frame and scene resolutions match); the aspect ratio comes from the
// concept (default 4:3 frame; a location/scene concept sets 16:9).
const CONCEPT_RESOLUTION = IMAGE_FORMAT.frame.resolution;

/** The store key a concept's render lands at — lets a caller force-regenerate or detect-missing without
 *  composing. Mirrors the key getOrCreateImage computes inside renderConcept. */
export function conceptRenderKey(concept: CatalogConcept): string {
  const e4 = getE4();
  const aspectRatio = concept.aspectRatio ?? IMAGE_FORMAT.frame.aspectRatio;
  return store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, aspectRatio, CONCEPT_RESOLUTION, concept.prompt);
}

/** Render-or-reuse any catalog node (object | character | concept) → its canonical render tile. */
export async function renderNode(id: string): Promise<RenderTile> {
  const concept = CATALOG.concepts[id];
  if (concept) return renderConcept(concept);
  const v = getAssetVisual(id); // an object, or a character → its visualRef object
  const { bytes, key, hit } = await getOrCreateAssetRender(v);
  return { label: v.label, bytes, key, hit };
}

/** Render-or-reuse a composed concept: each constituent → its render (recursively), montage them into one
 *  labelled sheet, then generate the concept anchored to that sheet at the concept's aspectRatio/format. */
export async function renderConcept(concept: CatalogConcept): Promise<RenderTile> {
  const aspectRatio = concept.aspectRatio ?? IMAGE_FORMAT.frame.aspectRatio;
  const mode = concept.format ?? "flashcard";
  const constituents: RenderTile[] = [];
  for (const cid of concept.composedFrom) constituents.push(await renderNode(cid));
  // Order the tiles to match the {{TOKEN}} order in the prompt (and drop any constituent the prompt
  // doesn't actually reference), exactly as the frame/scene montage does.
  const ordered = relevantLabels(concept.prompt, constituents.map((t) => t.label)).map(
    (lab) => constituents.find((t) => t.label === lab)!,
  );
  if (!ordered.length) throw new Error(`concept "${concept.id}": prompt references none of its composedFrom assets`);
  const sheet = await getOrCreateReferenceSheet(ordered.map((t) => ({ label: t.label, bytes: t.bytes, key: t.key })));
  const { bytes, hit, key } = await getOrCreateImage(concept.prompt, {
    aspectRatio,
    resolution: CONCEPT_RESOLUTION,
    mode,
    objectiveId: `concept:${concept.id}`,
    referenceImages: [asDataUri(sheet.bytes)],
    referenceKeys: [sheet.key],
    sheetLabels: ordered.map((t) => t.label),
  });
  return { label: concept.label, bytes, key, hit };
}
