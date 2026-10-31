// Acceptance check for learning history, Settings and Delete my data: a tester sees their code, lists and
// opens their own sessions, deletes one, cannot read another tester's, and deletes their data.
//   npx tsx server/probes/history-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "history-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01,TEST-02", TURNLOG: "0" },
  stdio: "ignore",
});

const idOf = (code: string) => "t-" + createHash("sha256").update(code).digest("hex").slice(0, 16);
const live = path.join(data, "live");
const learners = path.join(data, "learners");
mkdirSync(live, { recursive: true });
mkdirSync(learners, { recursive: true });
for (const [code, line] of [["TEST-01", "Dober dan"], ["TEST-02", "Hvala lepa"]] as const) {
  const sessionId = `live-${code}`;
  writeFileSync(path.join(live, `${sessionId}.json`), JSON.stringify({
    sessionId, learnerId: idOf(code), testerCode: code, runId: null, lessonId: "fixture-lesson", provider: "grok",
    startedAt: "2026-10-01T10:00:00.000Z", endedAt: "2026-10-01T10:05:00.000Z", error: null,
    transcripts: [{ ts: "2026-10-01T10:00:01.000Z", role: "tutor", text: line }],
    progressed: [],
  }));
  writeFileSync(path.join(learners, `${idOf(code)}.json`), JSON.stringify({ learnables: { x: { attempts: 1, successes: 1 } }, facts: {} }));
}
// A no-save live log of TEST-01, which history does not list.
writeFileSync(path.join(live, "nosave-TEST-01.json"), JSON.stringify({
  sessionId: "nosave-TEST-01", learnerId: idOf("TEST-01"), testerCode: "TEST-01", runId: null, lessonId: "fixture-lesson",
  provider: "grok", startedAt: "2026-10-01T11:00:00.000Z", endedAt: "2026-10-01T11:05:00.000Z", error: null,
  transcripts: [], progressed: [], noSave: true,
}));
// Turn-log rows: a seed-tutorial row of TEST-01 with no session id, and a row of TEST-02.
const turnlog = path.join(data, "turnlog", "turns.jsonl");
mkdirSync(path.dirname(turnlog), { recursive: true });
writeFileSync(turnlog, [
  { learnerId: idOf("TEST-01"), path: "seed", seedId: "getting-started" },
  { learnerId: idOf("TEST-02"), path: "live", sessionId: "live-TEST-02" },
].map((r) => JSON.stringify(r) + "\n").join(""));

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage(); // fresh profile
  page.on("dialog", (d) => d.accept());
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForSelector("#header-settings");

  await page.click("#header-settings");
  await page.waitForFunction(() => document.getElementById("settings-code")!.textContent !== "—");
  check("1. Settings shows TEST-01", (await page.textContent("#settings-code")) === "TEST-01");

  // A browser whose code is not on the allowlist, with progress so it opens on the home screen.
  writeFileSync(path.join(learners, "probe-browser.json"), JSON.stringify({ learnables: { x: { attempts: 1, successes: 1 } }, facts: {} }));
  const unknown = await (await browser.newContext()).newPage();
  await unknown.addInitScript(() => localStorage.setItem("learnerId", "probe-browser"));
  await unknown.goto(`${base}/?c=NOT-A-CODE`);
  await unknown.click("#header-settings");
  await unknown.waitForFunction(() => document.getElementById("settings-code")!.textContent !== "—");
  const shown = await unknown.textContent("#settings-code");
  check("1. Settings shows the learnerId for a code not on the allowlist", shown === "probe-browser", String(shown));
  await unknown.close();

  await page.click("#settings-history");
  await page.waitForSelector(".history-entry");
  const ids = await page.$$eval(".history-entry", (els) => els.map((e) => (e as HTMLElement).dataset.id));
  check("2. history lists only TEST-01's session", ids.length === 1 && ids[0] === "live-TEST-01", JSON.stringify(ids));
  await page.click(".history-open");
  await page.waitForFunction(() => document.querySelector(".history-line")?.textContent?.includes("Dober dan"));
  check("2. its transcript opens", true);

  await page.click(".history-delete");
  await page.waitForFunction(() => !document.querySelector(".history-entry"));
  check("3. delete removes live/<id>.json", !existsSync(path.join(live, "live-TEST-01.json")));
  check("3. TEST-02's session remains", existsSync(path.join(live, "live-TEST-02.json")));

  const other = await fetch(`${base}/api/history/live-TEST-02`, { headers: { "x-tester-code": "TEST-01" } });
  check("4. TEST-02's session id with TEST-01's code is 404", other.status === 404, String(other.status));

  const tapFile = path.join(data, "sessions", "tap-TEST-01.json");
  mkdirSync(path.dirname(tapFile), { recursive: true });
  writeFileSync(tapFile, JSON.stringify({
    id: "tap-TEST-01", scenarioId: "fixture-scenario", createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:05:00.000Z",
    status: "completed", finalObjectives: [], learnerId: idOf("TEST-01"), testerCode: "TEST-01",
    turns: [{ index: 0, role: "tutor", text: "Dober dan" }],
  }));
  const before = readFileSync(tapFile, "utf8");
  const append = await fetch(`${base}/api/turn`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tester-code": "TEST-02" },
    body: JSON.stringify({ audioBase64: "AAAA", mimeType: "audio/webm", runId: "tap-TEST-01" }),
  });
  const aList = await (await fetch(`${base}/api/history`, { headers: { "x-tester-code": "TEST-01" } })).json();
  check("4. TEST-02 cannot append to TEST-01's session, and TEST-01's history is unchanged",
    append.status === 404 && readFileSync(tapFile, "utf8") === before && aList.entries.map((e: any) => e.id).join() === "tap-TEST-01",
    String(append.status));

  await page.click("#back");
  await page.click("#settings-delete");
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  for (let i = 0; i < 20 && existsSync(path.join(learners, `${idOf("TEST-01")}.json`)); i++) await page.waitForTimeout(100);
  check("5. Delete my data removes learners/<TEST-01 id>.json", !existsSync(path.join(learners, `${idOf("TEST-01")}.json`)));
  check("5. TEST-02's files remain", existsSync(path.join(learners, `${idOf("TEST-02")}.json`)) && existsSync(path.join(live, "live-TEST-02.json")));
  const rows = readFileSync(turnlog, "utf8").trim().split("\n").map((l) => JSON.parse(l).learnerId);
  check("5. Delete my data removes all of TEST-01's turn-log rows and keeps TEST-02's", rows.join() === idOf("TEST-02"), JSON.stringify(rows));
  await browser.close();
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
