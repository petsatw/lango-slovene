// Generate the canonical render for one or more CATALOG assets by id (object or character). Each is a
// single isolated 1:1/1k render (getOrCreateAssetRender) — content-addressed, so it's reused everywhere
// the asset is referenced. This is the surgical "(re)render just these catalog assets" command; a frame
// that anchors on them picks them up on its next (re)build.
//
//   npm run render:asset -- customer doorway      # render these catalog ids (skips ones already present)
//   npm run render:asset -- customer --force      # delete + re-render even if a render exists
//
// Billed: calls the E4 image provider once per asset that actually renders.

import "dotenv/config";
import * as store from "../assets/store";
import { getOrCreateAssetRender, assetRenderKey } from "../assets/images";
import { CATALOG } from "../catalog";

const args = process.argv.slice(2);
const force = args.includes("--force");
const ids = args.filter((a) => !a.startsWith("--"));
if (!ids.length) {
  console.error("usage: npm run render:asset -- <catalogId> [<catalogId> …] [--force]");
  process.exit(1);
}

function resolve(id: string): { label: string; descriptor: string } {
  const o = CATALOG.objects[id];
  if (o) return { label: o.label, descriptor: o.descriptor };
  const c = CATALOG.characters[id];
  if (c) return { label: c.visual.label, descriptor: c.visual.descriptor };
  throw new Error(`"${id}" is not a known catalog object or character. Known objects: ${Object.keys(CATALOG.objects).join(", ")}; characters: ${Object.keys(CATALOG.characters).join(", ")}`);
}

for (const id of ids) {
  const asset = resolve(id);
  const key = assetRenderKey(asset);
  if (force && store.has(key, "image")) {
    store.remove(key, "image");
    console.log(`   forced re-render: removed existing ${id} (${key.slice(0, 10)}…)`);
  }
  const { hit, key: k } = await getOrCreateAssetRender(asset);
  console.log(`${hit ? "· cached " : "✓ rendered"} ${id}  ${asset.label}  → ${k.slice(0, 12)}…`);
}
console.log("done.");
