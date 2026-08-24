// reconcile-dialogue — the DETERMINISTIC L-lane writer of the rehearsal-dialogue pipeline (handoff B1).
//
// It takes ONE orchestrator-assembled draft bundle (authored by the create-dialogue skill: the tree the
// orchestrator specced + the language slovenian-author wrote + the fixes scenario-critic returned) and
// turns it into committed files: the per-level dialogue JSONs, the scenario MANIFEST (D2), and the merged
// learnable catalog — then emits candidate A1 mappings for operator review (D5i).
//
//   npm run reconcile:dialogue -- <path-to-reconcile-input.json>
//   npm run reconcile:dialogue -- authoring/dialogues/pharmacy/reconcile-input.json
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
import {
  normSurface, normalizeKind, inDegrees, reachableFrom, canReachTerminal,
  bandFor, bandToLabel, bandRank, type DialogueBand,
} from "./dialogue-lib";

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
//   dialogueAdvance?: "tap" | "audio",                     // default "tap" — how the learner advances
//   dialoguePacing?: string,                               // spoken scenes: pacing profile id (catalog/pacing.json);
//                                                          // absent → whatever is already on the file is preserved
//   levels: [ { level, levelLabel /* author TARGET; the written label is the COMPUTED band */, title,
//              objectives:[{label,descriptorEN}], root, nodes:{ <id>:{ speaker, sl, en, deliverySL?,
//              slowSL? /* chunked-slow re-speak: own caption, own audio key */, deliverySlowSL? /* its delivery tags */,
//              learnables? /* what the line is MADE OF, on any node — the per-line band counts these.
//                             On a client node it doubles as the "audio"-mode attempt allowlist. May be [] */,
//              captionDelayMs? /* overrides the profile's captionLeadMs for this one beat */, glossPolicy? /* tap|after|held */,
//              stallHandlers? /* npc nodes; [{kind:"pulse"|"respeak"|"soften",label?}] — NO Slovene;
//                                timing comes from the pacing profile by position, afterMs only to override */,
//              context? /* parenthetical on a client choice */, next } }, background?, intro?:{audio,text?,en?},
//              frameEN? /* the English on-ramp shown before the scene opens */,
//              catalog: { reuse:[id…], new:[{id,kind,sl,gloss,predictableError?,core?,a1?,rank?}…] } } ],
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

// How the learner advances this scenario's levels — tapped rehearsal choices (the default) or spoken
// turns. Scenario-wide: a package is a rehearsal tree or a spoken scene, not a mix.
const advance: "tap" | "audio" = input.dialogueAdvance ?? "tap";
if (advance !== "tap" && advance !== "audio") die(`"dialogueAdvance" must be "tap" | "audio"`);

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
    if (typeof entry.a1 === "boolean") cleaned.a1 = entry.a1; // Tagged-A1 decision, made at mint (docs §2)
    if (typeof entry.rank === "number") cleaned.rank = entry.rank;
    toMint[entry.id] = cleaned;
    mintedIds.add(entry.id);
    surfaceToId.set(surf, entry.id);
    news.push(entry.id);
  }
  newByLevel.set(lvl.level, news);
}

// ---- Step 3: introduces = what this level is the FIRST to have the learner PRODUCE ------------------
// The field means what its name says: new to the LEARNER here, not everything the level covers — so a
// course that deliberately re-practises earlier phrases never has a later level claim to introduce them.
// Walked in level order, the first level to elicit an id owns it.
const knownAfterMerge = new Set<string>([...Object.keys(existingLearnables), ...mintedIds]);
const introducesByLevel = new Map<number, string[]>();
const introducedAlready = new Set<string>();
for (const lvl of [...input.levels].sort((a: any, b: any) => a.level - b.level)) {
  // The declared catalog delta, NOT the client nodes. `introduces` is the free-chat handoff — what this
  // level hands the learner — and it must hold for a tapped tree whose nodes carry no `learnables` yet.
  const covered = new Set<string>([...(reusedByLevel.get(lvl.level) ?? []), ...(newByLevel.get(lvl.level) ?? [])]);
  const ids = [...covered].filter((id) => !introducedAlready.has(id)).sort();
  for (const id of ids) {
    if (!knownAfterMerge.has(id))
      die(`level ${lvl.level}: learnable "${id}" is neither in the catalog nor minted this run`);
    introducedAlready.add(id);
  }
  introducesByLevel.set(lvl.level, ids);
}

// ---- Difficulty bands (docs/dialogue-difficulty-model.md §3): computed, not authored ---------------
// CORE is the learnable's own `core: true` flag — the one source of truth for Pareto-unlock membership.
// Tagged-A1 = CORE ∪ ids carrying the `a1` tag (in the existing catalog OR minted this run). The band is
// measured PER LINE and OVERRIDES the author's `levelLabel` target — the author aims, the classifier labels.
//
// The override is earned by MEASURING. A level whose nodes carry no `learnables` cannot be measured per
// line, and the `introduces` fallback is not a second opinion — it weighs a noun as heavily as the frame it
// sits in, so a tree of core frames with vocabulary in their slots reads far harder than it is. On that
// basis the author's label STANDS and the run recommends tagging; only a per-line band is written.
const coreIds = new Set<string>();
for (const [id, l] of Object.entries(existingLearnables)) if ((l as any).core === true) coreIds.add(id);
for (const [id, l] of Object.entries(toMint)) if ((l as any).core === true) coreIds.add(id);
const taggedA1Ids = new Set<string>(coreIds);
for (const [id, l] of Object.entries(existingLearnables)) if ((l as any).a1 === true) taggedA1Ids.add(id);
for (const [id, l] of Object.entries(toMint)) if ((l as any).a1 === true) taggedA1Ids.add(id);

const bandByLevel = new Map<number, DialogueBand>();
const unmeasuredLevels: Array<{ level: number; guess: DialogueBand }> = [];
for (const lvl of input.levels) {
  const tally = bandFor(
    { advance, introduces: introducesByLevel.get(lvl.level)!, nodes: lvl.nodes },
    coreIds,
    taggedA1Ids,
  );
  if (tally.basis === "line") bandByLevel.set(lvl.level, tally.band);
  else unmeasuredLevels.push({ level: lvl.level, guess: tally.band });
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
    if (n.context !== undefined) {
      if (typeof n.context !== "string" || !n.context) die(`level ${level} node "${nid}": "context" must be a non-empty string`);
      if (n.speaker !== "client") die(`level ${level} node "${nid}": "context" is only valid on a client choice`);
    }
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

function existingBackground(file: string): string | undefined {
  // A level's scene background lives on the file, not in the reconcile input by default — preserve it on
  // re-run so re-authoring never silently strips a wired-in background. An input `level.background` wins.
  if (!existsSync(file)) return undefined;
  try {
    const bg = JSON.parse(readFileSync(file, "utf8")).background;
    return typeof bg === "string" && bg ? bg : undefined;
  } catch {
    return undefined;
  }
}

function normalizeIntro(raw: any): { audio: string; text?: string; en?: string } | undefined {
  // A level's opening Slavko monologue: { audio (filename under public/intros/), text?, en? }. The author
  // supplies text+en; audio is the target filename the OPERATOR generates separately (never here).
  if (!raw || typeof raw !== "object") return undefined;
  if (typeof raw.audio !== "string" || !raw.audio) return undefined;
  const intro: { audio: string; text?: string; en?: string } = { audio: raw.audio };
  if (typeof raw.text === "string" && raw.text) intro.text = raw.text;
  if (typeof raw.en === "string" && raw.en) intro.en = raw.en;
  return intro;
}

function existingIntro(file: string): { audio: string; text?: string; en?: string } | undefined {
  // Like background: an intro wired onto the file is preserved on re-run unless the input supplies one.
  if (!existsSync(file)) return undefined;
  try {
    return normalizeIntro(JSON.parse(readFileSync(file, "utf8")).intro);
  } catch {
    return undefined;
  }
}

function existingPacing(file: string): string | undefined {
  // A spoken scene's PACING PROFILE (server/catalog/pacing.json) is timing, not language — it is wired
  // onto the file and must survive a re-authoring pass. Without this a reconcile silently strips it and
  // the lesson falls back to the default profile, which is exactly the kind of drift the profile exists
  // to prevent. An input `dialoguePacing` wins.
  if (!existsSync(file)) return undefined;
  try {
    const p = JSON.parse(readFileSync(file, "utf8")).pacing;
    return typeof p === "string" && p ? p : undefined;
  } catch {
    return undefined;
  }
}

const BAND_NAMES = new Map<string, DialogueBand>(
  (["basic", "intermediate", "advanced", "above-a1"] as DialogueBand[]).map((b) => [b, b]),
);

const writes: Array<{ path: string; label: string }> = [];
const computedLabelByLevel = new Map<number, string>();
for (const lvl of input.levels) {
  // `levelLabel` in the input is the author's TARGET; a per-line band overrides it (docs §4). An untagged
  // level has no measured band, so the author's label stands.
  if (typeof lvl.levelLabel !== "string" || !lvl.levelLabel) die(`level ${lvl.level}: "levelLabel" (author target) required`);
  if (typeof lvl.title !== "string" || !lvl.title) die(`level ${lvl.level}: "title" required`);
  if (!Array.isArray(lvl.objectives) || !lvl.objectives.length) die(`level ${lvl.level}: "objectives" required`);
  for (const o of lvl.objectives) if (!o.label || !o.descriptorEN) die(`level ${lvl.level}: each objective needs label + descriptorEN`);
  selfCheckTree(lvl.level, lvl.root, lvl.nodes);

  const file = path.join(DIALOGUES_DIR, `${scenarioId}-${lvl.level}.json`);
  // An author target that names a band ("advanced") is written in the classifier's own casing, so a
  // measured and an unmeasured level never disagree about how the same band is spelled.
  const band = bandByLevel.get(lvl.level);
  const asBand = BAND_NAMES.get(lvl.levelLabel.toLowerCase().trim());
  const computedLabel = band ? bandToLabel(band) : asBand ? bandToLabel(asBand) : lvl.levelLabel;
  computedLabelByLevel.set(lvl.level, computedLabel);
  const background = (typeof lvl.background === "string" && lvl.background ? lvl.background : undefined)
    ?? existingBackground(file);
  const intro = normalizeIntro(lvl.intro) ?? existingIntro(file);
  const pacing = (typeof input.dialoguePacing === "string" && input.dialoguePacing ? input.dialoguePacing : undefined)
    ?? existingPacing(file);
  const dialogue = {
    id: `${scenarioId}-l${lvl.level}`,
    scenarioId,
    level: lvl.level,
    levelLabel: computedLabel,
    title: lvl.title,
    objectives: lvl.objectives.map((o: any) => ({ label: o.label, descriptorEN: o.descriptorEN })),
    introduces: introducesByLevel.get(lvl.level)!,
    audio: existingAudioState(file),
    voices: { npc: voices.npc, client: voices.client },
    ...(advance === "tap" ? {} : { advance }), // omit the default so existing files stay byte-identical
    ...(pacing ? { pacing } : {}),
    ...(Array.isArray(lvl.frameEN) && lvl.frameEN.length ? { frameEN: lvl.frameEN } : {}),
    ...(background ? { background } : {}),
    ...(intro ? { intro } : {}),
    root: lvl.root,
    nodes: lvl.nodes,
  };
  writeFileSync(file, JSON.stringify(dialogue, null, 2) + "\n");
  writes.push({ path: file, label: `L${lvl.level} ${computedLabel}` });
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
    ...(advance === "tap" ? {} : { advance }),
    levels: input.levels
      .map((l: any) => ({ level: l.level, levelLabel: computedLabelByLevel.get(l.level)! }))
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
  const band = bandByLevel.get(lvl.level);
  const target = lvl.levelLabel;
  const multi = [...inDegrees(lvl.nodes).entries()].filter(([, d]) => d > 1).map(([id]) => id);
  const verdict = band
    ? `computed band=${band} (author target "${target}")`
    : `label "${target}" kept — nodes carry no learnables, so the band is unmeasured`;
  console.log(`   L${lvl.level} ${verdict}: introduces ${intro.length} [${intro.join(", ") || "none"}]`
    + (multi.length ? `  · convergence nodes for review: ${multi.join(", ")}` : ""));
}
if (unmeasuredLevels.length) {
  console.log(`   ⚠️  ${unmeasuredLevels.length} level(s) shipped with the AUTHOR's label because their nodes carry no`);
  console.log(`       "learnables": ${unmeasuredLevels.map((u) => `L${u.level}`).join(", ")}. Tag every node (npc included) in`);
  console.log(`       this input and re-run to have the band measured per line (docs/dialogue-difficulty-model.md §3).`);
  console.log(`       For reference the coarse per-introduces guess would be: `
    + unmeasuredLevels.map((u) => `L${u.level}=${u.guess}`).join(", ") + ` — not written.`);
}
// The ordinal `level` stays author-assigned; a non-ascending band order is a review signal, not an auto-renumber.
// Only measured levels take part; an unmeasured one is a gap, not evidence of a jump.
const orderedBands = [...input.levels]
  .sort((a: any, b: any) => a.level - b.level)
  .map((l: any) => bandByLevel.get(l.level))
  .filter((b): b is DialogueBand => b !== undefined);
for (let i = 1; i < orderedBands.length; i++) {
  if (bandRank(orderedBands[i]!) < bandRank(orderedBands[i - 1]!)) {
    console.log(`   ⚠️  computed bands are not ascending by level (${orderedBands.join(" → ")}) — `
      + `consider re-ordering the level numbers so tabs run easy → hard.`);
    break;
  }
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
