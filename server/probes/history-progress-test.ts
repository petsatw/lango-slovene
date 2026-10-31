// Acceptance check for learning-history rows: scenario and date over the progressed objectives.
//   npx tsx server/probes/history-progress-test.ts
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { progressedIds } from "../live/grader";
import { LEARNABLES } from "../learnables";
import { SCENARIOS } from "../scenarios";

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check("1. progressedIds keeps successes among the objectives",
  same(progressedIds(["a", "b", "c"], [{ id: "a", result: "success" }, { id: "b", result: "attempt" }, { id: "z", result: "success" }]), ["a"]));
check("1. progressedIds with no progress is []", same(progressedIds(["a", "b"], []), []));

const scene = SCENARIOS.find((s) => s.id === "trznica")!;
const tap = SCENARIOS.find((s) => s.id === "cafe")!;
const [l1, l2] = scene.surfaces!.live!.core.map((id) => LEARNABLES[id]!) as [typeof LEARNABLES[string], typeof LEARNABLES[string]];
const done = tap.objectives[0]!;
const pend = tap.objectives[1]!;

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "history-progress-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", TURNLOG: "0" },
  stdio: "ignore",
});

const learnerId = "t-" + createHash("sha256").update("TEST-01").digest("hex").slice(0, 16);
const live = path.join(data, "live");
mkdirSync(live, { recursive: true });
mkdirSync(path.join(data, "sessions"), { recursive: true });
// A learner with progress opens on the home screen, where the Settings button is.
mkdirSync(path.join(data, "learners"), { recursive: true });
writeFileSync(path.join(data, "learners", `${learnerId}.json`), JSON.stringify({ learnables: { x: { attempts: 1, successes: 1 } }, facts: {} }));
const liveLog = (sessionId: string, startedAt: string, extra: object) =>
  writeFileSync(path.join(live, `${sessionId}.json`), JSON.stringify({
    sessionId, learnerId, testerCode: "TEST-01", runId: null, lessonId: scene.id, provider: "grok",
    startedAt, endedAt: startedAt, error: null, transcripts: [{ ts: startedAt, role: "tutor", text: "Dober dan" }], ...extra,
  }));
liveLog("p-two", "2026-10-04T10:00:00.000Z", { progressed: [l1.id, l2.id] });
liveLog("p-empty", "2026-10-03T10:00:00.000Z", { progressed: [] });
liveLog("p-absent", "2026-10-02T10:00:00.000Z", {});
writeFileSync(path.join(data, "sessions", "p-tap.json"), JSON.stringify({
  id: "p-tap", scenarioId: tap.id, createdAt: "2026-10-01T10:00:00.000Z", updatedAt: "2026-10-01T10:05:00.000Z",
  status: "completed", learnerId, testerCode: "TEST-01",
  finalObjectives: [{ id: done.id, status: "completed", attempts: 1 }, { id: pend.id, status: "pending", attempts: 0 }],
  turns: [{ index: 0, role: "tutor", text: "Dober dan" }],
}));

const name = scene.name ?? scene.title;
const expected: Record<string, { scenario: string; progressed: string[]; second: string }> = {
  "p-two": { scenario: name, progressed: [l1.sl, l2.sl], second: `Progress on ${l1.sl}, ${l2.sl}` },
  "p-empty": { scenario: name, progressed: [], second: "Practice" },
  "p-absent": { scenario: name, progressed: [], second: "Practice" },
  "p-tap": { scenario: tap.name ?? tap.title, progressed: [done.label], second: `Progress on ${done.label}` },
};

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  const { entries } = await (await fetch(`${base}/api/history`, { headers: { "x-tester-code": "TEST-01" } })).json();
  for (const [id, want] of Object.entries(expected)) {
    const e = entries.find((x: any) => x.id === id);
    check(`3. ${id} has scenario and progressed`, !!e && e.scenario === want.scenario && same(e.progressed, want.progressed),
      JSON.stringify(e && { scenario: e.scenario, progressed: e.progressed }));
  }
  check("3. no entry has score", entries.length === 4 && entries.every((e: any) => !("score" in e)));

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForSelector("#header-settings");
  await page.click("#header-settings");
  await page.click("#settings-history");
  await page.waitForSelector(".history-entry");
  for (const [id, want] of Object.entries(expected)) {
    const row = await page.$eval(`.history-entry[data-id="${id}"] .history-open`, (el) => ({
      head: el.querySelector(".history-head")!.textContent,
      sub: el.querySelector(".history-progress")!.textContent,
      text: el.textContent!,
    }));
    const startedAt = entries.find((x: any) => x.id === id).startedAt;
    const date = await page.evaluate((s) => new Date(s).toLocaleDateString(), startedAt);
    check(`4. ${id} row reads "${want.scenario} · ${date}" over "${want.second}"`,
      row.head === `${want.scenario} · ${date}` && row.sub === want.second && !/\d+\/\d+|score/i.test(row.sub!) && !/score/i.test(row.text),JSON.stringify(row));
  }
  await browser.close();
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
