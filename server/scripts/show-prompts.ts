// Provenance viewer — "how did each image come to be?" Prints, per scenario asset, the EXACT prompt
// sent to the generator, the endpoint, the format, and the reference anchor. Reads the recorded
// provenance from the manifest; reconstructs deterministically (and labels it) for images generated
// before provenance was recorded.
//
//   npm run prompts -- <scenarioId>              # view
//   npm run prompts -- <scenarioId> --backfill   # write computed provenance into matching manifest
//                                                 # entries that lack it (exact, deterministic; backs up first)
//   npm run prompts -- --file <path.json>        # preview a DRAFT scenario's assembled prompts (no commit)

import "dotenv/config";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import * as store from "../assets/store";
import { getE4 } from "../adapters/index";
import { IMAGE_STYLE, IMAGE_FORMAT, styledPrompt, singleAssetSheetPrompt, relevantLabels } from "../adapters/image-style";
import { referenceSheetKey } from "../assets/reference-sheet";
import { SCENARIOS, validateScenario, type Scenario } from "../scenarios";

const args = process.argv.slice(2);
const backfill = args.includes("--backfill");
const fileIdx = args.indexOf("--file");

let scenario: Scenario | undefined;
if (fileIdx !== -1) {
  const p = args[fileIdx + 1];
  if (!p) {
    console.error("--file requires a path");
    process.exit(1);
  }
  scenario = validateScenario(p, JSON.parse(readFileSync(p, "utf8"))); // draft preview — resolves catalog refs
} else {
  const id = args.find((a) => !a.startsWith("--")) || "cafe";
  scenario = SCENARIOS.find((s) => s.id === id && s.status === "active");
  if (!scenario) {
    console.error(`No active scenario "${id}". Active: ${SCENARIOS.filter((s) => s.status === "active").map((s) => s.id).join(", ")}`);
    process.exit(1);
  }
}

const img = getE4();
const story = scenario.scene?.story;
const assets = scenario.scene?.assets ?? [];

interface Prov {
  label: string;
  key: string;
  aspectRatio: string;
  resolution: string;
  endpoint: string;
  effectivePrompt: string;
  referenceKeys?: string[];
}

// Recompute exactly what build:assets does, so we know each current asset's key + provenance.
const items: Prov[] = [];
const allLabels = assets.map((a) => a.label);
const assetKeyByLabel = new Map<string, string>();

// Per-asset canonical renders (the reference units).
for (const a of assets) {
  const f = IMAGE_FORMAT.asset;
  const raw = singleAssetSheetPrompt(a.label, a.descriptor);
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, f.aspectRatio, f.resolution, raw);
  assetKeyByLabel.set(a.label, key);
  const shared = a.catalogId ? ` (shared:${a.catalogId})` : "";
  items.push({ label: `asset:${a.label}${shared}`, key, ...f, endpoint: "images/generations", effectivePrompt: raw });
}

// The composed reference SHEET an anchored prompt is built against: the labelled montage of the assets
// it uses (bible order). Returns its store key + the labels on it (which build the instruction).
const sheetFor = (prompt: string): { key: string; labels: string[] } | undefined => {
  const labels = relevantLabels(prompt, allLabels);
  const renderKeys = labels.map((l) => assetKeyByLabel.get(l)).filter((k): k is string => !!k);
  if (!renderKeys.length) return undefined;
  return { key: referenceSheetKey(renderKeys), labels };
};

for (const fr of story?.frames ?? []) {
  const f = IMAGE_FORMAT.frame;
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, f.aspectRatio, f.resolution, fr.imagePrompt);
  const sheet = sheetFor(fr.imagePrompt);
  const eff = styledPrompt(fr.imagePrompt, { referenceLabels: sheet?.labels ?? [], mode: "flashcard" });
  items.push({ label: `frame:${fr.objectiveId}`, key, ...f, endpoint: sheet ? "images/edits" : "images/generations", effectivePrompt: eff, referenceKeys: sheet ? [sheet.key] : undefined });
}
if (story?.sceneImagePrompt) {
  const f = IMAGE_FORMAT.scene;
  const key = store.imageKey(img.name, img.model, IMAGE_STYLE.id, f.aspectRatio, f.resolution, story.sceneImagePrompt);
  const sheet = sheetFor(story.sceneImagePrompt);
  const eff = styledPrompt(story.sceneImagePrompt, { referenceLabels: sheet?.labels ?? [] });
  items.push({ label: "scene", key, ...f, endpoint: sheet ? "images/edits" : "images/generations", effectivePrompt: eff, referenceKeys: sheet ? [sheet.key] : undefined });
}

const manifestPath = path.join(store.ASSET_DIR, "manifest.jsonl");
const lines = existsSync(manifestPath) ? readFileSync(manifestPath, "utf8").split("\n").filter(Boolean) : [];
const byKey = new Map<string, any>();
for (const l of lines) {
  const e = JSON.parse(l);
  byKey.set(e.key, e);
}

console.log(`\n=== provenance — scenario "${scenario.id}" (${IMAGE_STYLE.id}) ===`);
for (const it of items) {
  const rec = byKey.get(it.key);
  const recorded = rec?.effectivePrompt !== undefined;
  console.log(`\n### ${it.label}${rec ? "" : "   ⚠ NOT GENERATED at current key"}`);
  console.log(`key:       ${it.key.slice(0, 16)}`);
  console.log(`format:    ${it.aspectRatio}  ${it.resolution}`);
  console.log(`endpoint:  ${rec?.endpoint ?? it.endpoint}`);
  console.log(`anchored:  ${it.referenceKeys ? `yes → ${it.referenceKeys.map((k) => k.slice(0, 10)).join(", ")}` : "no"}`);
  console.log(`created:   ${rec?.createdAt ?? "—"}`);
  console.log(`effective prompt${recorded ? "" : " (reconstructed)"}:`);
  console.log("  " + (rec?.effectivePrompt ?? it.effectivePrompt).replace(/\n/g, "\n  "));
}

if (backfill) {
  const currentByKey = new Map(items.map((i) => [i.key, i]));
  let enriched = 0;
  const out = lines.map((l) => {
    const e = JSON.parse(l);
    const it = currentByKey.get(e.key);
    if (e.type === "image" && it && e.effectivePrompt === undefined) {
      enriched++;
      return JSON.stringify({
        ...e,
        styleId: IMAGE_STYLE.id,
        aspectRatio: it.aspectRatio,
        resolution: it.resolution,
        effectivePrompt: it.effectivePrompt,
        endpoint: it.endpoint,
        ...(it.referenceKeys ? { referenceKeys: it.referenceKeys } : {}),
      });
    }
    return l;
  });
  if (enriched) {
    copyFileSync(manifestPath, manifestPath + ".bak");
    writeFileSync(manifestPath, out.join("\n") + "\n");
    console.log(`\n✅ backfilled ${enriched} image entr${enriched === 1 ? "y" : "ies"} (backup: manifest.jsonl.bak)`);
  } else {
    console.log(`\nNothing to backfill — all current "${scenario.id}" image entries already have provenance.`);
  }
}
