// lint:a1 — the coverage + integrity gate for the A1 map (handoff B4). The a1.ts loader already checks the
// FORWARD direction (every id the map names exists in the catalog). This lint adds the REVERSE — the check
// that keeps the map from silently drifting as the catalog grows:
//
//   - COVERAGE: every catalog learnable is mapped to ≥1 competency OR is on the explicit `excluded` list.
//     A learnable that is neither is a coverage error (a new word the map forgot).
//   - REF INTEGRITY: every competency's { scenarioId, level } resolves to a real scenario AND a real
//     dialogue level.
//   - COVERAGE REPORT: mapped/total, per-competency counts, and which competencies are empty frontier
//     domains (informational — a domain the shipped scenarios don't reach yet is expected, not an error).
//
//   npm run lint:a1
//
// Exit 0 = pass, 1 = a coverage or ref error (so authoring can gate on it).
// Scope: the catalog is the PRODUCTION inventory (a learnable is minted iff the learner produces it), so
// coverage is over produced learnables only; the wider A1 recognition set is out of scope (docs/a1-taxonomy.md).

import { LEARNABLES } from "../learnables";
import { A1_MAP, A1_EXCLUDED } from "../a1";
import { SCENARIOS } from "../scenarios";
import { DIALOGUES } from "../dialogues";

const errors: string[] = [];
const warns: string[] = [];

// index: which competencies map each learnable id
const mappedBy = new Map<string, string[]>();
for (const c of A1_MAP) {
  for (const id of c.learnables) (mappedBy.get(id) ?? mappedBy.set(id, []).get(id)!).push(c.id);
}
const excluded = new Set(A1_EXCLUDED);

// 1. Coverage — every catalog learnable mapped or excluded.
const unmapped = Object.keys(LEARNABLES).filter((id) => !mappedBy.has(id) && !excluded.has(id));
for (const id of unmapped) errors.push(`learnable "${id}" ("${LEARNABLES[id]!.sl}") is mapped to no competency and not excluded`);

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
const frontier = A1_MAP.filter((c) => c.learnables.length === 0).map((c) => c.id);
console.log(`  frontier domains (0 learnables, awaiting a scenario): ${frontier.join(", ") || "none"}`);

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
