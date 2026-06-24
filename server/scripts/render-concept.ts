// Generate the canonical render for a COMPOSED catalog concept (e.g. greet, leave). A concept is a
// reusable depiction built FROM other catalog assets: we compose its constituents' canonical renders into
// a labelled montage, then generate the concept anchored to that sheet (so its customer/doorway match the
// canonical ones). The render lands at the concept prompt's content-addressed key — the SAME key every
// frame with that depiction uses, so generating the concept updates that shared image everywhere.
//
//   npm run render:concept -- greet leave            # render (skips if the image already exists)
//   npm run render:concept -- greet leave --force    # delete + regenerate (use when constituents changed)
//
// Billed: one E4 call per concept that actually renders.

import "dotenv/config";
import * as store from "../assets/store";
import { getOrCreateImage, getOrCreateAssetRender, asDataUri } from "../assets/images";
import { getOrCreateReferenceSheet } from "../assets/reference-sheet";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels } from "../adapters/image-style";
import { getConcept, getAssetVisual, CATALOG } from "../catalog";

const args = process.argv.slice(2);
const force = args.includes("--force");
const ids = args.filter((a) => !a.startsWith("--"));
if (!ids.length) {
  console.error(`usage: npm run render:concept -- <conceptId> [<conceptId> …] [--force]\n  known: ${Object.keys(CATALOG.concepts).join(", ")}`);
  process.exit(1);
}

const e4 = getE4();
const conceptKey = (prompt: string) =>
  store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, IMAGE_FORMAT.frame.aspectRatio, IMAGE_FORMAT.frame.resolution, prompt);

for (const id of ids) {
  const concept = getConcept(id);
  // Constituents → their canonical renders, ordered to match the prompt's {{TOKEN}} order.
  const visuals = concept.composedFrom.map(getAssetVisual);
  const ordered = relevantLabels(concept.prompt, visuals.map((v) => v.label));
  const tiles: { label: string; bytes: Buffer; key: string }[] = [];
  for (const lab of ordered) {
    const v = visuals.find((x) => x.label === lab)!;
    const { bytes, key, hit } = await getOrCreateAssetRender(v);
    console.log(`   ${hit ? "hit " : "gen "} constituent ${lab}  ${key.slice(0, 12)}…`);
    tiles.push({ label: lab, bytes, key });
  }
  if (!tiles.length) { console.error(`✗ ${id}: prompt references none of its composedFrom assets`); continue; }

  const sheet = await getOrCreateReferenceSheet(tiles);
  console.log(`   ${sheet.hit ? "hit " : "mk  "} sheet[${tiles.map((t) => t.label).join("+")}]  ${sheet.key.slice(0, 12)}…`);

  const key = conceptKey(concept.prompt);
  if (force && store.has(key, "image")) {
    store.remove(key, "image");
    console.log(`   forced regen: removed existing ${key.slice(0, 12)}…`);
  }
  const { hit, key: k } = await getOrCreateImage(concept.prompt, {
    aspectRatio: IMAGE_FORMAT.frame.aspectRatio,
    resolution: IMAGE_FORMAT.frame.resolution,
    mode: "flashcard",
    objectiveId: `concept:${id}`,
    referenceImages: [asDataUri(sheet.bytes)],
    referenceKeys: [sheet.key],
    sheetLabels: tiles.map((t) => t.label),
  });
  console.log(`${hit ? "· cached " : "✓ rendered"} concept ${id}  ${concept.label}  → ${k.slice(0, 12)}…  (built-from ${tiles.map((t) => t.label).join(", ")})`);
}
console.log("done.");
