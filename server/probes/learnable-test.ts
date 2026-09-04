// Mastery-layer tests — the durable per-learnable rules.
//   (unit)        applyCredit + presentObjective with plain inputs (no I/O, highest fidelity for logic)
//   (integration) the learner store round-trips through a REAL temp file (seed→invoke→assert→cleanup)
//   (--live)      a REAL student clip through understand() updates the durable model on real Gemini
// Run: `npm run test:learnable`  (add `-- --live` for the real-Gemini end-to-end leg).

import "dotenv/config";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCredit,
  creditFromEvidence,
  presentObjective,
  selectForWitness,
  statusOf,
  THRESHOLD,
  WITNESS_TARGET_CAP,
} from "../mastery";
import type { LearnableProgress, LearnerModel, Objective, WitnessResult } from "../types";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

function fresh(): LearnerModel {
  return { learnables: {}, facts: {}, updatedAt: "t0" };
}
function got(m: LearnerModel, id: string) {
  const e = m.learnables[id];
  if (!e) throw new Error(`expected learnable "${id}" in model`);
  return e;
}
function credit(model: LearnerModel, id: string, result: LearnableProgress["result"], times = 1): LearnerModel {
  let m = model;
  for (let i = 0; i < times; i++) m = applyCredit(m, [{ id, result }]);
  return m;
}

// ---- unit: applyCredit (spec §3.1) -----------------------------------------------------------------
console.log("applyCredit:");
{
  // success climbs to mastered at THRESHOLD
  const m = credit(fresh(), "kava", "success", THRESHOLD);
  check("success x5 → mastered", statusOf(got(m,"kava")) === "mastered", JSON.stringify(got(m,"kava")));
  check("attempts and successes both = 5", got(m,"kava").attempts === 5 && got(m,"kava").successes === 5);

  // climbs PAST threshold
  const m6 = credit(m, "kava", "success", 1);
  check("success keeps climbing past threshold (6)", got(m6,"kava").successes === 6);

  // first attempt is entry (unseen → attempted)
  const e = credit(fresh(), "eno_femacc", "attempt", 1);
  check("first attempt enters the model (attempted)", statusOf(got(e,"eno_femacc")) === "attempted");
  check("attempt raises attempts, not successes", got(e,"eno_femacc").attempts === 1 && got(e,"eno_femacc").successes === 0);

  // pre-mastery miss stalls — no regress (US-4 / F7)
  let s = credit(fresh(), "kava", "success", 2); // 2/5
  s = credit(s, "kava", "attempt", 3); // three misses
  check("pre-mastery attempts stall successes (no penalty)", got(s,"kava").successes === 2, JSON.stringify(got(s,"kava")));
  check("pre-mastery attempts still raise attempts", got(s,"kava").attempts === 5);

  // flub of a mastered learnable decrements by 1 (F6) and drops it back into the pool
  let f = credit(fresh(), "kava", "success", THRESHOLD); // mastered at 5
  f = credit(f, "kava", "attempt", 1); // flub
  check("flub of mastered decrements by 1 (5→4)", got(f,"kava").successes === 4);
  check("flubbed item is back in the pool (attempted)", statusOf(got(f,"kava")) === "attempted");
  const re = credit(f, "kava", "success", 1); // one clean re-production
  check("one clean success re-masters after a flub", statusOf(re.learnables.kava) === "mastered");

  // deep-past-threshold flub stays mastered (documented consequence of decrement-by-1)
  let d = credit(fresh(), "kava", "success", 7); // 7/5
  d = credit(d, "kava", "attempt", 1);
  check("flub deep past threshold (7→6) stays mastered", statusOf(got(d,"kava")) === "mastered" && got(d,"kava").successes === 6);

  // purity: input not mutated
  const base = fresh();
  applyCredit(base, [{ id: "kava", result: "success" }]);
  check("applyCredit does not mutate its input", Object.keys(base.learnables).length === 0);
}

// ---- unit: presentObjective (spec §3.2) ------------------------------------------------------------
console.log("presentObjective:");
{
  const orderCoffee: Objective = {
    id: "order_coffee",
    label: "Order a coffee",
    targetSL: "Eno kavo, prosim.",
    hintEN: "…",
    learnables: ["eno_femacc", "kava", "voda"],
    fillerLines: { kava: "Eno kavo, prosim.", voda: "Eno vodo, prosim." },
  };

  // fresh learner: first unmastered filler (kava), carrier pattern in focus, predictable error surfaced
  let p = presentObjective(orderCoffee, fresh())!;
  check("fresh: active target is the first filler line", p.activeTargetSL === "Eno kavo, prosim.");
  check("fresh: carrier pattern + active filler are in focus", p.focusLearnables.map((l) => l.id).sort().join() === "eno_femacc,kava");
  check("fresh: predictable error surfaced", !!p.predictableError);
  check("fresh: not review mode", p.reviewMode === false);

  // kava mastered → cycles to next unmastered filler (voda)
  const kavaMastered = credit(fresh(), "kava", "success", THRESHOLD);
  p = presentObjective(orderCoffee, kavaMastered)!;
  check("kava mastered → active filler cycles to voda", p.activeTargetSL === "Eno vodo, prosim.");
  check("mastered kava no longer in focus", !p.focusLearnables.some((l) => l.id === "kava"));

  // all mastered → review mode, no focus
  let all = fresh();
  for (const id of ["eno_femacc", "kava", "voda"]) all = credit(all, id, "success", THRESHOLD);
  p = presentObjective(orderCoffee, all)!;
  check("whole group mastered → reviewMode", p.reviewMode === true);
  check("review mode → nothing in focus", p.focusLearnables.length === 0);

  // single-filler objective with no fillerLines falls back to targetSL
  const greet: Objective = { id: "greet", label: "Greet", targetSL: "Dober dan.", hintEN: "…", learnables: ["dober_dan"] };
  p = presentObjective(greet, fresh())!;
  check("single-item objective falls back to targetSL", p.activeTargetSL === "Dober dan.");

  // objective without learnables → null (back-compat, prompt falls back to today)
  const legacy: Objective = { id: "x", label: "X", targetSL: "T", hintEN: "H" };
  check("objective without learnables → null presentation", presentObjective(legacy, fresh()) === null);
}

// ---- unit: selectForWitness focus set — the rehearsal→free-chat handoff bias (roadmap 12b) ---------
console.log("selectForWitness (focus set):");
{
  // A learner who has touched `kava` once — so `familiar` is non-empty and level-1 adds no generic edge,
  // isolating the focus behaviour. voda/caj are UNSEEN (never touched).
  const model = credit(fresh(), "kava", "attempt", 1);

  // Focus ids lead the target list, and unseen focus items are force-included.
  let s = selectForWitness(model, 1, ["voda", "caj"]);
  check("focus ids lead the targets, in order", s.targets[0]?.id === "voda" && s.targets[1]?.id === "caj",
    s.targets.map((t) => t.id).join());
  check("unseen focus items are force-included as targets", s.targets.some((t) => t.id === "voda") && s.targets.some((t) => t.id === "caj"));
  check("the ripe working item still rides along after the focus set", s.targets.some((t) => t.id === "kava"));

  // Dedup: a focus id that is also a working item appears once, at the front.
  s = selectForWitness(model, 1, ["kava", "voda"]);
  check("focus id also in working is deduped to one entry", s.targets.filter((t) => t.id === "kava").length === 1);
  check("the deduped focus id still leads", s.targets[0]?.id === "kava");

  // Cap: more focus ids than the cap → sliced to the cap, focus order preserved.
  const many = ["kava", "voda", "caj", "prosim", "hvala", "ja", "ne", "dober_dan", "zacnemo"]; // 9 > cap(8)
  s = selectForWitness(model, 1, many);
  check("targets are clamped to WITNESS_TARGET_CAP", s.targets.length === WITNESS_TARGET_CAP);
  check("clamp keeps the leading focus ids", s.targets.slice(0, 3).map((t) => t.id).join() === "kava,voda,caj");
}

// ---- unit: the credit FIREWALL holds under a focus set — biasing WHAT is in play never widens credit -
console.log("focus set + credit firewall:");
{
  const model = credit(fresh(), "kava", "attempt", 1);
  const { targets } = selectForWitness(model, 1, ["voda"]); // voda is unseen but now a target

  const wit = (t: Partial<WitnessResult>): WitnessResult => ({
    reply: "", replyGloss: "", transcriptVerbatim: "", userGloss: "", utteranceLang: "sl",
    targets: [], observed: [], ...t,
  });

  // An UNSEEN focus target, produced correctly in Slovene with a matching span → earns a real success.
  const c1 = creditFromEvidence(model, wit({
    transcriptVerbatim: "voda",
    targets: [{ id: "voda", produced: true, said: "voda", saidLang: "sl", correct: true, confidence: 1 }],
  }), targets);
  check("unseen focus target produced correctly → a real success", c1.model.learnables.voda?.successes === 1,
    JSON.stringify(c1.progress));

  // A Slovene item the learner produced that is NOT in the target set → NOT credited (firewall). Focus
  // biases the in-play set; it does not make off-target Slovene claimable as a success.
  const c2 = creditFromEvidence(model, wit({
    transcriptVerbatim: "hvala",
    targets: [{ id: "hvala", produced: true, said: "hvala", saidLang: "sl", correct: true, confidence: 1 }],
  }), targets);
  check("a non-target Slovene claim earns no success (firewall)", !c2.model.learnables.hvala);
}

// ---- integration: the learner store round-trips through a real temp file ----------------------------
console.log("learner store (temp file):");
{
  const dir = mkdtempSync(path.join(os.tmpdir(), "learner-test-"));
  const file = path.join(dir, "learner.json");
  const prev = process.env.LEARNER_PATH;
  const prevStore = process.env.LEARNER_STORE;
  process.env.LEARNER_PATH = file;
  process.env.LEARNER_STORE = "file"; // this block is about the on-disk store specifically
  try {
    // fresh import is unnecessary — the module reads LEARNER_PATH lazily per call
    const learner = await import("../assets/learner");
    const id = learner.DEFAULT_LEARNER_ID;
    check("load() of a missing file is empty", Object.keys(learner.load(id).learnables).length === 0);

    const credited = applyCredit(learner.load(id), [{ id: "kava", result: "success" }]);
    learner.save(id, credited);
    check("file written to LEARNER_PATH", existsSync(file));

    const reloaded = learner.load(id);
    check("persisted success survives reload", reloaded.learnables.kava?.successes === 1, JSON.stringify(reloaded.learnables));
    const onDisk = JSON.parse(readFileSync(file, "utf8"));
    check("on-disk JSON has the expected shape", onDisk.learnables?.kava?.attempts === 1 && typeof onDisk.updatedAt === "string");
  } finally {
    if (prev === undefined) delete process.env.LEARNER_PATH;
    else process.env.LEARNER_PATH = prev;
    if (prevStore === undefined) delete process.env.LEARNER_STORE;
    else process.env.LEARNER_STORE = prevStore;
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---- optional: --live end-to-end through understand() on real Gemini --------------------------------
if (process.argv.includes("--live")) {
  console.log("live (real Gemini through understand):");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clip = path.join(__dirname, "..", "..", "fixtures", "out", "e3-probe.mp3");
  if (!existsSync(clip)) {
    console.log("  ⚠️  skipped — need a clip at fixtures/out/e3-probe.mp3 (run: npm run probe:e3)");
  } else {
    const dir = mkdtempSync(path.join(os.tmpdir(), "learner-live-"));
    process.env.LEARNER_PATH = path.join(dir, "learner.json");
    process.env.LEARNER_STORE = "file";
    try {
      const { understand } = await import("../orchestrator");
      const { getScenario, freshSession } = await import("../scenarios");
      const learner = await import("../assets/learner");
      const scenario = getScenario("cafe");
      const audioBase64 = readFileSync(clip).toString("base64");
      const r = await understand({ audioBase64, mimeType: "audio/mp3", history: [], session: freshSession(scenario),
                                   learnerId: learner.DEFAULT_LEARNER_ID });
      console.log(`  verbatim: ${r.userVerbatim}`);
      console.log(`  learnable_progress: ${r.learnableProgress.map((p) => `${p.id}:${p.result}`).join("  ") || "(none)"}`);
      const model = learner.load(learner.DEFAULT_LEARNER_ID);
      check("live: durable model gained at least one learnable", Object.keys(model.learnables).length > 0, JSON.stringify(model.learnables));
      // The fixture says "Ena kava" (the nominative error) → the pattern should be an attempt, not a success.
      const pat = model.learnables.eno_femacc;
      if (pat) check("live: the nominative-error pattern was an attempt, not a success", pat.successes === 0 && pat.attempts >= 1, JSON.stringify(pat));
      else console.log("  ⚠️  model did not address eno_femacc this run (model's judgement) — skipping that assertion");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

if (failures) {
  console.log(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ all mastery-layer checks passed");
process.exit(0);
