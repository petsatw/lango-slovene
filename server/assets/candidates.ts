// Catalog-growth queue — novel Slovene the learner produced in free chat that has NO catalog match.
// Append-only JSONL under the gitignored /assets/ (next to learner.json). The operator reviews these to
// decide what to add to the catalog next. A phrase `stripPersonal` would change is skipped, and a row
// holds `surface`, `gloss` and `at` only. Best-effort: a write failure never breaks a turn.

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "./store";
import type { ObservedItem } from "../types";
import { stripPersonal } from "./pseudonymise";

const PATH = process.env.CANDIDATES_PATH || path.join(ASSET_DIR, "catalog-candidates.jsonl");

export function record(items: ObservedItem[]): void {
  if (!items.length) return;
  try {
    mkdirSync(path.dirname(PATH), { recursive: true });
    const at = new Date().toISOString();
    const kept = items.filter((i) => stripPersonal(i.surface) === i.surface && stripPersonal(i.gloss) === i.gloss);
    if (!kept.length) return;
    const lines = kept.map((i) => JSON.stringify({ surface: i.surface, gloss: i.gloss, at })).join("\n");
    appendFileSync(PATH, lines + "\n");
  } catch (err: any) {
    console.error("[candidates] failed:", err?.message);
  }
}
