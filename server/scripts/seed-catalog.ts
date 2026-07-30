// seed-catalog — the catalog-seed writer (the scenario-INDEPENDENT sibling of reconcile-dialogue).
//
// Some learnables aren't born in a dialogue tree — the A1 "Pareto set" of context-independent stems, glue,
// interrogatives and verb cores (docs/a1-pareto-set.md) is authored as a standalone catalog delta, reviewed
// by slovenian-author (+ operator R), then merged here. Same J/L split as reconcile-dialogue: the fuzzy
// language calls happen UPSTREAM (author/critic/R); this script does the mechanical merge and is FAIL-LOUD
// on every invariant — it never guesses.
//
//   npm run seed:catalog -- <path-to-seed.json>
//
// Guards (identical to reconcile-dialogue's): normalize kind (closed enum, fail on unknown); dedup by
// canonical surface — reuse an existing id only when it is the SAME lexical item (same normalized surface),
// and FAIL LOUD if a new entry's surface collides with a DIFFERENT existing id (distinct lexemes that merely
// share a function are NOT collisions — they have different surfaces, so they pass). Idempotent: an entry
// already in the catalog by id (same surface) is skipped.
//
// It also applies the A1 competency mappings the delta carries (folding the new learnables into a1-map.json,
// the D5i A1 placement) — every mapping's competencyId + learnableId must resolve, or it fails.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normSurface, normalizeKind } from "./dialogue-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const LEARNABLES_FILE = path.join(__dirname, "..", "catalog", "learnables.json");
const A1_FILE = path.join(__dirname, "..", "catalog", "a1-map.json");

const PARETO_CATEGORIES = new Set(["identity", "question", "transaction", "location_time", "social_glue", "verb_core"]);

function die(msg: string): never {
  console.error(`\n❌ seed-catalog: ${msg}\n`);
  process.exit(1);
}

// ---- Input shape --------------------------------------------------------------------------------
// {
//   "learnables": [ { id, kind, sl, gloss, predictableError?, core?, rank?, paretoCategory?:[...] } ],
//   "a1": [ { competencyId, learnableIds: [id, ...] } ]     // optional A1 placement (folds into a1-map.json)
// }

const inputArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!inputArg) die("usage: npm run seed:catalog -- <path-to-seed.json>");
const inputPath = path.resolve(process.cwd(), inputArg);
if (!existsSync(inputPath)) die(`input not found: ${inputPath}`);

let input: any;
try { input = JSON.parse(readFileSync(inputPath, "utf8")); } catch (e: any) { die(`input is not valid JSON: ${e.message}`); }
if (!Array.isArray(input.learnables) || !input.learnables.length) die(`"learnables" must be a non-empty array`);

const existing: Record<string, any> = JSON.parse(readFileSync(LEARNABLES_FILE, "utf8"));
const surfaceToId = new Map<string, string>();
for (const [id, l] of Object.entries(existing)) surfaceToId.set(normSurface((l as any).sl), id);

const toMint: Record<string, any> = {};
const mintedIds: string[] = [];
const skipped: string[] = [];

for (const e of input.learnables) {
  if (typeof e.id !== "string" || !/^[a-z0-9_]+$/.test(e.id)) die(`learnable id "${e.id}" must be snake_case lowercase`);
  for (const k of ["sl", "gloss"]) if (typeof e[k] !== "string" || !e[k]) die(`learnable "${e.id}" is missing "${k}"`);
  const kind = normalizeKind(e.kind);
  if (!kind) die(`learnable "${e.id}" has unknown kind "${e.kind}" (known: vocab/vocabulary, chunk/phrase, pattern/frame)`);

  if (e.paretoCategory !== undefined) {
    if (!Array.isArray(e.paretoCategory) || !e.paretoCategory.length) die(`learnable "${e.id}": paretoCategory must be a non-empty array`);
    for (const c of e.paretoCategory) if (!PARETO_CATEGORIES.has(c)) die(`learnable "${e.id}": unknown paretoCategory "${c}"`);
    if (e.core !== true) die(`learnable "${e.id}": a paretoCategory member must be core:true`);
  }

  const surf = normSurface(e.sl);
  if (existing[e.id]) { // already in catalog by id → idempotent skip iff surface matches
    if (normSurface(existing[e.id].sl) !== surf)
      die(`learnable "${e.id}" already exists with a DIFFERENT surface ("${existing[e.id].sl}" vs "${e.sl}")`);
    skipped.push(e.id);
    continue;
  }
  const owner = surfaceToId.get(surf);
  if (owner) die(`learnable "${e.id}" ("${e.sl}") duplicates the canonical surface of existing "${owner}". `
    + `Reuse "${owner}" — OR, if this is genuinely a different lexeme, it must have a different surface.`);

  const clean: any = { kind, sl: e.sl, gloss: e.gloss };
  if (typeof e.predictableError === "string" && e.predictableError) clean.predictableError = e.predictableError;
  if (typeof e.core === "boolean") clean.core = e.core;
  if (typeof e.rank === "number") clean.rank = e.rank;
  if (Array.isArray(e.paretoCategory)) clean.paretoCategory = e.paretoCategory;
  toMint[e.id] = clean;
  mintedIds.push(e.id);
  surfaceToId.set(surf, e.id);
}

// ---- merge learnables ---------------------------------------------------------------------------
if (mintedIds.length) {
  const merged = { ...existing };
  for (const id of mintedIds) merged[id] = toMint[id];
  writeFileSync(LEARNABLES_FILE, JSON.stringify(merged, null, 2) + "\n");
}
const knownIds = new Set([...Object.keys(existing), ...mintedIds]);

// ---- apply A1 placement (fold into a1-map.json) -------------------------------------------------
let a1Added = 0;
if (Array.isArray(input.a1) && input.a1.length) {
  const a1 = JSON.parse(readFileSync(A1_FILE, "utf8"));
  const byId = new Map<string, any>((a1.competencies ?? []).map((c: any) => [c.id, c]));
  for (const m of input.a1) {
    const comp = byId.get(m.competencyId);
    if (!comp) die(`a1 mapping: competency "${m.competencyId}" is not in a1-map.json`);
    if (!Array.isArray(m.learnableIds)) die(`a1 mapping for "${m.competencyId}": learnableIds must be an array`);
    for (const id of m.learnableIds) {
      if (!knownIds.has(id)) die(`a1 mapping for "${m.competencyId}": learnable "${id}" is not in the catalog`);
      if (!comp.learnables.includes(id)) { comp.learnables.push(id); a1Added++; }
    }
  }
  writeFileSync(A1_FILE, JSON.stringify(a1, null, 2) + "\n");
}

console.log(`\n✅ seed-catalog`);
console.log(`   minted ${mintedIds.length} new learnable(s)${skipped.length ? `, skipped ${skipped.length} already present` : ""}`);
console.log(`   A1: added ${a1Added} learnable→competency mapping(s)`);
console.log(`   ${path.relative(ROOT, LEARNABLES_FILE)} + ${path.relative(ROOT, A1_FILE)} updated`);
console.log(`\n   Next: npm run lint:dialogue && npm run lint:a1 && npm run test:learnable\n`);
process.exit(0);
