// Acceptance check for the retention sweeps and improvement copies
// (docs/features/data-deletion/spec.md#3-sweeps, docs/features/consent-privacy/spec.md#2-improvement-consent),
// and for what a session writes and leaves behind (docs/retention.md, docs/features/no-save-session/spec.md).
//   npx tsx server/probes/retention-test.ts
// Runs against a temp DATA_DIR: the real sweep and writers in this process, then the real server with
// headless Chromium. Vendor calls are stubbed; nothing is billed.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const DIR = mkdtempSync(path.join(tmpdir(), "retention-"));
process.env.ASSET_DIR = DIR;
process.env.DATA_DIR = DIR;
process.env.CANDIDATES_PATH = path.join(DIR, "catalog-candidates.jsonl");
process.env.SESSION_TTL_SEC = "600";
delete process.env.GEMINI_API_KEY;
delete process.env.LEARNERS_DIR;
delete process.env.LEARNER_STORE;

const retention = await import("../assets/retention");
const { settleSession } = await import("../live/grader");
const turnlog = await import("../assets/turnlog");
const liveLog = await import("../live/log");
const learnerStore = await import("../assets/learner");

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};

const DAY = 86_400_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const monthsAgo = (months: number, plusMs = 0) => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return new Date(d.getTime() + plusMs).toISOString();
};
const idOf = (code: string) => "t-" + createHash("sha256").update(code).digest("hex").slice(0, 16);
const dir = (name: string) => {
  mkdirSync(path.join(DIR, name), { recursive: true });
  return path.join(DIR, name);
};
const put = (d: string, id: string, rec: object) => writeFileSync(path.join(dir(d), `${id}.json`), JSON.stringify(rec));
const has = (d: string, id: string) => existsSync(path.join(DIR, d, `${id}.json`));
const lines = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const TURNLOG = path.join(dir("turnlog"), "turns.jsonl");
const EVENTS = path.join(dir("events"), "events.jsonl");
const learnerFile = (id: string) => path.join(DIR, "learners", `${id}.json`);
const learnerJson = (id: string) => (existsSync(learnerFile(id)) ? JSON.parse(readFileSync(learnerFile(id), "utf8")) : null);

const server = { child: null as ReturnType<typeof spawn> | null };
try {
  // ---- learners: 12 months ----
  const liveRec = (sessionId: string, learnerId: string, startedAt: string, text: string, extra: object = {}) => ({
    sessionId, learnerId, testerCode: null, runId: null, lessonId: "demo-l1", provider: "grok",
    startedAt, endedAt: startedAt, error: null, transcripts: [{ ts: startedAt, role: "user", text }], ...extra,
  });
  // [id, model] — each learner also gets a live log, a turn-log row and an event row, so "kept with their
  // records" and "deleted with their records" are both checked against the same set.
  const learners: [string, object][] = [
    ["old-learner", { updatedAt: monthsAgo(13), lastSeenAt: monthsAgo(13) }],
    ["new-learner", { updatedAt: monthsAgo(11), lastSeenAt: monthsAgo(11) }],
    ["noseen-old", { updatedAt: monthsAgo(13) }], // no lastSeenAt: falls back to updatedAt
    ["noseen-new", { updatedAt: monthsAgo(11) }],
    ["just-over", { updatedAt: monthsAgo(12, -DAY), lastSeenAt: monthsAgo(12, -DAY) }],
    ["just-under", { updatedAt: monthsAgo(12, DAY), lastSeenAt: monthsAgo(12, DAY) }],
    ["active", { updatedAt: ago(3600_000), lastSeenAt: ago(3600_000) }],
    ["credited-since", { updatedAt: ago(DAY), lastSeenAt: monthsAgo(13) }], // credited yesterday, stamp stale
    ["future-seen", { updatedAt: ago(DAY), lastSeenAt: new Date(Date.now() + 30 * DAY).toISOString() }],
    ["no-dates", {}],
    ["bad-dates", { updatedAt: "not a date", lastSeenAt: "also not" }],
  ];
  const deletedIds = ["old-learner", "noseen-old", "just-over"];
  for (const [id, dates] of learners) {
    put("learners", id, { learnables: { x: { attempts: 1, successes: 1 } }, facts: {}, ...dates });
    put("live", `${id}-live`, liveRec(`${id}-live`, id, ago(400 * DAY), "Sem Kris"));
    writeFileSync(path.join(dir("live"), `${id}-live.gloss.json`), "{}");
  }
  // A file that does not parse, and one whose name is not a learner id, each with old records.
  writeFileSync(learnerFile("corrupt-learner"), "{ not json");
  put("live", "corrupt-learner-live", liveRec("corrupt-learner-live", "corrupt-learner", ago(400 * DAY), "Sem Kris"));
  put("learners", "bad name", { learnables: {}, facts: {}, updatedAt: monthsAgo(24) });
  put("learners", "", { learnables: {}, facts: {}, updatedAt: monthsAgo(24) }); // learners/.json
  put("live", "blank-id-live", liveRec("blank-id-live", "", ago(400 * DAY), "Sem Kris"));
  put("sessions", "old-tap", { id: "old-tap", scenarioId: "s", createdAt: ago(400 * DAY), updatedAt: ago(400 * DAY), finalObjectives: [], learnerId: "old-learner", turns: [] });
  put("improve", "old-copy", { learnerId: "old-learner", sessionId: "old-learner-live", createdAt: ago(10 * DAY), transcripts: [] });
  const everyone = [...learners.map(([id]) => id), "corrupt-learner", "bad name", ""];
  writeFileSync(TURNLOG, everyone.map((id) => JSON.stringify({ learnerId: id, path: "live", sessionId: `${id}-live` }) + "\n").join(""));
  writeFileSync(EVENTS, everyone.map((id) => JSON.stringify({ learnerId: id, name: "app_opened", ts: ago(400 * DAY) }) + "\n").join(""));
  const corruptBefore = readFileSync(learnerFile("corrupt-learner"), "utf8");

  // ---- improvement copies: 90 days ----
  put("improve", "copy-91d", { learnerId: "x", sessionId: "copy-91d", createdAt: ago(91 * DAY), transcripts: [] });
  put("improve", "copy-89d", { learnerId: "x", sessionId: "copy-89d", createdAt: ago(89 * DAY), transcripts: [] });
  put("improve", "copy-nodate", { learnerId: "x", sessionId: "copy-nodate", transcripts: [] });

  // ---- candidate rows: 12 months ----
  writeFileSync(process.env.CANDIDATES_PATH!, [
    { surface: "stara fraza", gloss: "old phrase", at: monthsAgo(13) },
    { surface: "nova fraza", gloss: "new phrase", at: monthsAgo(11) },
  ].map((r) => JSON.stringify(r) + "\n").join(""));

  // ---- a saved session from 5 hours ago, in full ----
  const HOURS_5 = ago(5 * 3600_000);
  put("live", "saved-live", liveRec("saved-live", "keeper", HOURS_5, "Sem Kris"));
  put("sessions", "saved-tap", { id: "saved-tap", scenarioId: "s", createdAt: HOURS_5, updatedAt: HOURS_5, finalObjectives: [], learnerId: "keeper", retain: false, turns: [{ role: "student", text: "I am Kris", userVerbatim: "Sem Kris", audioKey: "abc" }] });
  writeFileSync(TURNLOG, readFileSync(TURNLOG, "utf8") + JSON.stringify({
    ts: HOURS_5, learnerId: "keeper", path: "live", sessionId: "saved-live", input: { history: [{ role: "user", text: "Sem Kris" }] }, output: { userVerbatim: "Sem Kris", tutorReply: "Živjo, Kris!" },
  }) + "\n");

  console.log("\nsweep()");
  retention.sweep();
  const gone = (id: string) =>
    !has("learners", id) && !has("live", `${id}-live`) && !existsSync(path.join(DIR, "live", `${id}-live.gloss.json`))
      && !lines(TURNLOG).some((r) => r.learnerId === id) && !lines(EVENTS).some((r) => r.learnerId === id);
  const kept = (id: string) =>
    has("learners", id) && has("live", `${id}-live`) && existsSync(path.join(DIR, "live", `${id}-live.gloss.json`))
      && lines(TURNLOG).some((r) => r.learnerId === id) && lines(EVENTS).some((r) => r.learnerId === id);
  check("learner unused for 13 months: deleted with model, live log, translations, tap record, turn-log rows, event rows and improvement copy",
    gone("old-learner") && !has("sessions", "old-tap") && !has("improve", "old-copy"));
  check("learner with no lastSeenAt and updatedAt 13 months ago: deleted with their records", gone("noseen-old"));
  check("learner last seen 12 months and a day ago: deleted", gone("just-over"));
  for (const [id] of learners.filter(([id]) => !deletedIds.includes(id))) {
    check(`learner ${id}: kept with their records`, kept(id));
  }
  check("an unparseable learner file is kept, unchanged, with its records",
    readFileSync(learnerFile("corrupt-learner"), "utf8") === corruptBefore && has("live", "corrupt-learner-live")
      && lines(EVENTS).some((r) => r.learnerId === "corrupt-learner"));
  check("a learner file whose name is not a learner id deletes nothing",
    has("learners", "bad name") && has("learners", "") && has("live", "blank-id-live")
      && lines(EVENTS).some((r) => r.learnerId === "bad name") && lines(EVENTS).some((r) => r.learnerId === ""));
  check("improvement copy 91 days old: swept", !has("improve", "copy-91d"));
  check("improvement copy 89 days old: kept", has("improve", "copy-89d"));
  check("improvement copy without a readable createdAt: kept", has("improve", "copy-nodate"));
  const cands = lines(process.env.CANDIDATES_PATH!).map((r) => r.surface);
  check("candidate row 13 months old dropped, 11 months old kept", JSON.stringify(cands) === JSON.stringify(["nova fraza"]), JSON.stringify(cands));
  const liveText = JSON.parse(readFileSync(path.join(DIR, "live", "saved-live.json"), "utf8")).transcripts[0].text;
  const tapTurn = JSON.parse(readFileSync(path.join(DIR, "sessions", "saved-tap.json"), "utf8")).turns[0];
  const row = lines(TURNLOG).find((r) => r.sessionId === "saved-live");
  check("saved session from 5 hours ago keeps its live log, session record and turn-log rows in full",
    liveText === "Sem Kris" && tapTurn.userVerbatim === "Sem Kris" && tapTurn.audioKey === "abc"
      && row?.output.userVerbatim === "Sem Kris" && row?.output.tutorReply === "Živjo, Kris!" && row?.input.history[0].text === "Sem Kris" && !row?.redactedAt);
  const snapshot = () => JSON.stringify([readdirSync(path.join(DIR, "learners")).sort(), readdirSync(path.join(DIR, "live")).sort(), readFileSync(TURNLOG, "utf8"), readFileSync(EVENTS, "utf8")]);
  const before = snapshot();
  retention.sweep();
  check("a second sweep changes nothing", snapshot() === before);

  // ---- every save writes updatedAt ----
  learnerStore.save("saver", { learnables: {}, facts: {}, updatedAt: monthsAgo(24) });
  check("a learner save writes updatedAt as now", Date.now() - Date.parse(learnerJson("saver")?.updatedAt) < 60_000, learnerJson("saver")?.updatedAt);
  learnerStore.setFact("saver", "gender", "f");
  check("a fact save keeps updatedAt current", Date.now() - Date.parse(learnerJson("saver")?.updatedAt) < 60_000);

  // ---- what a turn writes ----
  console.log("\nwhat a turn writes");
  turnlog.record({
    path: "free", retain: false, learnerId: "probe", testerCode: null, provider: "probe", e2Ms: 1, systemPrompt: "p",
    history: [{ role: "user", text: "Sem Kris" }],
    audio: { mimeType: "audio/wav", base64: Buffer.from("not really audio").toString("base64") },
    output: { userVerbatim: "Sem Kris", userSaid: "I am Kris", tutorReply: "Živjo, Kris!", correction: "", learnableProgress: [] },
  } as any);
  const media = path.join(DIR, "turnlog", "media");
  check("a turn keeps no clip", lines(TURNLOG).at(-1)?.audio?.file === "(not retained)");
  check("turnlog/media/ is empty", !existsSync(media) || readdirSync(media).length === 0);

  console.log("\nnew phrases");
  const candidates = await import("../assets/candidates");
  writeFileSync(process.env.CANDIDATES_PATH!, "");
  candidates.record([
    { surface: "Sem Kris", gloss: "I am Kris" },
    { surface: "dober dan", gloss: "good day" },
  ] as any);
  const queued = lines(process.env.CANDIDATES_PATH!);
  check("the phrase naming Kris is skipped; the plain one is stored with surface, gloss, at only",
    JSON.stringify(queued.map((q) => [q.surface, Object.keys(q).sort().join(",")])) === JSON.stringify([["dober dan", "at,gloss,surface"]]), JSON.stringify(queued));

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
    log: liveRec("plain-live", "kris-learner", ago(1000), "Sem Kris") as any,
  });
  check("a saved session without improve writes no copy", !has("improve", "plain-live"));
  await settleSession({
    learnerId: "kris-learner", instructions: "", targets: [], objectives: [],
    log: { ...liveRec("nosave-live", "kris-learner", ago(1000), "Sem Kris"), improve: true, noSave: true } as any,
  });
  check("a no-save session writes no copy", !has("improve", "nosave-live"));

  // ---- no-save sessions: scored, then deleted whatever the scoring outcome; the sweep is the backstop ----
  console.log("\nno-save sessions (scoring fails: GEMINI_API_KEY unset)");
  const liveFile = (id: string) => path.join(DIR, "live", `${id}.json`);
  const glossFile = (id: string) => path.join(DIR, "live", `${id}.gloss.json`);
  const rowsFor = (id: string) => lines(TURNLOG).filter((r) => r.sessionId === id).length;
  const leave = (id: string) => {
    writeFileSync(glossFile(id), "{}");
    writeFileSync(TURNLOG, readFileSync(TURNLOG, "utf8") + JSON.stringify({ learnerId: "nosave-probe", path: "live", sessionId: id }) + "\n");
  };
  const now = () => new Date().toISOString();
  leave("ns-gone");
  leave("ns-kept");
  await settleSession({ learnerId: "nosave-probe", instructions: "", targets: [], objectives: [], log: liveRec("ns-gone", "nosave-probe", now(), "Sem Kris", { noSave: true }) as any });
  await settleSession({ learnerId: "nosave-probe", instructions: "", targets: [], objectives: [], log: liveRec("ns-kept", "nosave-probe", now(), "Sem Kris") as any });
  check("no-save: live log, turn-log rows and translations are gone at session end",
    !existsSync(liveFile("ns-gone")) && rowsFor("ns-gone") === 0 && !existsSync(glossFile("ns-gone")));
  check("saved: live log, turn-log rows and translations remain",
    existsSync(liveFile("ns-kept")) && rowsFor("ns-kept") === 1 && existsSync(glossFile("ns-kept")));
  leave("ns-left");
  liveLog.write(liveRec("ns-left", "nosave-probe", now(), "Sem Kris", { noSave: true }) as any);
  leave("ns-running");
  liveLog.write(liveRec("ns-running", "nosave-probe", now(), "Sem Kris", { noSave: true }) as any);
  leave("ns-stale");
  liveLog.write(liveRec("ns-stale", "nosave-probe", ago(700_000), "Sem Kris", { noSave: true, endedAt: null }) as any);
  leave("ns-open");
  liveLog.write(liveRec("ns-open", "nosave-probe", ago(60_000), "Sem Kris", { noSave: true, endedAt: null }) as any);
  retention.settling.add("ns-running");
  retention.sweep();
  retention.settling.delete("ns-running");
  check("backstop: an ended no-save log left behind is deleted with its rows and translations",
    !existsSync(liveFile("ns-left")) && rowsFor("ns-left") === 0 && !existsSync(glossFile("ns-left")));
  check("backstop: an unended no-save log past SESSION_TTL_SEC is deleted", !existsSync(liveFile("ns-stale")) && rowsFor("ns-stale") === 0);
  check("backstop: an unended no-save log inside SESSION_TTL_SEC is left", existsSync(liveFile("ns-open")));
  check("backstop: a no-save session still being scored is left to finish", existsSync(liveFile("ns-running")));
  check("backstop: a saved log is left alone", existsSync(liveFile("ns-kept")) && rowsFor("ns-kept") === 1);

  // ---- the server ----
  const copyFor = (id: string, learnerId: string) => put("improve", id, { learnerId, sessionId: id, createdAt: ago(1 * DAY), transcripts: [] });
  for (const c of ["TEST-01", "TEST-02"]) {
    put("learners", idOf(c), { learnables: { x: { attempts: 1, successes: 1 } }, facts: {}, updatedAt: ago(DAY), lastSeenAt: ago(DAY) });
  }
  copyFor("t1-a", idOf("TEST-01"));
  copyFor("t1-b", idOf("TEST-01"));
  copyFor("t2-a", idOf("TEST-02"));
  copyFor("http-a", "http-learner");
  copyFor("http-keep", "other-learner");
  put("live", "hist-live", liveRec("hist-live", "hist-learner", ago(DAY), "Sem Kris"));
  copyFor("hist-live", "hist-learner");
  writeFileSync(path.join(DIR, "gloss-cache.json"), "{}");

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
  server.child = spawn(process.execPath, ["--import", "tsx", "--import", stub, "server/server.ts"], {
    env: { ...process.env, PORT: String(port), TESTER_CODES: "TEST-01,TEST-02,TEST-03", GEMINI_API_KEY: "x", TURNLOG: "0",
      ELEVENLABS_API_KEY: "x", ELEVENLABS_VOICE_ID: "v", LIVE_ACCESS_CODE: "probe" },
    stdio: "ignore",
  });
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nserver");
  check("the startup sweep left the active learners and the unreadable file alone",
    has("learners", "active") && has("learners", "credited-since") && readFileSync(learnerFile("corrupt-learner"), "utf8") === corruptBefore);
  const del = (q = "", body?: object) => fetch(`${base}/api/me/improve${q}`, {
    method: "DELETE",
    headers: { "x-learner-id": "http-learner", ...(body ? { "content-type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const res = await del("?learnerId=other-learner", { learnerId: "other-learner" });
  check("DELETE /api/me/improve deletes the caller's copies and no one else's, whatever the body or query names",
    res.status === 204 && !has("improve", "http-a") && has("improve", "http-keep") && has("improve", "t1-a") && has("improve", "copy-89d"), String(res.status));
  const again = await del();
  check("a second DELETE /api/me/improve is a 204 and changes nothing", again.status === 204 && has("improve", "http-keep"), String(again.status));
  const none = await fetch(`${base}/api/me/improve`, { method: "DELETE", headers: { "x-learner-id": "never-shared" } });
  check("a learner with no copies gets 204", none.status === 204, String(none.status));
  const histDel = await fetch(`${base}/api/history/hist-live`, { method: "DELETE", headers: { "x-learner-id": "hist-learner" } });
  check("deleting a history entry deletes its improvement copy", histDel.status === 204 && !has("live", "hist-live") && !has("improve", "hist-live"));

  const practice = await fetch(`${base}/api/practice`, { headers: { "x-learner-id": "browsing-learner" } });
  await practice.arrayBuffer();
  const browsing = learnerJson("browsing-learner");
  check("a learner who opens the app and earns no credit gets lastSeenAt (GET /api/practice)",
    practice.status === 200 && typeof browsing?.lastSeenAt === "string" && JSON.stringify(browsing.learnables) === "{}", JSON.stringify(browsing));
  const created = await fetch(`${base}/v1/live/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tester-code": "TEST-03" },
    body: JSON.stringify({ lessonId: "demo-l1", provider: "grok" }),
  });
  await created.arrayBuffer();
  check("starting a live session stamps lastSeenAt (POST /v1/live/sessions)",
    created.status !== 403 && typeof learnerJson(idOf("TEST-03"))?.lastSeenAt === "string", `status ${created.status} (no live provider key here, so 503 is expected)`);
  await (await fetch(`${base}/api/practice`, { headers: { "x-learner-id": "corrupt-learner" } })).arrayBuffer();
  check("a request for a learner whose file does not parse leaves the file as it is",
    readFileSync(learnerFile("corrupt-learner"), "utf8") === corruptBefore);

  const speak = async (q: string) => {
    const r = await fetch(`${base}/api/speak?${q}`);
    await r.arrayBuffer();
    await new Promise((ok) => setTimeout(ok, 300));
    return r.status;
  };
  check("a cache=0 speak streams audio and writes no manifest line or audio file",
    (await speak("text=" + encodeURIComponent("Živjo, Kris!") + "&cache=0")) === 200 && !existsSync(path.join(DIR, "manifest.jsonl")) && !existsSync(path.join(DIR, "audio")));
  check("a speak without cache=0 does (the check can fail)",
    (await speak("text=" + encodeURIComponent("Dober dan"))) === 200 && existsSync(path.join(DIR, "manifest.jsonl")));

  const sid = "11111111-2222-3333-4444-555555555555";
  const gloss = (h: Record<string, string>, sl: string) => fetch(`${base}/api/gloss?sl=${encodeURIComponent(sl)}&session=${sid}`, { headers: h }).then((r) => r.json());
  check("a gloss with x-retain: 0 answers", (await gloss({ "x-retain": "0" }, "zxq pqr")).gloss === "stub gloss");
  check("it writes no gloss file", !existsSync(path.join(DIR, "live", `${sid}.gloss.json`)));
  await gloss({}, "zxq pqr");
  check("a gloss without x-retain does (the check can fail)", existsSync(path.join(DIR, "live", `${sid}.gloss.json`)));
  check("gloss-cache.json is unchanged", readFileSync(path.join(DIR, "gloss-cache.json"), "utf8") === "{}");

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
