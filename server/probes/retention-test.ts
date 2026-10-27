// The retention sweep, against REAL records in a temp asset dir — the same writers the server uses,
// the same sweep the server runs, and the assertion is what is left on disk afterwards.
//
//   npm run test:retention
//
// Bills nothing and touches no real asset dir: ASSET_DIR and TURNLOG_DIR are pointed at a temp path
// before anything is imported.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DIR = mkdtempSync(path.join(tmpdir(), "retention-"));
process.env.ASSET_DIR = DIR;
process.env.TURNLOG_DIR = path.join(DIR, "turnlog");
process.env.RETENTION_TTL_MIN = "240";
const CANDIDATES = path.join(DIR, "catalog-candidates.jsonl");
process.env.CANDIDATES_PATH = CANDIDATES;

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
check("the agreeing turn keeps no clip either", rows()[1].audio.file, "(not retained)");
check("turnlog/media/ is empty", existsSync(path.join(DIR, "turnlog", "media")) ? readdirSync(path.join(DIR, "turnlog", "media")) : [], []);
check("the row is marked", [rows()[0].retain, rows()[1].retain, rows()[2].retain], [false, undefined, undefined]);

// Age the declining row past the window; the other two stay where they are.
const aged = rows();
aged[0].ts = HOURS_AGO_5;
aged[1].ts = HOURS_AGO_5;
aged[2].ts = HOURS_AGO_5;
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

console.log("\nnew phrases");
const candidates = await import("../assets/candidates");
candidates.record([{ surface: "Sem Kris", gloss: "I am Kris" }, { surface: "dober dan", gloss: "good day" }]);
const queued = readFileSync(CANDIDATES, "utf8").trim().split("\n").map((l) => JSON.parse(l));
check("the phrase naming Kris is skipped and the plain one stored with surface, gloss, at only",
  queued.map((q) => Object.keys(q).sort().join(",")), ["at,gloss,surface"]);
check("the stored phrase is the plain one", queued[0].surface, "dober dan");

console.log("\nnothing entered the shared stores (real server, vendor calls stubbed)");
const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const stub = path.join(DIR, "stub.mjs");
writeFileSync(stub, `const real = globalThis.fetch;
globalThis.fetch = (url, init) => {
  const u = String(url);
  if (u.includes("elevenlabs.io")) return Promise.resolve(new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-type": "audio/mpeg" } }));
  if (u.includes("generativelanguage.googleapis.com")) return Promise.resolve(Response.json({ candidates: [{ content: { parts: [{ text: "stub gloss" }] } }] }));
  return real(url, init);
};`);
const server = spawn(process.execPath, ["--import", "tsx", "--import", stub, "server/server.ts"], {
  env: { ...process.env, PORT: String(port), ELEVENLABS_API_KEY: "x", ELEVENLABS_VOICE_ID: "v", GEMINI_API_KEY: "x" },
  stdio: "ignore",
});
for (let i = 0; i < 120; i++) {
  try { if ((await fetch(`${base}/api/learner`)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
const speak = async (q: string) => {
  const res = await fetch(`${base}/api/speak?${q}`);
  await res.arrayBuffer();
  return res.status;
};
check("a cache=0 speak streams audio", await speak("text=" + encodeURIComponent("Živjo, Kris!") + "&cache=0"), 200);
await new Promise((r) => setTimeout(r, 300));
check("a cache=0 speak adds no manifest line", existsSync(path.join(DIR, "manifest.jsonl")), false);
check("a cache=0 speak adds no audio file", existsSync(path.join(DIR, "audio")), false);
check("a speak without cache=0 streams audio", await speak("text=" + encodeURIComponent("Dober dan")), 200);
await new Promise((r) => setTimeout(r, 300));
check("a speak without cache=0 does (the check can fail)", existsSync(path.join(DIR, "manifest.jsonl")), true);

writeFileSync(path.join(DIR, "gloss-cache.json"), "{}");
const sid = "11111111-2222-3333-4444-555555555555";
const gloss = await (await fetch(`${base}/api/gloss?sl=${encodeURIComponent("zxq pqr")}&session=${sid}`)).json();
check("a live gloss answers", gloss.gloss, "stub gloss");
check("it is written to live/<id>.gloss.json", JSON.parse(readFileSync(path.join(DIR, "live", `${sid}.gloss.json`), "utf8")), { "zxq pqr": "stub gloss" });
check("gloss-cache.json is unchanged", readFileSync(path.join(DIR, "gloss-cache.json"), "utf8"), "{}");
server.kill("SIGKILL");

rmSync(DIR, { recursive: true, force: true });
console.log(failures ? `\n❌ ${failures} failed\n` : "\n✅ all passed\n");
process.exit(failures ? 1 : 0);
