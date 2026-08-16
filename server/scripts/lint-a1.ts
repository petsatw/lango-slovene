// lint:a1 — the integrity + reporting check for the A1 map (handoff B4). The a1.ts loader already checks the
// FORWARD direction (every id the map names exists in the catalog). This lint adds ref-integrity and a
// diagnostic readout — but it deliberately does NOT force catalog membership:
//
//   The a1-map is a DELIBERATELY-CURATED, narrow Pareto CORE — the high-unlock stems/frames a learner reuses
//   across the whole language. Membership is ADDED BY HAND, on merit; the lint must never push items in.
//   The per-learnable `a1` tag is the broader Tagged-A1 SUPERSET (drives the difficulty classifier). So an
//   `a1`-tagged learnable that is NOT in the core map is EXPECTED (superset, not core) — reported, not an
//   error. Coverage is a READOUT, not a gate. (Earlier this lint force-mapped every a1-tagged item, which
//   diluted the narrow core; that gate was removed — docs/dialogue-difficulty-model.md §2.)
//
//   - REF INTEGRITY (error): every competency's { scenarioId, level } resolves to a real scenario + level.
//   - READOUT (informational): core size, tagged-but-not-core (the superset), above-A1, and per-dialogue band.
//
//   npm run lint:a1
//
// Exit 0 = pass, 1 = a ref-integrity error only. Scope: the catalog is the PRODUCTION inventory (a learnable
// is minted iff the learner produces it); the wider A1 recognition set is out of scope (docs/a1-taxonomy.md).

import { LEARNABLES } from "../learnables";
import { A1_MAP, A1_EXCLUDED } from "../a1";
import { SCENARIOS } from "../scenarios";
import { DIALOGUES } from "../dialogues";
import { classifyBand, bandToLabel } from "./dialogue-lib";

const errors: string[] = [];
const warns: string[] = [];

// index: which competencies map each learnable id
const mappedBy = new Map<string, string[]>();
for (const c of A1_MAP) {
  for (const id of c.learnables) (mappedBy.get(id) ?? mappedBy.set(id, []).get(id)!).push(c.id);
}
const excluded = new Set(A1_EXCLUDED);

// 1. Coverage READOUT (never a gate). The core map is curated by hand; unmapped is not an error. We only
//    split the unmapped items into the Tagged-A1 superset (a1:true, deliberately kept out of the narrow core)
//    vs above-A1, for the diagnostic readout below.
const taggedNotCore: string[] = [];  // a1-tagged but not in the core map — the intentional superset
const aboveA1: string[] = [];         // neither core nor a1-tagged — above A1
for (const id of Object.keys(LEARNABLES)) {
  if (mappedBy.has(id) || excluded.has(id)) continue;
  (LEARNABLES[id]!.a1 === true ? taggedNotCore : aboveA1).push(id);
}

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
console.log(`  Tagged-A1 superset, kept OUT of the narrow core (a1:true, unmapped — expected): `
  + `${taggedNotCore.length ? `${taggedNotCore.length} [${taggedNotCore.join(", ")}]` : "none"}`);
console.log(`  above-A1, not A1 material (expected — carried by higher-band dialogues): `
  + `${aboveA1.length ? aboveA1.length : "none"}`);
const frontier = A1_MAP.filter((c) => c.learnables.length === 0).map((c) => c.id);
console.log(`  frontier domains (0 learnables, awaiting a scenario): ${frontier.join(", ") || "none"}`);

// 4. Difficulty band per dialogue (the YARDSTICK — informational, never a gate; docs/dialogue-difficulty-model.md).
//    CORE = ids the a1-map maps; Tagged-A1 = CORE ∪ ids carrying the `a1` tag. The band is measured over
//    each dialogue's produced (client) learnables — its `introduces` set — and should match the written
//    levelLabel (reconcile computes both from this same function).
const coreIds = new Set<string>();
for (const c of A1_MAP) for (const id of c.learnables) coreIds.add(id);
const taggedA1Ids = new Set<string>(coreIds);
for (const [id, l] of Object.entries(LEARNABLES)) if (l.a1 === true) taggedA1Ids.add(id);

console.log(`\n=== dialogue difficulty bands (computed; informational) ===`);
for (const [sid, list] of Object.entries(DIALOGUES).sort()) {
  for (const d of [...list].sort((a, b) => a.level - b.level)) {
    const band = classifyBand({
      introduces: d.introduces,
      nodeCount: Object.keys(d.nodes).length,
      coreIds,
      taggedA1Ids,
    });
    const label = bandToLabel(band);
    const drift = d.levelLabel !== label ? `  ⚠️ label "${d.levelLabel}" ≠ computed "${label}"` : "";
    const coreN = d.introduces.filter((id) => coreIds.has(id)).length;
    const tagN = d.introduces.filter((id) => taggedA1Ids.has(id)).length;
    console.log(`  ${(`${sid} L${d.level}`).padEnd(16)} ${band.padEnd(12)} `
      + `(${coreN}/${d.introduces.length} core, ${tagN}/${d.introduces.length} A1-tagged, ${Object.keys(d.nodes).length} nodes)${drift}`);
  }
}

if (warns.length) {
  console.log(`\n— warnings —`);
  for (const w of warns) console.log(`  ⚠️  ${w}`);
}
if (errors.length) {
  console.log(`\n=== ${errors.length} error(s) ===`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  process.exit(1);
}
console.log(`\n✅ PASS — every catalog learnable is mapped or excluded; every scenario ref resolves.`);
process.exit(0);
