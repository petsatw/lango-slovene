// Acceptance check for learning history, Settings and Delete my data: a tester sees their code, lists and
// opens their own sessions, deletes one, cannot read another tester's, and deletes their data.
//   npx tsx server/probes/history-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
    lessonScore: { total: 3, succeeded: ["a"], attempted: ["a", "b"] },
  }));
  writeFileSync(path.join(learners, `${idOf(code)}.json`), JSON.stringify({ learnables: { x: { attempts: 1, successes: 1 } }, facts: {} }));
}

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
  check("1. Settings shows TEST-01", (await page.textContent("#settings-code")) === "TEST-01");

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

  await page.click("#back");
  await page.click("#settings-delete");
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  for (let i = 0; i < 20 && existsSync(path.join(learners, `${idOf("TEST-01")}.json`)); i++) await page.waitForTimeout(100);
  check("5. Delete my data removes learners/<TEST-01 id>.json", !existsSync(path.join(learners, `${idOf("TEST-01")}.json`)));
  check("5. TEST-02's files remain", existsSync(path.join(learners, `${idOf("TEST-02")}.json`)) && existsSync(path.join(live, "live-TEST-02.json")));
  await browser.close();
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
