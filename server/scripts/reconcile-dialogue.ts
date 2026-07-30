// reconcile-dialogue — the DETERMINISTIC L-lane writer of the rehearsal-dialogue pipeline (handoff B1).
//
// It takes ONE orchestrator-assembled draft bundle (authored by the create-dialogue skill: the tree the
// orchestrator specced + the language slovenian-author wrote + the fixes scenario-critic returned) and
// turns it into committed files: the per-level dialogue JSONs, the scenario MANIFEST (D2), and the merged
// learnable catalog — then emits candidate A1 mappings for operator review (D5i).
//
//   npm run reconcile:dialogue -- <path-to-reconcile-input.json>
//   npm run reconcile:dialogue -- .scratch/dialogue-drafts/pharmacy/reconcile-input.json
//
// THE J/L BOUNDARY (handoff D4). The genuinely-fuzzy judgments happen UPSTREAM, by the LLM:
//   - the minting-rubric filter ("does the LEARNER produce this?") is applied by slovenian-author/critic;
//     the delta arriving here is already rubric-clean (NPC-only receptive lines never appear in it).
//   - semantic dedup ("is this new item the same learnable as an existing one, by meaning?") is the
//     author/critic's call; they emit `reuse` ids for anything already in the catalog.
// This script does the MECHANICAL merge/write, and is FAIL-LOUD on every invariant the LLM was supposed to
// have honored — it never silently merges, guesses, or fuzzy-matches. The one string-normalization it does
// (normSurface) is a conservative EXACT-collision backstop for the DRY invariant, not a semantic judge.
//
// Fixed order (each step depends on the previous): normalize kinds → dedup/collision guard → assign ids &
// introduces → apply critic fixes → write dialogue files + manifest + catalog → emit A1 candidates.
//
// Idempotent: re-running on the same input reproduces the same files (already-merged learnables are
// skipped by id; an already-applied critic fix is detected and skipped; an existing level's built `audio`
// state is preserved rather than reset to "pending").

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normSurface, normalizeKind, inDegrees, reachableFrom, canReachTerminal } from "./dialogue-lib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const DIALOGUES_DIR = path.join(__dirname, "..", "dialogues");
const SCENARIOS_DIR = path.join(__dirname, "..", "scenarios");
const LEARNABLES_FILE = path.join(__dirname, "..", "catalog", "learnables.json");
const A1_FILE = path.join(__dirname, "..", "catalog", "a1-map.json");

function die(msg: string): never {
  console.error(`\n❌ reconcile-dialogue: ${msg}\n`);
  process.exit(1);
}

// ---- Input shape (authored by the create-dialogue skill; see docs/authoring-pipeline.md) -----------
// {
//   scenario: { id, name?, title, status?, character, role?, setup, opening, register?:{form,variety} },
//   dialogueVoices: { npc, client },                       // shared across the scenario's levels
//   levels: [ { level, levelLabel, title, objectives:[{label,descriptorEN}], root, nodes:{…},
//              catalog: { reuse:[id…], new:[{id,kind,sl,gloss,predictableError?,core?,rank?}…] } } ],
//   criticFixes?: [ { level, nodeId, field:"sl"|"en"|"deliverySL", oldExact, newExact } ],
//   a1Candidates?: [ { learnableId, competencyId, note? } ]
// }

const inputArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!inputArg) die("usage: npm run reconcile:dialogue -- <path-to-reconcile-input.json>");
const inputPath = path.resolve(process.cwd(), inputArg);
if (!existsSync(inputPath)) die(`input not found: ${inputPath}`);

let input: any;
try {
  input = JSON.parse(readFileSync(inputPath, "utf8"));
} catch (e: any) {
  die(`input is not valid JSON: ${e.message}`);
}

const rel = (p: string) => path.relative(ROOT, p);
const S = input.scenario;
if (!S || typeof S !== "object") die(`"scenario" object is required`);
for (const k of ["id", "title", "character", "setup", "opening"]) {
  if (typeof S[k] !== "string" || !S[k]) die(`scenario.${k} must be a non-empty string`);
}
const scenarioId: string = S.id;
if (!/^[a-z0-9_-]+$/.test(scenarioId)) die(`scenario.id "${scenarioId}" must be kebab/snake lowercase`);

const voices = input.dialogueVoices;
if (!voices || typeof voices.npc !== "string" || typeof voices.client !== "string")
  die(`"dialogueVoices" must be { npc, client }`);

if (!Array.isArray(input.levels) || !input.levels.length) die(`"levels" must be a non-empty array`);

// ---- Load the existing catalog (raw JSON — no server-module load order coupling) -------------------
const existingLearnables: Record<string, any> = JSON.parse(readFileSync(LEARNABLES_FILE, "utf8"));
const a1Map = JSON.parse(readFileSync(A1_FILE, "utf8"));
const a1CompetencyIds = new Set<string>((a1Map.competencies ?? []).map((c: any) => c.id));

// surface → id over the EXISTING catalog (the collision backstop is checked against this + new mints).
const surfaceToId = new Map<string, string>();
for (const [id, l] of Object.entries(existingLearnables)) surfaceToId.set(normSurface((l as any).sl), id);

// ---- Step 1+2: normalize kinds, dedup/collision guard, collect the new learnables to mint -----------
const toMint: Record<string, any> = {}; // id → catalog entry (only genuinely-new ids)
const mintedIds = new Set<string>();
const reusedByLevel = new Map<number, string[]>();
const newByLevel = new Map<number, string[]>();

for (const lvl of input.levels) {
  if (typeof lvl.level !== "number") die(`each level needs a numeric "level"`);
  const cat = lvl.catalog ?? { reuse: [], new: [] };
  const reuse: string[] = Array.isArray(cat.reuse) ? cat.reuse : [];
  reusedByLevel.set(lvl.level, reuse);
  const news: string[] = [];

  for (const entry of cat.new ?? []) {
    if (typeof entry.id !== "string" || !/^[a-z0-9_]+$/.test(entry.id))
      die(`level ${lvl.level}: new learnable id "${entry.id}" must be snake_case lowercase`);
    for (const k of ["sl", "gloss"]) if (typeof entry[k] !== "string" || !entry[k])
      die(`level ${lvl.level}: new learnable "${entry.id}" is missing "${k}"`);

    const kind = normalizeKind(entry.kind);
    if (!kind) die(`level ${lvl.level}: learnable "${entry.id}" has unknown kind "${entry.kind}" `
      + `(known: vocab/vocabulary, chunk/phrase, pattern/frame). Reconcile refuses rather than guess.`);

    const surf = normSurface(entry.sl);

    // Already in the catalog by id → this should have been a `reuse`, but tolerate it idempotently IFF the
    // surface matches; a same-id/different-surface is a real conflict → fail loud.
    if (existingLearnables[entry.id]) {
      if (normSurface(existingLearnables[entry.id].sl) !== surf)
        die(`level ${lvl.level}: new learnable "${entry.id}" collides with an EXISTING id whose sl differs `
          + `("${existingLearnables[entry.id].sl}" vs "${entry.sl}"). Rename the mint or reuse the existing id.`);
      if (!reuse.includes(entry.id)) news.push(entry.id); // treat as reuse; introduces still gets it
      continue;
    }

    // DRY collision backstop: a DIFFERENT existing id (or an earlier mint this run) already owns this
    // surface → the upstream semantic dedup missed it. Refuse; the operator/critic resolves.
    const owner = surfaceToId.get(surf);
    if (owner) die(`level ${lvl.level}: new learnable "${entry.id}" ("${entry.sl}") duplicates the canonical `
      + `surface of existing learnable "${owner}". A word is minted ONCE and referenced by id — reuse "${owner}".`);

    const cleaned: any = { kind, sl: entry.sl, gloss: entry.gloss };
    if (typeof entry.predictableError === "string" && entry.predictableError) cleaned.predictableError = entry.predictableError;
    if (typeof entry.core === "boolean") cleaned.core = entry.core;
    if (typeof entry.rank === "number") cleaned.rank = entry.rank;
    toMint[entry.id] = cleaned;
    mintedIds.add(entry.id);
    surfaceToId.set(surf, entry.id);
    news.push(entry.id);
  }
  newByLevel.set(lvl.level, news);
}

// ---- Step 3: assign each level's introduces = sorted-unique(reuse + new); validate every id resolves --
const knownAfterMerge = new Set<string>([...Object.keys(existingLearnables), ...mintedIds]);
const introducesByLevel = new Map<number, string[]>();
for (const lvl of input.levels) {
  const ids = Array.from(new Set([...(reusedByLevel.get(lvl.level) ?? []), ...(newByLevel.get(lvl.level) ?? [])])).sort();
  for (const id of ids) if (!knownAfterMerge.has(id))
    die(`level ${lvl.level}: introduces id "${id}" is neither in the catalog nor minted this run`);
  introducesByLevel.set(lvl.level, ids);
}

// ---- Step 4: apply critic fixes (keyed + exact; idempotent; never fuzzy) ----------------------------
const FIX_FIELDS = new Set(["sl", "en", "deliverySL"]);
let fixesApplied = 0;
for (const fix of input.criticFixes ?? []) {
  const lvl = input.levels.find((l: any) => l.level === fix.level);
  if (!lvl) die(`criticFix targets unknown level ${fix.level}`);
  if (!FIX_FIELDS.has(fix.field)) die(`criticFix field "${fix.field}" must be one of sl|en|deliverySL`);
  const node = lvl.nodes?.[fix.nodeId];
  if (!node) die(`criticFix targets unknown node "${fix.nodeId}" in level ${fix.level}`);
  const cur = node[fix.field];
  if (cur === fix.newExact) continue;                 // already applied → idempotent skip
  if (cur !== fix.oldExact)
    die(`criticFix for ${fix.nodeId}.${fix.field}: current value ${JSON.stringify(cur)} matches neither `
      + `oldExact nor newExact. Refusing a fuzzy edit — re-issue the fix with the exact current value.`);
  node[fix.field] = fix.newExact;
  fixesApplied++;
}

// ---- Step 5: build + structurally self-check each dialogue file --------------------------------------
function selfCheckTree(level: number, root: string, nodes: Record<string, any>): void {
  if (!nodes || !Object.keys(nodes).length) die(`level ${level}: "nodes" must be non-empty`);
  if (!nodes[root]) die(`level ${level}: root "${root}" is not a node`);
  if (nodes[root].speaker !== "npc") die(`level ${level}: root "${root}" must be spoken by the npc`);
  for (const [nid, n] of Object.entries<any>(nodes)) {
    if (n.speaker !== "npc" && n.speaker !== "client") die(`level ${level} node "${nid}": speaker must be npc|client`);
    for (const k of ["sl", "en"]) if (typeof n[k] !== "string" || !n[k]) die(`level ${level} node "${nid}": "${k}" required`);
    if (!Array.isArray(n.next)) die(`level ${level} node "${nid}": next must be an array`);
    for (const t of n.next) if (!nodes[t]) die(`level ${level} node "${nid}": next → unknown node "${t}"`);
  }
  const reach = reachableFrom(root, nodes);
  const unreachable = Object.keys(nodes).filter((id) => !reach.has(id));
  if (unreachable.length) die(`level ${level}: unreachable nodes ${unreachable.join(", ")} (structural error)`);
  const terminal = canReachTerminal(nodes);
  const trapped = [...reach].filter((id) => !terminal.has(id));
  if (trapped.length) die(`level ${level}: nodes that never reach an ending ${trapped.join(", ")} (a cycle/dead spur)`);
}

function existingAudioState(file: string): "pending" | "ready" {
  // Preserve a level's built audio state on re-run (don't reset ready→pending); new files start pending.
  if (!existsSync(file)) return "pending";
  try {
    const prev = JSON.parse(readFileSync(file, "utf8"));
    return prev.audio === "ready" ? "ready" : "pending";
  } catch {
    return "pending";
  }
}

const writes: Array<{ path: string; label: string }> = [];
for (const lvl of input.levels) {
  if (typeof lvl.levelLabel !== "string" || !lvl.levelLabel) die(`level ${lvl.level}: "levelLabel" required`);
  if (typeof lvl.title !== "string" || !lvl.title) die(`level ${lvl.level}: "title" required`);
  if (!Array.isArray(lvl.objectives) || !lvl.objectives.length) die(`level ${lvl.level}: "objectives" required`);
  for (const o of lvl.objectives) if (!o.label || !o.descriptorEN) die(`level ${lvl.level}: each objective needs label + descriptorEN`);
  selfCheckTree(lvl.level, lvl.root, lvl.nodes);

  const file = path.join(DIALOGUES_DIR, `${scenarioId}-${lvl.level}.json`);
  const dialogue = {
    id: `${scenarioId}-l${lvl.level}`,
    scenarioId,
    level: lvl.level,
    levelLabel: lvl.levelLabel,
    title: lvl.title,
    objectives: lvl.objectives.map((o: any) => ({ label: o.label, descriptorEN: o.descriptorEN })),
    introduces: introducesByLevel.get(lvl.level)!,
    audio: existingAudioState(file),
    voices: { npc: voices.npc, client: voices.client },
    root: lvl.root,
    nodes: lvl.nodes,
  };
  writeFileSync(file, JSON.stringify(dialogue, null, 2) + "\n");
  writes.push({ path: file, label: `L${lvl.level} ${lvl.levelLabel}` });
}

// ---- Step 6: merge new learnables into the catalog (append; preserve order; idempotent) -------------
if (mintedIds.size) {
  const merged = { ...existingLearnables };
  for (const id of mintedIds) merged[id] = toMint[id];
  writeFileSync(LEARNABLES_FILE, JSON.stringify(merged, null, 2) + "\n");
}

// ---- Step 7: write/update the scenario MANIFEST (D2) — preserve any legacy scene/objectives ---------
const manifestFile = path.join(SCENARIOS_DIR, `${scenarioId}.json`);
const prevManifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
const manifest: any = {
  ...prevManifest,
  id: scenarioId,
  ...(S.name ? { name: S.name } : prevManifest.name ? { name: prevManifest.name } : {}),
  title: S.title,
  status: S.status ?? prevManifest.status ?? "active",
  character: S.character,
  ...(S.role ? { role: S.role } : prevManifest.role ? { role: prevManifest.role } : {}),
  setup: S.setup,
  opening: S.opening,
  ...(S.register ? { register: S.register } : prevManifest.register ? { register: prevManifest.register } : {}),
};
manifest.surfaces = {
  ...(prevManifest.surfaces ?? {}),
  dialogue: {
    voices: { npc: voices.npc, client: voices.client },
    levels: input.levels
      .map((l: any) => ({ level: l.level, levelLabel: l.levelLabel }))
      .sort((a: any, b: any) => a.level - b.level),
  },
  a1: (input.a1Candidates?.length ?? 0) > 0 ? true : (prevManifest.surfaces?.a1 ?? false),
};
manifest.objectives = prevManifest.objectives ?? []; // dialogue scenarios own no turn-loop objectives
writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");

// ---- Step 8: emit A1 candidate mappings for OPERATOR review (never auto-merged into a1-map.json) ----
const candidates = input.a1Candidates ?? [];
const candidateReport: any[] = [];
for (const c of candidates) {
  const problems: string[] = [];
  if (!knownAfterMerge.has(c.learnableId)) problems.push(`learnable "${c.learnableId}" not in catalog`);
  if (!a1CompetencyIds.has(c.competencyId)) problems.push(`competency "${c.competencyId}" not in a1-map.json`);
  candidateReport.push({ ...c, ok: problems.length === 0, problems });
}
let candidateFile = "";
if (candidateReport.length) {
  const draftDir = path.dirname(inputPath);
  if (!existsSync(draftDir)) mkdirSync(draftDir, { recursive: true });
  candidateFile = path.join(draftDir, "a1-candidates.json");
  writeFileSync(candidateFile, JSON.stringify(candidateReport, null, 2) + "\n");
}

// ---- Summary ----------------------------------------------------------------------------------------
console.log(`\n✅ reconcile-dialogue — ${scenarioId}`);
console.log(`   minted ${mintedIds.size} new learnable(s): ${[...mintedIds].join(", ") || "(none)"}`);
console.log(`   critic fixes applied: ${fixesApplied}`);
for (const lvl of input.levels) {
  const intro = introducesByLevel.get(lvl.level)!;
  const multi = [...inDegrees(lvl.nodes).entries()].filter(([, d]) => d > 1).map(([id]) => id);
  console.log(`   L${lvl.level} ${lvl.levelLabel}: introduces ${intro.length} [${intro.join(", ") || "none"}]`
    + (multi.length ? `  · convergence nodes for review: ${multi.join(", ")}` : ""));
}
console.log(`   wrote ${writes.length} dialogue file(s) + manifest ${rel(manifestFile)}`);
if (candidateFile) {
  const bad = candidateReport.filter((c) => !c.ok);
  console.log(`   A1 candidates → ${rel(candidateFile)} (${candidateReport.length}, ${bad.length} need attention). `
    + `Review + fold into a1-map.json by hand; nothing auto-mapped.`);
}
console.log(`\n   Next: npm run lint:dialogue && npm run lint:tree && npm run lint:a1 && npm run test:dialogue`);
console.log(`   (data reload needs a server restart — new JSON loads only at startup.)\n`);
process.exit(0);
