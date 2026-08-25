// lint:a1 — the integrity + reporting check for the A1 map. The a1.ts loader checks the FORWARD direction
// (every id the map names exists in the catalog); this lint adds the reverse checks and a diagnostic readout.
//
//   The a1-map is ONLY a mapping of competencies to learnables that are core and/or A1-tagged. It answers
//   *which life domain does this item serve, and how far along is the learner in that domain* — it does NOT
//   answer *is this core*; that is the learnable's own `core: true` flag. The map is many-to-many by design
//   (`hvala` serves both pragmatics and personal_relations), which is what makes it the right shape for
//   coverage. Its one live product job is the A1 Readiness screen (GET /api/a1), the learner's whole
//   progress surface — so an item missing from it can be mastered with nothing visibly moving.
//
//   - REF INTEGRITY (error): every competency's { scenarioId, level } resolves to a real scenario + level.
//   - READINESS COVERAGE (error): every `core: true` or `a1: true` learnable is named by ≥1 competency.
//   - READOUT (informational): core size, above-A1, and per-dialogue band.
//
//   npm run lint:a1
//
// Exit 0 = pass, 1 = a ref-integrity error only. Scope: the catalog is the PRODUCTION inventory (a learnable
// is minted iff the learner produces it); the wider A1 recognition set is out of scope (docs/a1-taxonomy.md).

import { LEARNABLES } from "../learnables";
import { A1_MAP, A1_EXCLUDED } from "../a1";
import { SCENARIOS } from "../scenarios";
import { DIALOGUES } from "../dialogues";
import { bandFor, bandToLabel } from "./dialogue-lib";

const errors: string[] = [];
const warns: string[] = [];

// index: which competencies map each learnable id
const mappedBy = new Map<string, string[]>();
for (const c of A1_MAP) {
  for (const id of c.learnables) (mappedBy.get(id) ?? mappedBy.set(id, []).get(id)!).push(c.id);
}
const excluded = new Set(A1_EXCLUDED);

// 1. Readiness coverage. A learnable that is core and/or A1-tagged is A1 material the readiness screen is
//    supposed to show, so it must sit under ≥1 competency (or on the explicit `excluded` list). An unmapped
//    above-A1 item is expected — higher-band dialogues carry it and the readiness screen does not track it.
const unmappedA1: string[] = [];      // core and/or a1-tagged, but named by no competency — invisible progress
const aboveA1: string[] = [];         // neither core nor a1-tagged — above A1
for (const [id, l] of Object.entries(LEARNABLES)) {
  if (mappedBy.has(id) || excluded.has(id)) continue;
  (l.a1 === true || (l as any).core === true ? unmappedA1 : aboveA1).push(id);
}
for (const id of unmappedA1)
  errors.push(`"${id}" is core/a1-tagged but no competency names it — it would be invisible on the A1 Readiness screen`);

// excluded but also mapped → redundant (harmless, but flag it)
for (const id of excluded) if (mappedBy.has(id)) warns.push(`"${id}" is on 'excluded' but also mapped by ${mappedBy.get(id)!.join(", ")}`);

// 2. Ref integrity — every { scenarioId, level } resolves to a scenario + a dialogue level.
const scenarioIds = new Set(SCENARIOS.map((s) => s.id));
const dialogueLevels = new Map<string, Set<number>>();
for (const [sid, list] of Object.entries(DIALOGUES)) dialogueLevels.set(sid, new Set(list.map((d) => d.level)));
for (const c of A1_MAP) {
  for (const s of c.scenarios) {
    if (!scenarioIds.has(s.scenarioId)) { errors.push(`competency "${c.id}": scenario ref "${s.scenarioId}" resolves to no scenario`); continue; }
    if (!dialogueLevels.get(s.scenarioId)?.has(s.level))
      errors.push(`competency "${c.id}": ref { ${s.scenarioId}, level ${s.level} } has no dialogue file`);
  }
}

// 3. Coverage report.
console.log(`=== A1 competency coverage ===`);
for (const c of A1_MAP) {
  const n = c.learnables.length;
  const tag = n === 0 ? "  (frontier — not yet exercised)" : "";
  console.log(`  ${c.kind === "foundational" ? "▪" : "·"} ${c.id.padEnd(22)} ${String(n).padStart(2)} learnable(s)${tag}`);
}
const mappedCount = Object.keys(LEARNABLES).filter((id) => mappedBy.has(id)).length;
console.log(`\n=== coverage ===`);
console.log(`  ${mappedCount}/${Object.keys(LEARNABLES).length} catalog learnables are mapped to ≥1 competency.`);
console.log(`  excluded (deliberately unmapped): ${A1_EXCLUDED.join(", ") || "none"}`);
console.log(`  core/a1-tagged but unmapped (invisible on the readiness screen — an error): `
  + `${unmappedA1.length ? `${unmappedA1.length} [${unmappedA1.join(", ")}]` : "none"}`);
console.log(`  above-A1, not A1 material (expected — carried by higher-band dialogues): `
  + `${aboveA1.length ? aboveA1.length : "none"}`);
const frontier = A1_MAP.filter((c) => c.learnables.length === 0).map((c) => c.id);
console.log(`  frontier domains (0 learnables, awaiting a scenario): ${frontier.join(", ") || "none"}`);

// 4. Difficulty band per dialogue (the YARDSTICK — informational, never a gate; docs/dialogue-difficulty-model.md §3).
//    CORE is the learnable's own `core: true` flag — the single source of truth for core membership;
//    Tagged-A1 = CORE ∪ ids carrying the `a1` tag. The band is measured per line and should match the
//    written levelLabel (reconcile computes both from this same function).
const coreIds = new Set<string>(Object.entries(LEARNABLES).filter(([, l]) => (l as any).core === true).map(([id]) => id));
const taggedA1Ids = new Set<string>(coreIds);
for (const [id, l] of Object.entries(LEARNABLES)) if (l.a1 === true) taggedA1Ids.add(id);

console.log(`\n=== dialogue difficulty bands (computed; informational) ===`);
console.log(`  basis "line" = per-node learnables, the model — its band is authoritative and drift from the written`);
console.log(`  label is a real disagreement. "intro" = the coarse per-introduces guess for a tree whose nodes are`);
console.log(`  untagged; it weighs a noun as heavily as the frame around it, so it reads harder than the truth and`);
console.log(`  is never written. Tag those nodes to measure them.`);
let untaggedLevels = 0;
for (const [sid, list] of Object.entries(DIALOGUES).sort()) {
  for (const d of [...list].sort((a, b) => a.level - b.level)) {
    const t = bandFor(d, coreIds, taggedA1Ids);
    const measured = t.basis === "line";
    if (!measured) untaggedLevels++;
    const label = bandToLabel(t.band);
    const drift = measured && d.levelLabel !== label ? `  ⚠️ label "${d.levelLabel}" ≠ computed "${label}"` : "";
    const untagged = t.unmeasured ? `, ${t.unmeasured} untagged` : "";
    console.log(`  ${(`${sid} L${d.level}`).padEnd(16)} ${(measured ? t.band : `(${t.band})`).padEnd(14)} ${measured ? "line " : "intro"} `
      + `(${t.core}/${t.counted} core, ${t.core + t.a1}/${t.counted} A1${untagged}, ${Object.keys(d.nodes).length} nodes)`
      + `${measured ? "" : `  label "${d.levelLabel}"`}${drift}`);
  }
}
if (untaggedLevels) console.log(`\n  ${untaggedLevels} level(s) cannot be banded — their nodes carry no "learnables".`);

if (warns.length) {
  console.log(`\n— warnings —`);
  for (const w of warns) console.log(`  ⚠️  ${w}`);
}
if (errors.length) {
  console.log(`\n=== ${errors.length} error(s) ===`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  process.exit(1);
}
console.log(`\n✅ PASS — every core/A1 learnable is mapped or excluded; every scenario ref resolves.`);
process.exit(0);
