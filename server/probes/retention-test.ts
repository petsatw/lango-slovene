// The retention sweep, against REAL records in a temp asset dir — the same writers the server uses,
// the same sweep the server runs, and the assertion is what is left on disk afterwards.
//
//   npm run test:retention
//
// Bills nothing and touches no real asset dir: ASSET_DIR and TURNLOG_DIR are pointed at a temp path
// before anything is imported.

import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DIR = mkdtempSync(path.join(tmpdir(), "retention-"));
process.env.ASSET_DIR = DIR;
process.env.TURNLOG_DIR = path.join(DIR, "turnlog");
process.env.RETENTION_TTL_MIN = "240";

const sessions = await import("../assets/sessions");
const turnlog = await import("../assets/turnlog");
const liveLog = await import("../live/log");
const retention = await import("../assets/retention");

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}\n       expected ${e}\n       got      ${a}`);
  }
}

const HOURS_AGO_5 = new Date(Date.now() - 5 * 3600_000).toISOString();
const MINUTES_AGO_5 = new Date(Date.now() - 5 * 60_000).toISOString();

function turnFor(retain: boolean | undefined, verbatim: string) {
  return {
    path: "free" as const,
    retain,
    provider: "probe",
    e2Ms: 1,
    systemPrompt: "the prompt",
    history: [{ role: "user", text: verbatim }],
    // The clip is the strongest PII there is; a non-retaining turn must not write one at all.
    audio: { mimeType: "audio/wav", base64: Buffer.from("not really audio").toString("base64") },
    output: {
      userVerbatim: verbatim,
      userSaid: "I am Kris",
      tutorReply: "Živjo, Kris!",
      correction: "",
      learnableProgress: [{ id: "zivjo", result: "success" }],
    },
    creditedCounts: { zivjo: { successes: 1, attempts: 1 } },
  };
}

console.log("\nwhat a non-retaining turn writes");
turnlog.record(turnFor(false, "Sem Kris"));
turnlog.record(turnFor(true, "Sem Ana"));
turnlog.record(turnFor(undefined, "Sem Bo"));
const rows = () =>
  readFileSync(turnlog.LOG_PATH, "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("the declining turn keeps no clip", rows()[0].audio.file, "(not retained)");
check("the agreeing turn keeps its clip", rows()[1].audio.file.startsWith("media/"), true);
check("the row is marked", [rows()[0].retain, rows()[1].retain, rows()[2].retain], [false, undefined, undefined]);

// Age the declining row past the window; the other two stay where they are.
const aged = rows();
aged[0].ts = HOURS_AGO_5;
aged[1].ts = HOURS_AGO_5;
aged[2].ts = HOURS_AGO_5;
const { writeFileSync } = await import("node:fs");
writeFileSync(turnlog.LOG_PATH, aged.map((r) => JSON.stringify(r)).join("\n") + "\n");

sessions.appendTurns({
  id: "declined", scenarioId: "free-chat", retain: false, finalObjectives: [], complete: false,
  turns: [
    { role: "student", text: "I am Kris", userVerbatim: "Sem Kris", audioKey: "abc",
      learnableProgress: [{ id: "sem_ime", result: "success" }] },
    { role: "tutor", text: "Živjo, Kris!", audioKey: "def" },
  ],
});
sessions.appendTurns({
  id: "agreed", scenarioId: "free-chat", finalObjectives: [], complete: false,
  turns: [{ role: "student", text: "I am Ana", userVerbatim: "Sem Ana" }],
});
// Both records were written just now; the sweep must not touch the one still inside its window either.
const declined = JSON.parse(readFileSync(path.join(DIR, "sessions", "declined.json"), "utf8"));
declined.updatedAt = HOURS_AGO_5;
declined.createdAt = HOURS_AGO_5;
writeFileSync(path.join(DIR, "sessions", "declined.json"), JSON.stringify(declined, null, 2));

liveLog.write({
  sessionId: "live-declined", runId: "sitting", lessonId: "demo-l1", provider: "grok",
  startedAt: HOURS_AGO_5, endedAt: HOURS_AGO_5, error: null, retain: false,
  transcripts: [{ ts: HOURS_AGO_5, role: "user", text: "Živjo, sem Kris" }],
  credit: [{ id: "zivjo", result: "success" }],
});
liveLog.write({
  sessionId: "live-fresh", runId: "sitting", lessonId: "demo-l1", provider: "grok",
  startedAt: MINUTES_AGO_5, endedAt: MINUTES_AGO_5, error: null, retain: false,
  transcripts: [{ ts: MINUTES_AGO_5, role: "user", text: "Živjo, sem Kris" }],
});

console.log("\nafter the sweep");
retention.sweep();

const swept = rows();
check("the declining turn's speech is gone", [swept[0].output.userVerbatim, swept[0].output.userSaid,
  swept[0].output.tutorReply, swept[0].input.history[0].text], ["", "", "", ""]);
check("its credit survives", swept[0].output.learnableProgress, [{ id: "zivjo", result: "success" }]);
check("its durable counts survive", swept[0].creditedCounts, { zivjo: { successes: 1, attempts: 1 } });
check("it is stamped", typeof swept[0].redactedAt, "string");
check("the agreeing turn is untouched", swept[1].output.userVerbatim, "Sem Ana");
check("the silent turn is untouched", swept[2].output.userVerbatim, "Sem Bo");

const rec = JSON.parse(readFileSync(path.join(DIR, "sessions", "declined.json"), "utf8"));
check("the session record's speech is gone", rec.turns.map((t: any) => [t.text, t.userVerbatim ?? ""]),
  [["", ""], ["", ""]]);
check("its audio keys are gone", rec.turns.some((t: any) => t.audioKey), false);
check("its credit survives", rec.turns[0].learnableProgress, [{ id: "sem_ime", result: "success" }]);
const kept = JSON.parse(readFileSync(path.join(DIR, "sessions", "agreed.json"), "utf8"));
check("the agreeing record is untouched", kept.turns[0].userVerbatim, "Sem Ana");

const live = JSON.parse(readFileSync(path.join(DIR, "live", "live-declined.json"), "utf8"));
check("the live transcript is gone", live.transcripts.map((t: any) => t.text), [""]);
check("its credit survives", live.credit, [{ id: "zivjo", result: "success" }]);
const fresh = JSON.parse(readFileSync(path.join(DIR, "live", "live-fresh.json"), "utf8"));
check("a declining session still inside the window is untouched", fresh.transcripts[0].text, "Živjo, sem Kris");

console.log("\nidempotence");
retention.sweep();
check("a second sweep changes nothing", rows()[0].redactedAt, swept[0].redactedAt);

console.log("\nnothing entered the shared stores");
check("no manifest written", readdirSync(DIR).includes("manifest.jsonl"), false);

rmSync(DIR, { recursive: true, force: true });
console.log(failures ? `\n❌ ${failures} failed\n` : "\n✅ all passed\n");
process.exit(failures ? 1 : 0);
