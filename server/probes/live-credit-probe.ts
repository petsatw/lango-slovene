// Live-mode crediting against a REAL recorded session — the grader, the matcher and the shared firewall
// on a transcript a vendor actually produced. It bills one cheap text call and writes nothing: the
// learner model, the turn log and the session log are all left alone, so a session can be re-graded as
// often as the rules change.
//
//   npm run probe:live-credit                 # lists the recorded sessions
//   npm run probe:live-credit -- <sessionId>  # grade that one

import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { ASSET_DIR } from "../assets/store";
import * as learner from "../assets/learner";
import { creditFromEvidence } from "../mastery";
import { gradeSession } from "../live/grader";
import { keytermsFor } from "../live/match";
import { buildLessonPrompt } from "../live/prompt";
import type { LiveSessionLog } from "../live/log";

const dir = path.join(ASSET_DIR, "live");
const asked = process.argv.slice(2).find((a) => !a.startsWith("--"));

if (!existsSync(dir)) {
  console.error(`no recorded sessions under ${dir}`);
  process.exit(1);
}

const logs = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as LiveSessionLog);

if (!asked) {
  for (const l of logs) {
    const said = l.transcripts.filter((t) => t.role === "user").length;
    console.log(`${l.sessionId}  ${l.lessonId.padEnd(16)} ${l.provider.padEnd(7)} learner lines=${said}`);
  }
  process.exit(0);
}

const log = logs.find((l) => l.sessionId === asked);
if (!log) {
  console.error(`no recorded session ${asked}`);
  process.exit(1);
}

// The targets a real session would have been graded against are the ones its prompt froze at connect.
// This re-derives them for a session that is already over, so an empty learner model is the honest
// stand-in for whoever sat it.
const { targets } = buildLessonPrompt(log.lessonId, "live-credit-probe");

console.log(`\n${log.lessonId} · ${log.provider} · ${log.transcripts.length} lines`);
console.log(`targets:  ${targets.map((t) => t.id).join(", ")}`);
console.log(`keyterms: ${keytermsFor(targets).join(" · ")}\n`);
for (const t of log.transcripts) console.log(`  ${t.role === "user" ? "·" : "»"} ${t.text}`);

const grade = await gradeSession(log.transcripts, targets);
if (!grade) {
  console.log("\nnothing to grade — no learner speech, or no targets in play\n");
  process.exit(0);
}

console.log(`\ngraded by ${grade.provider} in ${grade.gradeMs}ms\n`);
console.log("  target                asr        uptake  correct  recast  line  verdict   said");
for (const c of grade.channels) {
  console.log(
    `  ${c.id.padEnd(20)}  ${(c.asr ? c.asrVia! : "—").padEnd(9)}` +
      `  ${String(c.uptake).padEnd(6)}  ${String(c.correct).padEnd(7)}  ${String(c.recast).padEnd(6)}` +
      `  ${String(c.saidLine).padEnd(4)}  ${c.verdict.padEnd(8)}  ${c.said || "—"}`,
  );
}

// The same firewall the tap mode runs on, against a throwaway model so nothing durable moves.
const credit = creditFromEvidence(learner.load("live-credit-probe"), grade.evidence, targets);
console.log(
  `\ncredit: ${credit.progress.length ? credit.progress.map((p) => `${p.id}=${p.result}`).join("  ") : "none"}\n`,
);
