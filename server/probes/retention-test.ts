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
    retain, learnerId: "probe", testerCode: null,
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
  id: "declined", scenarioId: "free-chat", retain: false, learnerId: "probe", testerCode: null, finalObjectives: [], complete: false,
  turns: [
    { role: "student", text: "I am Kris", userVerbatim: "Sem Kris", audioKey: "abc",
      learnableProgress: [{ id: "sem_ime", result: "success" }] },
    { role: "tutor", text: "Živjo, Kris!", audioKey: "def" },
  ],
});
sessions.appendTurns({
  id: "agreed", scenarioId: "free-chat", learnerId: "probe", testerCode: null, finalObjectives: [], complete: false,
  turns: [{ role: "student", text: "I am Ana", userVerbatim: "Sem Ana" }],
});
// Both records were written just now; the sweep must not touch the one still inside its window either.
const declined = JSON.parse(readFileSync(path.join(DIR, "sessions", "declined.json"), "utf8"));
declined.updatedAt = HOURS_AGO_5;
declined.createdAt = HOURS_AGO_5;
writeFileSync(path.join(DIR, "sessions", "declined.json"), JSON.stringify(declined, null, 2));

liveLog.write({
  sessionId: "live-declined", learnerId: "probe", testerCode: null, runId: "sitting", lessonId: "demo-l1", provider: "grok",
  startedAt: HOURS_AGO_5, endedAt: HOURS_AGO_5, error: null, retain: false,
  transcripts: [{ ts: HOURS_AGO_5, role: "user", text: "Živjo, sem Kris" }],
  credit: [{ id: "zivjo", result: "success" }],
});
liveLog.write({
  sessionId: "live-fresh", learnerId: "probe", testerCode: null, runId: "sitting", lessonId: "demo-l1", provider: "grok",
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

// ---- no-save sessions: scored, then deleted whatever the scoring outcome ----
// Scoring needs Gemini; with the key unset it fails, which is the case the spec says must still delete.
delete process.env.GEMINI_API_KEY;
// A block, so these names stay local to the no-save checks.
{
  const { existsSync, mkdirSync } = await import("node:fs");
  const { settleSession } = await import("../live/grader");
  const learnerStore = await import("../assets/learner");

  const liveDir = path.join(DIR, "live");
  const liveFile = (id: string) => path.join(liveDir, `${id}.json`);
  const glossFile = (id: string) => path.join(liveDir, `${id}.gloss.json`);
  const rowsFor = (id: string) => rows().filter((r: any) => r.sessionId === id).length;
  function leave(id: string): void {
    mkdirSync(liveDir, { recursive: true });
    writeFileSync(glossFile(id), "{}");
    turnlog.record({ ...turnFor(undefined, "Sem Kris"), path: "live", sessionId: id } as any);
  }
  const sessionLog = (id: string, extra: object = {}) => ({
    sessionId: id, learnerId: "nosave-probe", testerCode: null, runId: null, lessonId: "demo-l1", provider: "grok" as const,
    startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), error: null,
    transcripts: [{ ts: new Date().toISOString(), role: "user" as const, text: "Živjo, sem Kris" }],
    ...extra,
  });

  console.log("\nsession end with scoring failing (GEMINI_API_KEY unset)");
  const modelOf = () => {
    const { learnables, facts } = learnerStore.load("nosave-probe");
    return JSON.stringify({ learnables, facts });
  };
  const modelBefore = modelOf();
  leave("ns-gone");
  leave("ns-kept");
  const ending = settleSession({ learnerId: "nosave-probe", instructions: "", targets: [], log: sessionLog("ns-gone", { noSave: true }) });
  check("the no-save log records noSave: true", JSON.parse(readFileSync(liveFile("ns-gone"), "utf8")).noSave, true);
  await ending;
  await settleSession({ learnerId: "nosave-probe", instructions: "", targets: [], log: sessionLog("ns-kept") });
  check("no-save: live log, turn-log rows and translations are gone",
    [existsSync(liveFile("ns-gone")), rowsFor("ns-gone"), existsSync(glossFile("ns-gone"))], [false, 0, false]);
  check("saved: live log, turn-log rows and translations remain",
    [existsSync(liveFile("ns-kept")), rowsFor("ns-kept"), existsSync(glossFile("ns-kept"))], [true, 1, true]);
  check("the learner model is unchanged", modelOf(), modelBefore);

  console.log("\nthe sweep removes a no-save log left from before startup");
  leave("ns-left");
  liveLog.write(sessionLog("ns-left", { noSave: true }) as any);
  leave("ns-running");
  liveLog.write(sessionLog("ns-running", { noSave: true }) as any);
  retention.settling.add("ns-running");
  retention.sweep();
  retention.settling.delete("ns-running");
  check("left-over: log, rows and translations are gone",
    [existsSync(liveFile("ns-left")), rowsFor("ns-left"), existsSync(glossFile("ns-left"))], [false, 0, false]);
  check("a no-save session still being scored is left to finish", existsSync(liveFile("ns-running")), true);
  check("a saved log is left alone", existsSync(liveFile("ns-kept")), true);

  console.log("\nthe create body's noSave reaches the session");
  const { spawn } = await import("node:child_process");
  const { WebSocket } = await import("ws");
  const port = 20000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const env = { ...process.env, PORT: String(port), DATA_DIR: DIR, LIVE_ACCESS_CODE: "probe", XAI_API_KEY: "probe-unreachable" };
  const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });
  try {
    let up = false;
    for (let i = 0; i < 120 && !up; i++) {
      up = await fetch(`${base}/api/learner`).then((r) => r.ok, () => false);
      if (!up) await new Promise((r) => setTimeout(r, 500));
    }
    check("the server started", up, true);
    const res = await fetch(`${base}/v1/live/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-learner-id": "nosave-http" },
      body: JSON.stringify({ lessonId: "demo-l1", accessCode: "probe", provider: "grok", noSave: true }),
    });
    const created: any = await res.json().catch(() => ({}));
    check("create answers 201", res.status, 201);
    if (res.status === 201) {
      const sock = new WebSocket(created.wsUrl);
      sock.on("error", () => {});
      await new Promise((r) => { sock.on("close", r); setTimeout(r, 15_000); });
      const eventsFile = path.join(DIR, "events", "events.jsonl");
      const started = existsSync(eventsFile)
        ? readFileSync(eventsFile, "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.name === "live_started")
        : [];
      check("live_started carries noSave: true", started.map((e) => e.props?.noSave ?? e.noSave), [true]);
      await new Promise((r) => setTimeout(r, 1000));
      check("the ended session leaves no log", existsSync(liveFile(created.sessionId)), false);
    }
  } finally {
    child.kill("SIGKILL");
  }
}

rmSync(DIR, { recursive: true, force: true });
console.log(failures ? `\n❌ ${failures} failed\n` : "\n✅ all passed\n");
process.exit(failures ? 1 : 0);
