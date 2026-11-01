// Acceptance check for the difficulty chip: each level card's chip follows the level's computed levelLabel
// (Basic → Beginner, Intermediate → Intermediate, Advanced and Above A1 → Advanced, else Beginner).
//   npx tsx server/probes/difficulty-chip-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "chip-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01" },
  stdio: "ignore",
});

const fail = (m: string): never => { throw new Error(m); };
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("server did not start");
}

const EXPECT: Record<string, string> = { Basic: "Beginner", Intermediate: "Intermediate", Advanced: "Advanced", "Above A1": "Advanced", Survival: "Beginner" };

async function chips(page: any, name: string): Promise<string[]> {
  await page.evaluate(() => (document.getElementById("scene-quit") as HTMLElement | null)?.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.click('.tile[data-go="practice"]');
  await page.locator(".scenario-card", { hasText: name }).first().click();
  await page.waitForSelector("#level-list .level-chip");
  return page.$$eval("#level-list .level-chip", (els: Element[]) => els.map((e) => (e.textContent || "").trim()));
}

try {
  await up();
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const browser = await chromium.launch();

  // 1. Forced labels on the first scenario's first five dialogues.
  const labels = Object.keys(EXPECT);
  const first = practice.scenarios[0];
  const dialogues = Array.from({ length: 5 }, (_, i) => ({ ...first.dialogues[i % first.dialogues.length], levelLabel: labels[i] }));
  const page = await (await browser.newContext()).newPage();
  await page.route("**/api/practice", async (route) => {
    const res = await route.fetch();
    const j = await res.json();
    j.scenarios[0] = { ...j.scenarios[0], dialogues };
    await route.fulfill({ response: res, json: j });
  });
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  eq("forced chips", await chips(page, first.name), labels.map((l) => EXPECT[l]));

  // 2. Real data: every Advanced / Above A1 level reads Advanced; no chip carries a digit or "score".
  const page2 = await (await browser.newContext()).newPage();
  await page2.goto(`${base}/?c=TEST-01`);
  await page2.waitForFunction(() => !document.getElementById("scene")!.hidden || !document.getElementById("home")!.hidden);
  for (const sc of practice.scenarios) {
    const got = await chips(page2, sc.name);
    eq(`${sc.name} chip count`, got.length, sc.dialogues.length);
    sc.dialogues.forEach((d: any, i: number) => {
      if (d.levelLabel === "Above A1" || d.levelLabel === "Advanced") eq(`${sc.name} level ${d.level}`, got[i], "Advanced");
    });
    for (const c of got) if (/\d|score/i.test(c)) fail(`${sc.name}: chip "${c}" matches /\\d|score/i`);
  }
  await browser.close();
  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
