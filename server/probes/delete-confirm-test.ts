// Acceptance check for the delete confirms: each says whether progress stays, and the deletes behave as said.
//   npx tsx server/probes/delete-confirm-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "delete-confirm-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", TURNLOG: "0" },
  stdio: "ignore",
});

const idOf = (code: string) => "t-" + createHash("sha256").update(code).digest("hex").slice(0, 16);
const learnerId = idOf("TEST-01");
const live = path.join(data, "live");
const sessions = path.join(data, "sessions");
const learners = path.join(data, "learners");
const learnerFile = path.join(learners, `${learnerId}.json`);
const turnlog = path.join(data, "turnlog", "turns.jsonl");
for (const d of [live, sessions, learners, path.dirname(turnlog)]) mkdirSync(d, { recursive: true });

const liveIds = ["live-a", "live-b"];
liveIds.forEach((sessionId, i) => {
  writeFileSync(path.join(live, `${sessionId}.json`), JSON.stringify({
    sessionId, learnerId, testerCode: "TEST-01", runId: null, lessonId: "fixture-lesson", provider: "grok",
    startedAt: `2026-10-01T1${i}:00:00.000Z`, endedAt: `2026-10-01T1${i}:05:00.000Z`, error: null,
    transcripts: [{ ts: "2026-10-01T10:00:01.000Z", role: "tutor", text: "Dober dan" }], progressed: [],
  }));
});
writeFileSync(path.join(sessions, "tap-a.json"), JSON.stringify({
  id: "tap-a", scenarioId: "fixture-scenario", createdAt: "2026-10-02T10:00:00.000Z", updatedAt: "2026-10-02T10:05:00.000Z",
  status: "completed", finalObjectives: [], learnerId, testerCode: "TEST-01",
  turns: [{ index: 0, role: "tutor", text: "Dober dan" }],
}));
const learnables = { x: { attempts: 1, successes: 1 } };
writeFileSync(learnerFile, JSON.stringify({ learnables, facts: {} }));
writeFileSync(turnlog, [
  { learnerId, path: "live", sessionId: "live-a" },
  { learnerId, path: "live", sessionId: "live-b" },
  { learnerId, path: "tap", runId: "tap-a" },
].map((r) => JSON.stringify(r) + "\n").join(""));

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};
const learnablesKept = () => existsSync(learnerFile) && JSON.stringify(JSON.parse(readFileSync(learnerFile, "utf8")).learnables) === JSON.stringify(learnables);
const fileOf = (id: string) => path.join(id.startsWith("tap-") ? sessions : live, `${id}.json`);

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  const dialogs: string[] = [];
  page.on("dialog", (d) => { dialogs.push(d.message()); d.accept(); });
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForSelector("#header-settings");
  await page.click("#header-settings");
  await page.click("#settings-history");
  await page.waitForSelector(".history-entry");
  const allIds = await page.$$eval(".history-entry", (els) => els.map((e) => (e as HTMLElement).dataset.id!));
  check("history lists the three seeded sessions", allIds.length === 3, JSON.stringify(allIds));

  const victim = allIds[0];
  await page.click(".history-entry .history-delete");
  await page.waitForFunction((n) => document.querySelectorAll(".history-entry").length === n, allIds.length - 1);
  check("Delete: confirm text", dialogs[0] === "Delete this session? Your progress stays.", String(dialogs[0]));
  check("Delete: that entry's file is gone", !existsSync(fileOf(victim)));
  check("Delete: the other entries remain", allIds.slice(1).every((id) => existsSync(fileOf(id))));
  check("Delete: learner model kept", learnablesKept());

  await page.click("#history-delete-all");
  await page.waitForFunction(() => !document.querySelector(".history-entry"));
  check("Delete all: confirm text", dialogs[1] === "Delete all your saved sessions? Your progress stays.", String(dialogs[1]));
  const list = await (await fetch(`${base}/api/history`, { headers: { "x-tester-code": "TEST-01" } })).json();
  check("Delete all: history is empty", list.entries.length === 0, JSON.stringify(list.entries));
  const rows = existsSync(turnlog) ? readFileSync(turnlog, "utf8").trim().split("\n").filter(Boolean) : [];
  check("Delete all: session turn-log rows are gone", rows.length === 0, String(rows.length));
  check("Delete all: learner model kept", learnablesKept());

  await page.click("#back");
  await page.click("#settings-delete");
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  for (let i = 0; i < 20 && existsSync(learnerFile); i++) await page.waitForTimeout(100);
  check("Delete my data: confirm text",
    dialogs[2] === "Delete all your data? This removes your sessions and your progress, and can't be undone.", String(dialogs[2]));
  check("Delete my data: learner model gone", !existsSync(learnerFile));
  check("exactly three dialogs fired", dialogs.length === 3, String(dialogs.length));
  await browser.close();
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
