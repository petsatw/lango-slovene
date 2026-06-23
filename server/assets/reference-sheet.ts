// The DYNAMIC reference sheet — assembled LOCALLY (no provider call) for each frame/scene.
//
// v3 splits "what an asset looks like" from "how a sheet is built": each asset has its own canonical
// render (server/assets/images.ts → getOrCreateAssetRender). At gen time we algorithmically gather the
// assets a given frame/scene actually uses and tile their renders — each labelled — into ONE montage,
// which is the single reference image submitted to the generator. So a frame/scene is still anchored to
// one labelled sheet (strong, all-assets-pinned consistency), but that sheet is now composed on the fly
// from SHARED per-asset renders instead of one monolithic per-scenario generation. Money rendered once
// is the same pixels on every sheet it appears in.
//
// The composed sheet is content-addressed on the ordered set of per-asset render keys it combines, so a
// given (assets → sheet) is built once locally and reused.

import { createHash } from "node:crypto";
import { Jimp, loadFont, measureText } from "jimp";
import { SANS_16_BLACK } from "jimp/fonts";
import * as store from "./store";
import { token } from "../adapters/image-style";

// Bump if the montage LAYOUT changes (it's folded into the sheet key, so a layout change re-keys).
// v2: each tile is labelled with its `{{TOKEN}}` (the exact marker the prompt + instruction use).
const SHEET_LAYOUT = "v2";

const CELL = 320; // px per asset render
const PAD = 16; // gutter
const LABEL_H = 28; // label band under each tile
const BG = 0xfafafaff; // off-white, matches the single-asset render background

let fontPromise: ReturnType<typeof loadFont> | undefined;
function font() {
  return (fontPromise ??= loadFont(SANS_16_BLACK));
}

/** The store key the composed sheet for this ordered set of per-asset renders lands at. Lets build /
 *  audit reference (or detect) a sheet without recomposing. */
export function referenceSheetKey(renderKeys: string[]): string {
  return createHash("sha256").update(`refsheet|${SHEET_LAYOUT}|${renderKeys.join(",")}`).digest("hex");
}

/** Tile the given per-asset renders into one labelled montage (off-white grid, name under each item). */
export async function composeReferenceSheet(tiles: { label: string; bytes: Buffer }[]): Promise<Buffer> {
  const f = await font();
  const cols = Math.min(tiles.length, Math.ceil(Math.sqrt(tiles.length)));
  const rows = Math.ceil(tiles.length / cols);
  const width = cols * CELL + (cols + 1) * PAD;
  const height = rows * (CELL + LABEL_H) + (rows + 1) * PAD;
  const sheet = new Jimp({ width, height, color: BG });

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]!;
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = PAD + c * (CELL + PAD);
    const y = PAD + r * (CELL + LABEL_H + PAD);
    const render = await Jimp.fromBuffer(tile.bytes);
    render.contain({ w: CELL, h: CELL }); // fit the render into its cell, preserving aspect
    sheet.composite(render, x, y);
    const label = token(tile.label); // print the exact `{{TOKEN}}` the prompt matches against
    const tw = measureText(f, label);
    sheet.print({ font: f, x: x + Math.max(0, Math.round((CELL - tw) / 2)), y: y + CELL, text: label });
  }
  return sheet.getBuffer("image/jpeg");
}

/** Compose-or-reuse the labelled reference sheet for a set of per-asset renders. Persisted in the store
 *  (content-addressed on the render keys) as a derived local asset; the manifest records its sources. */
export async function getOrCreateReferenceSheet(
  tiles: { label: string; bytes: Buffer; key: string }[],
): Promise<{ bytes: Buffer; key: string; hit: boolean }> {
  const key = referenceSheetKey(tiles.map((t) => t.key));
  const existing = store.read(key, "image");
  if (existing) return { bytes: existing, key, hit: true };
  const bytes = await composeReferenceSheet(tiles.map((t) => ({ label: t.label, bytes: t.bytes })));
  store.put(key, "image", bytes, {
    provider: "local",
    voiceOrModel: "jimp-montage",
    prompt: `reference-sheet: ${tiles.map((t) => t.label).join(", ")}`,
    referenceKeys: tiles.map((t) => t.key),
    mimeType: "image/jpeg",
    objectiveId: "reference-sheet",
  });
  return { bytes, key, hit: false };
}
