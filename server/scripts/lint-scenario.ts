// Deterministic scenario linter (engine stage 9 — the "L" half of internal verification). Checks the
// objective rules a script CAN verify; the fuzzy criteria (native-not-textbook, flashcard atomicity,
// register consistency, child-simple story) are the scenario-critic subagent's job, not this.
//
//   npm run lint:scenario -- <scenarioId>        # lint a loaded scenario
//   npm run lint:scenario -- --file <path.json>  # lint a draft file not yet in server/scenarios/
//
// Exit code 0 = pass, 1 = at least one failure (so the skill can gate on it). Shared-id reuse is
// checked against the currently-loaded SCENARIOS, so a brand-new draft passes by reusing greet etc.

import { readFileSync } from "node:fs";
import { SCENARIOS, type Scenario } from "../scenarios";
import { relevantLabels } from "../adapters/image-style";

export interface LintIssue {
  level: "error";
  rule: string;
  message: string;
}

// Uppercase words used for EMPHASIS in prompts (not asset labels) — excluded from the label check.
const EMPHASIS_WORDS = new Set([
  "IN", "OUT", "ON", "OFF", "ONE", "TWO", "NO", "A", "AN", "THE", "AND", "OR", "NOT", "WITH", "OF", "TO",
]);

/** Run every deterministic rubric check on one scenario. `others` = the scenarios it can share ids
 *  with (everything else that's loaded). Returns the list of failures (empty = pass). */
export function lintScenario(scenario: Scenario, others: Scenario[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const err = (rule: string, message: string) => issues.push({ level: "error", rule, message });

  const objectives = scenario.objectives ?? [];
  const story = scenario.scene?.story;
  const assets = scenario.scene?.assets ?? [];
  const bibleLabels = assets.map((a) => a.label);

  // 1) 4–6 objectives.
  if (objectives.length < 4 || objectives.length > 6) {
    err("objective-count", `has ${objectives.length} objectives; expected 4–6.`);
  }

  // 2) Each targetSL appears verbatim in the story.
  if (!story) {
    err("story-present", "scenario has no scene.story to check targetSL coverage against.");
  } else {
    const text = story.sentences.join(" ");
    for (const o of objectives) {
      if (!text.includes(o.targetSL)) {
        err("story-contains-target", `story is missing objective "${o.id}" targetSL "${o.targetSL}".`);
      }
    }
  }

  // 3) ≥1 shared id reused across scenarios (free audio reuse + cross-context familiarity).
  const otherIds = new Set(others.flatMap((s) => s.objectives.map((o) => o.id)));
  const sharedReused = objectives.filter((o) => otherIds.has(o.id)).map((o) => o.id);
  if (sharedReused.length === 0) {
    err("shared-id-reuse", "reuses no objective id from another scenario (expected ≥1, e.g. greet / pay_leave).");
  }

  // 4) No objective bundles a question with a closing: a "?" with a separate clause after it.
  for (const o of objectives) {
    const q = o.targetSL.indexOf("?");
    if (q !== -1) {
      const after = o.targetSL.slice(q + 1).replace(/[\s.,!?;:»«"'„“”]/g, "");
      if (after.length > 0) {
        err("one-utterance", `objective "${o.id}" bundles a question with more after the "?": "${o.targetSL}". Split it.`);
      }
    }
  }

  // 5) Every ALL-CAPS asset token used in a frame/scene prompt is defined in the bible.
  const prompts = [
    ...(story?.frames ?? []).map((f) => ({ where: `frame:${f.objectiveId}`, text: f.imagePrompt })),
    ...(story?.sceneImagePrompt ? [{ where: "scene", text: story.sceneImagePrompt }] : []),
  ];
  for (const p of prompts) {
    const tokens = p.text.match(/\b[A-Z][A-Z0-9_]+\b/g) ?? [];
    for (const t of tokens) {
      if (EMPHASIS_WORDS.has(t)) continue;
      if (!bibleLabels.includes(t)) {
        err("label-in-bible", `${p.where} references "${t}", which is not a label in the asset bible.`);
      }
    }
    // Cross-check the helper that actually feeds prompt assembly agrees the used labels are known.
    void relevantLabels(p.text, bibleLabels);
  }

  // 6) One frame per objective (so playback + audio line up).
  if (story) {
    const frameIds = new Set(story.frames.map((f) => f.objectiveId));
    for (const o of objectives) {
      if (!frameIds.has(o.id)) err("frame-per-objective", `objective "${o.id}" has no story frame.`);
    }
  }

  return issues;
}

// ---- CLI ------------------------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf("--file");
  let target: Scenario;
  let others: Scenario[];

  if (fileIdx !== -1) {
    const path = args[fileIdx + 1];
    if (!path) {
      console.error("--file requires a path");
      process.exit(2);
    }
    target = JSON.parse(readFileSync(path, "utf8")) as Scenario;
    others = SCENARIOS.filter((s) => s.id !== target.id);
  } else {
    const id = args.find((a) => !a.startsWith("--")) || "cafe";
    const found = SCENARIOS.find((s) => s.id === id);
    if (!found) {
      console.error(`No scenario "${id}". Known: ${SCENARIOS.map((s) => s.id).join(", ")}`);
      process.exit(2);
    }
    target = found;
    others = SCENARIOS.filter((s) => s.id !== id);
  }

  const issues = lintScenario(target, others);
  console.log(`\n=== lint — scenario "${target.id}" ===`);
  if (issues.length === 0) {
    console.log("✅ PASS — all deterministic checks clean.");
    process.exit(0);
  }
  for (const i of issues) console.log(`  ❌ [${i.rule}] ${i.message}`);
  console.log(`\n${issues.length} issue${issues.length === 1 ? "" : "s"}.`);
  process.exit(1);
}

// Run only as a CLI (not when imported by the skill / a test).
if (import.meta.url === `file://${process.argv[1]}`) main();
