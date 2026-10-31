// Acceptance check for the retention sweeps and improvement copies
// (docs/features/data-deletion/spec.md#3-sweeps, docs/features/consent-privacy/spec.md#2-improvement-consent).
//   npx tsx server/probes/retention-test.ts
// Runs against a temp DATA_DIR: the real sweep and writers in this process, then the real server with
// headless Chromium. Vendor calls are stubbed; nothing is billed.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const DIR = mkdtempSync(path.join(tmpdir(), "retention-"));
process.env.ASSET_DIR = DIR;
process.env.DATA_DIR = DIR;
process.env.CANDIDATES_PATH = path.join(DIR, "catalog-candidates.jsonl");
process.env.SESSION_TTL_SEC = "600";
delete process.env.GEMINI_API_KEY;

const retention = await import("../assets/retention");
const { settleSession } = await import("../live/grader");

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const idOf = (code: string) => "t-" + createHash("sha256").update(code).digest("hex").slice(0, 16);
const dir = (name: string) => {
  mkdirSync(path.join(DIR, name), { recursive: true });
  return path.join(DIR, name);
};
const put = (d: string, id: string, rec: object) => writeFileSync(path.join(dir(d), `${id}.json`), JSON.stringify(rec));
const has = (d: string, id: string) => existsSync(path.join(DIR, d, `${id}.json`));
const lines = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const TURNLOG = path.join(dir("turnlog"), "turns.jsonl");

const server = { child: null as ReturnType<typeof spawn> | null };
try {
  // ---- learners: 12 months ----
  const liveRec = (sessionId: string, learnerId: string, startedAt: string, text: string, extra: object = {}) => ({
    sessionId, learnerId, testerCode: null, runId: null, lessonId: "demo-l1", provider: "grok",
    startedAt, endedAt: startedAt, error: null, transcripts: [{ ts: startedAt, role: "user", text }], ...extra,
  });
  put("learners", "old-learner", { learnables: { x: { attempts: 1, successes: 1 } }, facts: {}, updatedAt: ago(1 * DAY), lastSeenAt: ago(13 * 30.5 * DAY) });
  put("learners", "new-learner", { learnables: {}, facts: {}, updatedAt: ago(1 * DAY), lastSeenAt: ago(11 * 30.5 * DAY) });
  put("live", "old-live", liveRec("old-live", "old-learner", ago(400 * DAY), "Sem Kris"));
  put("sessions", "old-tap", { id: "old-tap", scenarioId: "s", createdAt: ago(400 * DAY), updatedAt: ago(400 * DAY), finalObjectives: [], learnerId: "old-learner", turns: [] });
  put("improve", "old-copy", { learnerId: "old-learner", sessionId: "old-live", createdAt: ago(10 * DAY), transcripts: [] });
  put("live", "new-live", liveRec("new-live", "new-learner", ago(300 * DAY), "Sem Ana"));
  writeFileSync(TURNLOG, [
    { learnerId: "old-learner", path: "live", sessionId: "old-live" },
    { learnerId: "new-learner", path: "live", sessionId: "new-live" },
  ].map((r) => JSON.stringify(r) + "\n").join(""));

  // ---- improvement copies: 90 days ----
  put("improve", "copy-91d", { learnerId: "x", sessionId: "copy-91d", createdAt: ago(91 * DAY), transcripts: [] });
  put("improve", "copy-89d", { learnerId: "x", sessionId: "copy-89d", createdAt: ago(89 * DAY), transcripts: [] });

  // ---- candidate rows: 12 months ----
  writeFileSync(process.env.CANDIDATES_PATH!, [
    { surface: "stara fraza", gloss: "old phrase", at: ago(13 * 30.5 * DAY) },
    { surface: "nova fraza", gloss: "new phrase", at: ago(11 * 30.5 * DAY) },
  ].map((r) => JSON.stringify(r) + "\n").join(""));

  // ---- a saved session from 5 hours ago, in full ----
  const HOURS_5 = ago(5 * 3600_000);
  put("live", "saved-live", liveRec("saved-live", "keeper", HOURS_5, "Sem Kris"));
  put("sessions", "saved-tap", { id: "saved-tap", scenarioId: "s", createdAt: HOURS_5, updatedAt: HOURS_5, finalObjectives: [], learnerId: "keeper", turns: [{ role: "student", text: "I am Kris", userVerbatim: "Sem Kris", audioKey: "abc" }] });
  writeFileSync(TURNLOG, readFileSync(TURNLOG, "utf8") + JSON.stringify({
    ts: HOURS_5, learnerId: "keeper", path: "live", sessionId: "saved-live", input: { history: [{ role: "user", text: "Sem Kris" }] }, output: { userVerbatim: "Sem Kris", tutorReply: "Živjo, Kris!" },
  }) + "\n");

  console.log("\nsweep()");
  retention.sweep();
  check("learner unused for 13 months: deleted with their records",
    !has("learners", "old-learner") && !has("live", "old-live") && !has("sessions", "old-tap") && !has("improve", "old-copy")
      && !lines(TURNLOG).some((r) => r.learnerId === "old-learner"));
  check("learner unused for 11 months: kept with their records",
    has("learners", "new-learner") && has("live", "new-live") && lines(TURNLOG).some((r) => r.learnerId === "new-learner"));
  check("improvement copy 91 days old: swept", !has("improve", "copy-91d"));
  check("improvement copy 89 days old: kept", has("improve", "copy-89d"));
  const cands = lines(process.env.CANDIDATES_PATH!).map((r) => r.surface);
  check("candidate row 13 months old dropped, 11 months old kept", JSON.stringify(cands) === JSON.stringify(["nova fraza"]), JSON.stringify(cands));
  const liveText = JSON.parse(readFileSync(path.join(DIR, "live", "saved-live.json"), "utf8")).transcripts[0].text;
  const tapTurn = JSON.parse(readFileSync(path.join(DIR, "sessions", "saved-tap.json"), "utf8")).turns[0];
  const row = lines(TURNLOG).find((r) => r.sessionId === "saved-live");
  check("saved session from 5 hours ago keeps its live log, session record and turn-log rows in full",
    liveText === "Sem Kris" && tapTurn.userVerbatim === "Sem Kris" && tapTurn.audioKey === "abc"
      && row?.output.userVerbatim === "Sem Kris" && row?.output.tutorReply === "Živjo, Kris!" && row?.input.history[0].text === "Sem Kris" && !row?.redactedAt);

  // ---- improvement copy written at session end ----
  console.log("\nsaved session with improve: true");
  await settleSession({
    learnerId: "kris-learner", instructions: "", targets: [], objectives: [],
    log: { ...liveRec("improve-live", "kris-learner", ago(1000), "Živjo, sem Kris"), improve: true } as any,
  });
  const copy = existsSync(path.join(DIR, "improve", "improve-live.json")) ? JSON.parse(readFileSync(path.join(DIR, "improve", "improve-live.json"), "utf8")) : null;
  check("improve/<id>.json is written with Kris shown as [name]",
    copy?.learnerId === "kris-learner" && copy.sessionId === "improve-live" && typeof copy.createdAt === "string"
      && copy.transcripts[0].text === "Živjo, sem [name]", JSON.stringify(copy?.transcripts));
  await settleSession({
    learnerId: "kris-learner", instructions: "", targets: [], objectives: [],
    log: { ...liveRec("nosave-live", "kris-learner", ago(1000), "Sem Kris"), improve: true, noSave: true } as any,
  });
  check("a no-save session writes no copy", !has("improve", "nosave-live"));

  // ---- the server: DELETE /api/me/improve, Settings, gloss ----
  const copyFor = (id: string, learnerId: string) => put("improve", id, { learnerId, sessionId: id, createdAt: ago(1 * DAY), transcripts: [] });
  for (const c of ["TEST-01", "TEST-02"]) {
    put("learners", idOf(c), { learnables: { x: { attempts: 1, successes: 1 } }, facts: {}, updatedAt: ago(DAY), lastSeenAt: ago(DAY) });
  }
  copyFor("t1-a", idOf("TEST-01"));
  copyFor("t1-b", idOf("TEST-01"));
  copyFor("t2-a", idOf("TEST-02"));
  copyFor("http-a", "http-learner");
  copyFor("http-keep", "other-learner");

  const port = 20000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const stub = path.join(DIR, "stub.mjs");
  writeFileSync(stub, `const real = globalThis.fetch;
globalThis.fetch = (url, init) => String(url).includes("generativelanguage.googleapis.com")
  ? Promise.resolve(Response.json({ candidates: [{ content: { parts: [{ text: "stub gloss" }] } }] }))
  : real(url, init);`);
  server.child = spawn(process.execPath, ["--import", "tsx", "--import", stub, "server/server.ts"], {
    env: { ...process.env, PORT: String(port), TESTER_CODES: "TEST-01,TEST-02", GEMINI_API_KEY: "x", TURNLOG: "0" },
    stdio: "ignore",
  });
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nserver");
  const res = await fetch(`${base}/api/me/improve`, { method: "DELETE", headers: { "x-learner-id": "http-learner" } });
  check("DELETE /api/me/improve deletes the learner's copies and no one else's",
    res.status === 204 && !has("improve", "http-a") && has("improve", "http-keep"), String(res.status));

  const seen = await (await fetch(`${base}/api/history`, { headers: { "x-learner-id": "seen-learner" } })).status;
  const stamped = existsSync(path.join(DIR, "learners", "seen-learner.json")) && typeof JSON.parse(readFileSync(path.join(DIR, "learners", "seen-learner.json"), "utf8")).lastSeenAt === "string";
  check("a request that resolves a learner stamps lastSeenAt", seen === 200 && stamped);

  const sid = "11111111-2222-3333-4444-555555555555";
  const gloss = (h: Record<string, string>, sl: string) => fetch(`${base}/api/gloss?sl=${encodeURIComponent(sl)}&session=${sid}`, { headers: h }).then((r) => r.json());
  check("a gloss with x-retain: 0 answers", (await gloss({ "x-retain": "0" }, "zxq pqr")).gloss === "stub gloss");
  check("it writes no gloss file", !existsSync(path.join(DIR, "live", `${sid}.gloss.json`)));
  await gloss({}, "zxq pqr");
  check("a gloss without x-retain does (the check can fail)", existsSync(path.join(DIR, "live", `${sid}.gloss.json`)));

  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${base}/?c=TEST-01`);
    await page.waitForSelector("#header-settings");
    await page.click("#header-settings");
    const label = await page.textContent("#settings-improve");
    check("Settings shows the withdraw button", label?.trim() === "Stop using my sessions to improve Vadi", String(label));
    await page.click("#settings-improve");
    for (let i = 0; i < 30 && has("improve", "t1-a"); i++) await page.waitForTimeout(100);
    check("clicking it deletes TEST-01's copies and keeps TEST-02's",
      !has("improve", "t1-a") && !has("improve", "t1-b") && has("improve", "t2-a"));
  } finally {
    await browser.close();
  }
} finally {
  server.child?.kill("SIGKILL");
  rmSync(DIR, { recursive: true, force: true });
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
