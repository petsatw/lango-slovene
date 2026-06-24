// Re-key utility (asset-store maintenance). Image keys are the LITERAL prompt, so any system-wide
// prompt change re-keys every affected image. When such a change leaves the PICTURE correct — a
// normalization of phrasing / ordering / style, not a depiction change — regenerating is waste. RE-KEY
// instead: copy the existing good bytes to the new prompt's key. Free, additive (old keys left in
// place), idempotent. Images whose depiction actually changed are reported as "RE-RENDER" and left
// untouched (they need build:assets).
//
// Each migration needs a "same picture?" rule. The current pass handles the {{TOKEN}} reference-brace
// addition: an image is unchanged iff its old recorded prompt equals the de-braced new prompt. Add a
// new rule here when a future normalization lands.
//
//   npm run rekey:assets             # dry run — what would be re-keyed vs needs re-render
//   npm run rekey:assets -- --apply  # copy the bytes to the new keys
//   npm run rekey:assets -- --harvest [--apply]  # seed a canonical render from a sole-asset frame's bytes

import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import * as store from "../assets/store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, stripTokens, singleAssetSheetPrompt } from "../adapters/image-style";
import { assetRenderKey } from "../assets/images";
import { getObject, CATALOG } from "../catalog";
import { SCENARIOS } from "../scenarios";

const apply = process.argv.slice(2).includes("--apply");
const harvest = process.argv.slice(2).includes("--harvest");
const restyle = process.argv.slice(2).includes("--restyle");
const e4 = getE4();
const keyFor = (prompt: string, fmt: { aspectRatio: string; resolution: string }) =>
  store.imageKey(e4.name, e4.model, IMAGE_STYLE.id, fmt.aspectRatio, fmt.resolution, prompt);

const manifestPath = path.join(store.ASSET_DIR, "manifest.jsonl");
const manifest: any[] = existsSync(manifestPath)
  ? readFileSync(manifestPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  : [];

// ---- HARVEST mode: a sole-asset FRAME already depicts a single asset as-is, so its bytes ARE that
// asset's canonical render. Copy frame bytes → assetRenderKey (free byte-op, like a re-key). The four
// below were mapped by review (an existing frame == the canonical for that object).
if (harvest) {
  const HARVEST: { scenario: string; objectiveId: string; label: string; catalogId?: string }[] = [
    { scenario: "bakery", objectiveId: "order_bread", label: "LOAF" },
    { scenario: "bakery", objectiveId: "order_rolls", label: "ROLLS" },
    { scenario: "cafe", objectiveId: "order_coffee", label: "COFFEE" },
    { scenario: "bakery", objectiveId: "ask_price", label: "PRICE_TAG", catalogId: "price_tag" },
  ];
  console.log(`\n=== rekey:assets --harvest${apply ? "  --apply" : "  (dry run)"} ===`);
  let n = 0;
  for (const h of HARVEST) {
    const s = SCENARIOS.find((x) => x.id === h.scenario);
    const fr = s?.scene?.story?.frames.find((f) => f.objectiveId === h.objectiveId);
    if (!fr) { console.log(`   ✗ ${h.label}: frame ${h.scenario}/${h.objectiveId} not found`); continue; }
    const frameKey = keyFor(fr.imagePrompt, IMAGE_FORMAT.frame);
    if (!store.has(frameKey, "image")) { console.log(`   ✗ ${h.label}: source frame not on disk`); continue; }
    const asset = h.catalogId ? getObject(h.catalogId) : s!.scene!.assets!.find((a) => a.label === h.label)!;
    const dstKey = assetRenderKey({ label: asset.label, descriptor: asset.descriptor });
    if (store.has(dstKey, "image")) { console.log(`   · ${h.label}: canonical already present`); continue; }
    console.log(`   ${apply ? "harvest" : "would "} ${h.label} ← ${h.scenario}/${h.objectiveId}  ${frameKey.slice(0, 10)}… → ${dstKey.slice(0, 10)}…`);
    if (apply) {
      store.put(dstKey, "image", store.read(frameKey, "image")!, {
        provider: "harvest",
        voiceOrModel: e4.model,
        prompt: singleAssetSheetPrompt(asset.label, asset.descriptor),
        styleId: IMAGE_STYLE.id,
        aspectRatio: IMAGE_FORMAT.asset.aspectRatio,
        resolution: IMAGE_FORMAT.asset.resolution,
        mimeType: "image/jpeg",
        scenarioId: h.scenario,
        objectiveId: `asset:${asset.label}`,
        referenceKeys: [frameKey], // provenance: harvested from this frame
      });
    }
    n++;
  }
  console.log(`\n${apply ? "Harvested" : "Would harvest"} ${n} canonical render(s) from frames.${!apply && n ? " Run with --apply." : ""}`);
  process.exit(0);
}

// ---- RESTYLE mode: the style prefix changed, so every catalog asset's render key shifted. For assets
// whose PICTURE is unchanged (everything we're not deliberately re-rendering), copy the existing render
// bytes to the new key — free, no regeneration. An asset already present at its new key (e.g. one we just
// re-rendered) is skipped. People should be re-rendered FIRST (render:asset) so they land at the new key
// and this pass leaves them alone.
if (restyle) {
  console.log(`\n=== rekey:assets --restyle${apply ? "  --apply" : "  (dry run)"} ===`);
  const all = [
    ...Object.values(CATALOG.objects).map((o) => ({ label: o.label, descriptor: o.descriptor })),
    ...Object.values(CATALOG.characters).map((c) => ({ label: c.visual.label, descriptor: c.visual.descriptor })),
  ];
  let copied = 0, present = 0, none = 0;
  for (const a of all) {
    const newKey = assetRenderKey(a);
    if (store.has(newKey, "image")) { present++; console.log(`   present  asset:${a.label}  ${newKey.slice(0, 10)}…`); continue; }
    // newest existing render for this asset (any old key), by objectiveId asset:<LABEL>
    const old = [...manifest].reverse().find((e) => e.type === "image" && e.objectiveId === `asset:${a.label}` && store.has(e.key, "image"));
    if (!old) { none++; console.log(`   —        asset:${a.label}  (no existing render — will need render)`); continue; }
    console.log(`   ${apply ? "rekey  " : "would  "} asset:${a.label}  ${old.key.slice(0, 10)}… → ${newKey.slice(0, 10)}…`);
    if (apply) store.put(newKey, "image", store.read(old.key, "image")!, {
      provider: old.provider, voiceOrModel: old.voiceOrModel, prompt: singleAssetSheetPrompt(a.label, a.descriptor),
      styleId: IMAGE_STYLE.id, aspectRatio: IMAGE_FORMAT.asset.aspectRatio, resolution: IMAGE_FORMAT.asset.resolution,
      mimeType: old.mimeType || "image/jpeg", objectiveId: `asset:${a.label}`, referenceKeys: [old.key],
    });
    copied++;
  }
  console.log(`\n${apply ? "Re-keyed" : "Would re-key"} ${copied}; ${present} already at new key; ${none} need a render.${!apply && copied ? " Run with --apply." : ""}`);
  process.exit(0);
}

let rekeyed = 0;
let present = 0;
let render = 0;
const renderList: string[] = [];

console.log(`\n=== rekey:assets (${IMAGE_STYLE.id})${apply ? "  --apply" : "  (dry run)"} ===`);

for (const s of SCENARIOS.filter((s) => s.status === "active")) {
  const story = s.scene?.story;
  if (!story) continue;
  const items = [
    ...story.frames.map((f) => ({ objectiveId: f.objectiveId, prompt: f.imagePrompt, fmt: IMAGE_FORMAT.frame })),
    ...(story.sceneImagePrompt ? [{ objectiveId: "scene", prompt: story.sceneImagePrompt, fmt: IMAGE_FORMAT.scene }] : []),
  ];
  for (const it of items) {
    const newKey = keyFor(it.prompt, it.fmt);
    if (store.has(newKey, "image")) {
      present++;
      console.log(`   present  ${s.id}/${it.objectiveId}  ${newKey.slice(0, 12)}…`);
      continue;
    }
    // The same picture iff its only change is the {{ }} notation: stripped new prompt == an old render's
    // prompt. Match by prompt CONTENT across all scenarios — frames with identical prompts (greet,
    // ask_price, pay_leave) are one shared image (content-addressed), as they were before.
    const target = stripTokens(it.prompt);
    const old = manifest.find((e) => e.type === "image" && e.prompt === target && store.has(e.key, "image"));
    if (old) {
      rekeyed++;
      console.log(`   ${apply ? "rekey  " : "would  "} ${s.id}/${it.objectiveId}  ${old.key.slice(0, 10)}… → ${newKey.slice(0, 10)}…`);
      if (apply) {
        const bytes = store.read(old.key, "image")!;
        store.put(newKey, "image", bytes, {
          provider: old.provider,
          voiceOrModel: old.voiceOrModel,
          prompt: it.prompt, // the literal new prompt (braces) this key now represents
          styleId: IMAGE_STYLE.id,
          aspectRatio: it.fmt.aspectRatio,
          resolution: it.fmt.resolution,
          mimeType: old.mimeType || "image/jpeg",
          scenarioId: s.id,
          objectiveId: it.objectiveId,
          referenceKeys: [old.key], // provenance: re-keyed from this old render
        });
      }
    } else {
      render++;
      renderList.push(`${s.id}/${it.objectiveId}`);
      console.log(`   RE-RENDER ${s.id}/${it.objectiveId}  (content changed — needs build:assets)`);
    }
  }
}

console.log(
  `\n${apply ? "Re-keyed" : "Would re-key"} ${rekeyed} image(s); ${present} already present; ` +
    `${render} need re-render${renderList.length ? ` (${renderList.join(", ")})` : ""}.`,
);
if (!apply && rekeyed) console.log(`Run with --apply to copy the bytes.`);
