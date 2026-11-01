// Acceptance check for the dialogue controls: Start over / Back / Next in a tap dialogue, and the spoken
// lesson's Start over chip.
//   npx tsx server/probes/dialogue-controls-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "dialogue-controls-"));
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01" },
  stdio: "ignore",
});

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not start");
}

const log = path.join(data, "events", "events.jsonl");
const rows = () => {
  try { return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

// Every numeric leaf of the learner model by path, to show nothing went down.
const numbers = (v: any, p = "", out: Record<string, number> = {}) => {
  if (typeof v === "number") out[p] = v;
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) numbers(x, `${p}/${k}`, out);
  return out;
};

const checks: Record<string, boolean> = {};
let pass = false;
try {
  await up();
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const levels = practice.scenarios.flatMap((sc: any) => sc.dialogues.map((d: any, i: number) => ({ sc, d, i })));
  const forks = (d: any) => {
    // forks along the path that takes the first option each time
    let n = 0, id = d.root;
    for (let guard = 0; guard < 100 && d.nodes?.[id]; guard++) {
      const opts = (d.nodes[id].next || []).filter((c: string) => d.nodes[c]);
      if (!opts.length) break;
      n++;
      id = d.nodes[opts[0]].next?.[0];
    }
    return n;
  };
  const tap = levels.find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro && forks(x.d) >= 3 &&
    (x.d.nodes[x.d.root].next || []).length >= 2);
  const spoken = levels.find((x: any) => x.d.advance === "audio");
  if (!tap) throw new Error("no tap level with three forks");
  if (!spoken) throw new Error("no spoken level");

  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  const bubbles = () => page.locator("#dialogue-convo .bubble").allInnerTexts();
  const choices = () => page.locator("#dialogue-choices .choice-list .dialogue-choice");
  const settle = async () => { await page.waitForTimeout(400); };
  const waitFork = () => page.waitForSelector("#dialogue-choices .choice-list .dialogue-choice", { timeout: 15000 });
  const enabled = async (id: string) => !(await page.locator(id).isDisabled());
  const same = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

  // ---- tap level
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: tap.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(tap.i).click();
  await page.waitForSelector("#dialogue-convo .bubble");
  await waitFork();

  const names = await page.evaluate(() => ["dialogue-restart", "dialogue-back", "dialogue-next"].map((id) => {
    const b = document.getElementById(id)!;
    return [b.textContent!.trim(), b.getAttribute("aria-label")];
  }));
  checks["controls read Start over, Back, Next"] = JSON.stringify(names) === JSON.stringify([["↻ Start over", "Start over"], ["Back", "Back"], ["Next", "Next"]]);
  checks["Back and Next disabled at the start"] = !(await enabled("#dialogue-back")) && !(await enabled("#dialogue-next"));
  const box = await page.evaluate(() => {
    const r = document.getElementById("dialogue-nav")!.getBoundingClientRect();
    const c = document.querySelector("#dialogue .dialogue-card")!.getBoundingClientRect();
    return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top, w: c.width, h: c.height };
  });
  console.log("nav row centre in card:", JSON.stringify(box));
  checks["row in the card's lower-left quadrant"] = box.x < box.w / 2 && box.y > box.h / 2;

  const T0 = await bubbles();
  await choices().nth(1).click(); await waitFork(); const T1 = await bubbles();
  await choices().nth(0).click(); await waitFork(); const T2 = await bubbles();
  await choices().nth(0).click();
  let T3: string[];
  // the third choice may end the level instead of offering a fork
  await page.waitForSelector("#dialogue-choices .choice-list .dialogue-choice, #level-feedback", { timeout: 15000 });
  T3 = await bubbles();

  const flush = async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(800);
  };
  await flush();
  const rowsBeforeNav = rows().length;
  await page.locator("#dialogue-back").click(); await settle();
  checks["Back → one step fewer, its fork's choices shown"] = same(await bubbles(), T2) && (await choices().count()) > 0;
  await page.locator("#dialogue-back").click(); await settle();
  checks["Back again → T1"] = same(await bubbles(), T1);
  await page.locator("#dialogue-next").click(); await settle();
  await page.locator("#dialogue-next").click(); await settle();
  checks["Next twice → T3, Next disabled"] = same(await bubbles(), T3) && !(await enabled("#dialogue-next"));
  await flush();
  checks["no event for Back or Next"] = rows().length === rowsBeforeNav;

  // Different choice after Back drops the undone step.
  await page.locator("#dialogue-back").click(); await settle();
  const n = await choices().count();
  await choices().nth(n - 1).click(); await settle();
  checks["new choice after Back disables Next"] = !(await enabled("#dialogue-next"));

  // Play to the end.
  for (let i = 0; i < 60 && !(await page.locator("#level-feedback").count()); i++) {
    await page.locator("#dialogue-choices .choice-list .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  checks["end shows #level-feedback and no second Start over"] =
    (await page.locator("#level-feedback").count()) === 1 &&
    (await page.locator("#dialogue-choices").getByText("Start over").count()) === 0 &&
    (await page.getByText("Start over").filter({ visible: true }).count()) === 1;
  await page.locator("#dialogue-back").click(); await settle();
  const backAtFork = (await choices().count()) > 0;
  await page.locator("#dialogue-next").click(); await settle();
  checks["Back from the end → fork; Next → the end"] = backAtFork && (await page.locator("#level-feedback").count()) === 1;

  await page.locator("#dialogue-restart").click(); await settle();
  checks["Start over → one bubble, Back and Next disabled"] =
    (await bubbles()).length === 1 && (await bubbles())[0] === T0[0] && !(await enabled("#dialogue-back")) && !(await enabled("#dialogue-next"));

  // ---- spoken lesson
  await page.locator("#dialogue-close").click();
  await page.waitForFunction(() => document.getElementById("dialogue")!.hidden);
  await flush();
  const beforePresses = rows().filter((r) => r.name === "level_restarted").length;

  const learnerId = await page.evaluate(() => localStorage.getItem("learnerId"));
  const learnerFile = path.join(data, "learners", `${learnerId}.json`);
  await page.goto(`${base}/`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden || !document.getElementById("home")!.hidden);
  if (await page.locator("#scene").isVisible()) {
    await page.evaluate(() => document.getElementById("scene-quit")!.click());
    await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  }
  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: spoken.sc.name }).first().click();
  // The lesson's first line, as the server sends it with the opening reply.
  let openingLine = "";
  page.on("response", async (res) => {
    if (!res.url().endsWith("/api/scene") || openingLine) return;
    const body = await res.json().catch(() => null);
    if (body?.npc?.sl) openingLine = body.npc.sl;
  });
  await page.locator("#level-list .level-card").nth(spoken.i).click();
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  const caption = () => page.locator("#scene-caption").innerText();
  const chipOn = (id: string) => page.evaluate((i) => document.getElementById(i)!.getAttribute("aria-disabled") !== "true", id);
  // Through the on-ramp (skip with »), to the first line.
  for (let i = 0; i < 40 && !(await caption()).trim(); i++) {
    await page.locator("#scene-skip").click({ timeout: 500 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForFunction(() => document.getElementById("scene-caption")!.classList.contains("shown"), null, { timeout: 30000 });
  const first: string = openingLine;
  for (let step = 0; step < 2; step++) {
    await page.waitForFunction(() => document.getElementById("scene-skip")!.getAttribute("aria-disabled") !== "true", null, { timeout: 30000 });
    const was = await caption();
    await page.locator("#scene-skip").click();
    await page.waitForFunction((w) => document.getElementById("scene-caption")!.innerText !== w, was, { timeout: 30000 });
  }
  await page.waitForFunction(() => document.getElementById("scene-back")!.getAttribute("aria-disabled") !== "true", null, { timeout: 30000 });
  await flush();
  const model = () => { try { return numbers(JSON.parse(readFileSync(learnerFile, "utf8"))); } catch { return {}; } };
  const modelBefore = model();
  const titled = await page.locator("#scene-restart").getAttribute("title");
  await page.locator("#scene-restart").click();
  await page.waitForFunction((f) => document.getElementById("scene-caption")!.innerText === f && document.getElementById("scene-back")!.getAttribute("aria-disabled") === "true", first, { timeout: 30000 })
    .catch(async (e) => { console.log("after restart:", JSON.stringify([first, await caption(), await chipOn("scene-back")])); throw e; });
  checks["spoken: chip titled Start over"] = titled === "Start over";
  checks["spoken: caption is the first line, « disabled"] = (await caption()) === first && !(await chipOn("scene-back"));
  await flush();
  const modelAfter = model();
  checks["spoken: no credit or attempt went down"] = Object.entries(modelBefore).every(([k, v]) => (modelAfter[k] ?? 0) >= v);

  await flush();
  await browser.close();

  const ev = rows();
  const restarted = ev.filter((r) => r.name === "level_restarted");
  const completed = ev.filter((r) => r.name === "level_completed" && r.props.scenarioId === tap.sc.id && r.props.level === tap.d.level);
  checks["two level_restarted rows with scenarioId, level, nodeId"] =
    restarted.length === 2 && restarted.every((r) => r.props.scenarioId && r.props.level != null && r.props.nodeId) && beforePresses === 1;
  checks["exactly one level_completed for the tap run"] = completed.length === 1;
  for (const r of restarted) console.log(JSON.stringify(r.props));
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  pass = Object.values(checks).every(Boolean);
} catch (err) {
  console.error(err);
  for (const [name, ok] of Object.entries(checks)) console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
} finally {
  child.kill("SIGKILL");
}
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
