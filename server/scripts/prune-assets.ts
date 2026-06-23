// Garbage-collect orphaned IMAGE assets from the store. An image file is "live" iff its key is a
// per-asset render / frame / scene key of some ACTIVE scenario at the current style + format. Images
// are ONLY ever authored assets (there is no runtime image generation — asset renders/frames/scene are
// all produced by build:assets), so any image on disk that is not in the live set is dead: superseded
// by an IMAGE_STYLE.id bump, a re-authored prompt, a renamed label, or a removed scenario.
//
// AUDIO is deliberately NOT pruned here: the store also holds live-session tutor clips that are valid
// cache but are not authored assets, so an authored-key test would wrongly delete them.
//
//   npm run prune:assets             # dry run — list orphaned images, remove nothing
//   npm run prune:assets -- --apply  # delete orphaned image files + prune their manifest lines (manifest backed up first)

import "dotenv/config";
import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import * as store from "../assets/store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, relevantLabels } from "../adapters/image-style";
import { assetRenderKey } from "../assets/images";
import { referenceSheetKey } from "../assets/reference-sheet";
import { SCENARIOS } from "../scenarios";

const apply = process.argv.slice(2).includes("--apply");
const img = getE4();

// The set of image keys that SHOULD exist for the current active scenarios at the current style.
const live = new Set<string>();
for (const s of SCENARIOS.filter((s) => s.status === "active")) {
  const assets = s.scene?.assets ?? [];
  const story = s.scene?.story;
  const key = (prompt: string, f: { aspectRatio: string; resolution: string }) =>
    store.imageKey(img.name, img.model, IMAGE_STYLE.id, f.aspectRatio, f.resolution, prompt);
  const allLabels = assets.map((a) => a.label);
  const renderKeyByLabel = new Map(assets.map((a) => [a.label, assetRenderKey(a)]));
  // The composed reference sheet a prompt anchors to (the montage of the renders it uses) is itself a
  // live derived asset → keep it too.
  const sheetKey = (prompt: string) => {
    const renderKeys = relevantLabels(prompt, allLabels).map((l) => renderKeyByLabel.get(l)!).filter(Boolean);
    return renderKeys.length ? referenceSheetKey(renderKeys) : undefined;
  };
  for (const a of assets) live.add(assetRenderKey(a)); // each asset's canonical render
  for (const fr of story?.frames ?? []) {
    live.add(key(fr.imagePrompt, IMAGE_FORMAT.frame));
    const sk = sheetKey(fr.imagePrompt);
    if (sk) live.add(sk);
  }
  if (story?.sceneImagePrompt) {
    live.add(key(story.sceneImagePrompt, IMAGE_FORMAT.scene));
    const sk = sheetKey(story.sceneImagePrompt);
    if (sk) live.add(sk);
  }
}

const imageDir = path.join(store.ASSET_DIR, "image");
const files = existsSync(imageDir) ? readdirSync(imageDir).filter((f) => f.endsWith(".jpg")) : [];
const orphans = files.map((f) => f.replace(/\.jpg$/, "")).filter((keyName) => !live.has(keyName));

console.log(`\n=== prune:assets (${IMAGE_STYLE.id}) ===`);
console.log(`live image keys (active scenarios): ${live.size}`);
console.log(`image files on disk:                ${files.length}`);
console.log(`orphaned (dead) image files:        ${orphans.length}`);

if (orphans.length === 0) {
  console.log("\nNothing to prune — every stored image is a live authored asset.");
  process.exit(0);
}

// Annotate each orphan with what the manifest remembers about it (scenario/objective), for the report.
const manifestPath = path.join(store.ASSET_DIR, "manifest.jsonl");
const lines = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8").split("\n").filter(Boolean) : [];
const metaByKey = new Map<string, any>();
for (const l of lines) {
  const e = JSON.parse(l);
  metaByKey.set(e.key, e);
}
for (const k of orphans) {
  const m = metaByKey.get(k);
  const tag = m ? `${m.scenarioId ?? "?"}/${m.objectiveId ?? "?"} (${m.styleId ?? "?"})` : "(no manifest record)";
  console.log(`  ${apply ? "del " : "would del "} ${k.slice(0, 16)}…  ${tag}`);
}

if (!apply) {
  console.log(`\nDry run. Re-run with --apply to delete these ${orphans.length} file(s) and prune their manifest lines.`);
  process.exit(0);
}

// Delete the files, then rewrite the manifest without the orphaned IMAGE lines (audio + live images kept).
const orphanSet = new Set(orphans);
let removed = 0;
for (const k of orphans) if (store.remove(k, "image")) removed++;

if (lines.length) {
  copyFileSync(manifestPath, manifestPath + ".bak");
  const kept = lines.filter((l) => {
    const e = JSON.parse(l);
    return !(e.type === "image" && orphanSet.has(e.key));
  });
  writeFileSync(manifestPath, kept.length ? kept.join("\n") + "\n" : "");
  console.log(`\n✅ removed ${removed} image file(s); pruned ${lines.length - kept.length} manifest line(s) (backup: manifest.jsonl.bak)`);
} else {
  console.log(`\n✅ removed ${removed} image file(s).`);
}
