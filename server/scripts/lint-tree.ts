// lint:tree — the STRUCTURAL gate for rehearsal-dialogue trees (handoff B2). Complements lint:dialogue
// (which checks the dialogue↔catalog seam) by checking the SHAPE of each tree and its agreement with the
// scenario MANIFEST (D2). What a script CAN check deterministically it errors on; the one thing it can't
// judge — whether a re-convergence node reads coherently on every incoming path — it SURFACES for human
// review rather than pretending to rule on.
//
//   npm run lint:tree
//
// ERRORS (exit 1): root not npc · unreachable nodes · a path that never ends (cycle/dead spur) · manifest
//   disagreement (a declared level with no file, a dialogue file the manifest doesn't declare, a
//   level-label or voices mismatch).
// REVIEW / WARN (exit 0): multi-parent convergence nodes (eyeball each for path coherence) · an npc node
//   that offers a single client choice (degenerate — no real decision). Trees may offer MORE than two
//   choices (docs/dialogue-difficulty-model.md §5 — a complication carried as an extra branch); that is a
//   supported shape, not a warning.

import { DIALOGUES } from "../dialogues";
import { SCENARIOS } from "../scenarios";
import { inDegrees, reachableFrom, canReachTerminal, type TreeNodes } from "./dialogue-lib";

const errors: string[] = [];
const reviews: string[] = [];
const warns: string[] = [];

const allDialogues = Object.values(DIALOGUES).flat();

// ---- 1. Per-tree structure ------------------------------------------------------------------------
for (const d of allDialogues) {
  const nodes = d.nodes as unknown as TreeNodes;
  const where = `${d.id}`;

  if (nodes[d.root]?.speaker !== "npc") errors.push(`${where}: root "${d.root}" must be an npc node`);

  const reach = reachableFrom(d.root, nodes);
  const unreachable = Object.keys(nodes).filter((id) => !reach.has(id));
  if (unreachable.length) errors.push(`${where}: unreachable node(s) ${unreachable.join(", ")}`);

  const terminal = canReachTerminal(nodes);
  const trapped = [...reach].filter((id) => !terminal.has(id));
  if (trapped.length) errors.push(`${where}: node(s) that never reach an ending ${trapped.join(", ")} (cycle/dead spur)`);

  // Multi-parent = re-convergence: coherent only if the node reads on EVERY incoming path. Surface, don't rule.
  const multi = [...inDegrees(nodes).entries()].filter(([, deg]) => deg > 1).map(([id]) => id);
  if (multi.length) reviews.push(`${where}: convergence node(s) ${multi.join(", ")} — verify each reads on all incoming paths`);

  // A fork should offer a real decision: ≥2 client choices (or 0 = a terminal / a single npc→npc beat).
  // >2 is a supported shape (a complication branch), so only a lone single choice is worth a warning.
  // NOT in "audio" mode: the learner speaks rather than picks, so a single continuation is the normal
  // shape there (a linear spine) and warning on every beat would be noise.
  if ((d.advance ?? "tap") === "tap") {
    for (const [nid, n] of Object.entries(nodes)) {
      if (n.speaker === "npc" && n.next.length === 1)
        warns.push(`${where}: npc node "${nid}" offers a single choice — a fork should present ≥2 (no real decision otherwise)`);
    }
  }
}

// ---- 2. Manifest ↔ files consistency (D2 — the manifest is the source of truth) --------------------
const scenarioById = new Map(SCENARIOS.map((s) => [s.id, s]));

// every dialogue file must be declared by its scenario's manifest, with matching label + voices
for (const d of allDialogues) {
  const scn = scenarioById.get(d.scenarioId);
  if (!scn) { errors.push(`${d.id}: scenarioId "${d.scenarioId}" resolves to no scenario`); continue; }
  const decl = scn.surfaces?.dialogue;
  if (!decl) { errors.push(`${d.id}: scenario "${d.scenarioId}" has a dialogue file but no surfaces.dialogue manifest`); continue; }
  const lv = decl.levels.find((l) => l.level === d.level);
  if (!lv) { errors.push(`${d.id}: level ${d.level} is not declared in the "${d.scenarioId}" manifest`); continue; }
  if (lv.levelLabel !== d.levelLabel)
    errors.push(`${d.id}: levelLabel "${d.levelLabel}" ≠ manifest "${lv.levelLabel}"`);
  if (decl.voices.npc !== d.voices.npc || decl.voices.client !== d.voices.client)
    errors.push(`${d.id}: voices ${JSON.stringify(d.voices)} ≠ manifest ${JSON.stringify(decl.voices)}`);
  if ((decl.advance ?? "tap") !== (d.advance ?? "tap"))
    errors.push(`${d.id}: advance "${d.advance ?? "tap"}" ≠ manifest "${decl.advance ?? "tap"}"`);
}

// every manifest-declared level must have a file
for (const scn of SCENARIOS) {
  const decl = scn.surfaces?.dialogue;
  if (!decl) continue;
  const levels = new Set((DIALOGUES[scn.id] ?? []).map((d) => d.level));
  for (const lv of decl.levels)
    if (!levels.has(lv.level)) errors.push(`${scn.id}: manifest declares level ${lv.level} but no dialogue file has it`);
}

// ---- Report ----------------------------------------------------------------------------------------
console.log(`=== tree structure (${allDialogues.length} dialogue tree(s)) ===`);
if (reviews.length) {
  console.log(`\n— convergence nodes to eyeball (not errors) —`);
  for (const r of reviews) console.log(`  🔎 ${r}`);
}
if (warns.length) {
  console.log(`\n— warnings —`);
  for (const w of warns) console.log(`  ⚠️  ${w}`);
}
if (errors.length) {
  console.log(`\n=== ${errors.length} structural error(s) ===`);
  for (const e of errors) console.log(`  ❌ ${e}`);
  process.exit(1);
}
console.log(`\n✅ PASS — every tree is rooted on the npc, fully reachable, terminating, and manifest-consistent.`);
process.exit(0);
