// Acceptance check: while the tap-dialogue overlay is open the page behind it does not scroll, the
// conversation and choice list scroll on their own, and the page scrolls again once it closes.
//   npx tsx server/probes/dialogue-scroll-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "dscroll-"));
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
const check = (ok: boolean, msg: string) => { if (!ok) throw new Error(msg); };

let pass = false;
try {
  await up();
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage();
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const lv = practice.scenarios
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro);
  if (!lv) throw new Error("no tap-through level to open");

  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  await page.locator('.tile[data-go="practice"]').click();

  // Make the page tall enough to scroll, then scroll it to a non-zero position.
  await page.evaluate(() => { const s = document.createElement("div"); s.style.height = "3000px"; document.body.appendChild(s); });
  const sy = () => page.evaluate(() => window.scrollY);
  const scrollPage = async () => { await page.evaluate(() => window.scrollTo(0, 300)); await page.waitForTimeout(100); return sy(); };
  check((await scrollPage()) > 0, "could not scroll the page on Practice");

  // Opening a scenario moves the page; record the offset once the level list is showing, just before the level opens.
  // DOM clicks: Playwright's own click scrolls the target into view, which would move the recorded offset.
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().evaluate((el) => (el as HTMLElement).click());
  const y0 = await scrollPage();
  check(y0 > 0, `could not scroll the page (scrollY ${y0})`);
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).evaluate((el) => (el as HTMLElement).click());
  await page.waitForSelector("#dialogue:not([hidden])");
  await page.waitForSelector("#dialogue-choices .dialogue-choice");

  // Overlay open: backdrop wheel, choices wheel, scrollBy and End leave the page where it was.
  await page.mouse.move(5, 400);
  await page.mouse.wheel(0, 2000);
  const cb = await page.locator("#dialogue-choices").boundingBox();
  await page.mouse.move(cb!.x + cb!.width / 2, cb!.y + cb!.height / 2);
  await page.mouse.wheel(0, 2000);
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.keyboard.press("End");
  await page.waitForTimeout(200);
  check((await sy()) === y0, `page scrolled behind the overlay: ${await sy()} != ${y0}`);

  for (const sel of [".dialogue-convo", ".choice-list"]) {
    const v = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).overscrollBehaviorY, sel);
    check(v === "contain", `${sel} overscroll-behavior-y is ${v}`);
  }

  // Play choices until the conversation overflows; a wheel over it moves its own scrollTop only.
  let overflow = false;
  for (let i = 0; i < 40 && !overflow; i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
    overflow = await page.evaluate(() => { const c = document.getElementById("dialogue-convo")!; return c.scrollHeight > c.clientHeight + 20; });
  }
  check(overflow, "the conversation never overflowed");
  const convo = await page.locator("#dialogue-convo").boundingBox();
  await page.mouse.move(convo!.x + convo!.width / 2, convo!.y + convo!.height / 2);
  const t0 = await page.evaluate(() => document.getElementById("dialogue-convo")!.scrollTop);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(200);
  const t1 = await page.evaluate(() => document.getElementById("dialogue-convo")!.scrollTop);
  check(t1 !== t0, `conversation scrollTop did not change (${t0})`);
  check((await sy()) === y0, `page scrolled with the conversation: ${await sy()} != ${y0}`);

  // Every attempt to move the page while the overlay (or a sheet over it) is open leaves it at `y`.
  const held = async (y: number, where: string) => {
    check(await page.evaluate(() => document.documentElement.classList.contains("dialogue-open")), `no lock class ${where}`);
    await page.mouse.move(5, 400);
    await page.mouse.wheel(0, 2000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.keyboard.press("End");
    await page.waitForTimeout(200);
    check((await sy()) === y, `page scrolled ${where}: ${await sy()} != ${y}`);
  };
  // After a close the lock is gone: no lock class, and a wheel over the page scrolls it.
  const released = async (where: string) => {
    check(!(await page.evaluate(() => document.documentElement.classList.contains("dialogue-open"))), `lock class left on ${where}`);
    const before = await sy();
    await page.mouse.move(5, 400);
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(300);
    check((await sy()) !== before, `page did not scroll ${where}`);
  };

  // Finish the level: the end-of-level feedback sheet over the dialogue keeps the page locked, and so does
  // closing that sheet and starting the level over.
  for (let i = 0; i < 80 && !(await page.locator("#level-feedback").count()); i++) {
    await page.locator("#dialogue-choices .dialogue-choice").first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  check((await page.locator("#level-feedback").count()) > 0, "never reached the end of the level");
  await page.locator("#level-feedback").click();
  await page.waitForSelector("#feedback:not([hidden])");
  await held(y0, "behind the feedback sheet over the dialogue");
  await page.locator("#feedback-close").click();
  await page.waitForSelector("#feedback", { state: "hidden" });
  await held(y0, "after the feedback sheet closed over the dialogue");
  await page.locator("#dialogue-choices .restart").click();
  await page.waitForSelector("#dialogue-choices .dialogue-choice:not(.restart)");
  await held(y0, "after starting the level over");

  // Close: the position is kept and the page scrolls again.
  await page.locator("#dialogue-close").click();
  await page.waitForSelector("#dialogue", { state: "hidden" });
  check((await sy()) === y0, `scrollY after close ${await sy()} != ${y0}`);
  await released("after the overlay closed");

  // A second dialogue locks at the page's new offset and releases it again, through the handoff when the
  // level offers one, otherwise through the close button.
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().evaluate((el) => (el as HTMLElement).click());
  const y1 = await (async () => { await page.evaluate(() => window.scrollTo(0, 450)); await page.waitForTimeout(100); return sy(); })();
  check(y1 > 0 && y1 !== y0, `could not move the page before the second dialogue (scrollY ${y1})`);
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).evaluate((el) => (el as HTMLElement).click());
  await page.waitForSelector("#dialogue:not([hidden])");
  await page.waitForSelector("#dialogue-choices .dialogue-choice");
  await held(y1, "behind the second dialogue");
  if (await page.locator("#dialogue-handoff").isVisible()) {
    await page.locator("#dialogue-handoff").click();
    await page.waitForSelector("#dialogue", { state: "hidden" });
    await released("after the handoff closed the dialogue");
  } else {
    await page.locator("#dialogue-close").click();
    await page.waitForSelector("#dialogue", { state: "hidden" });
    check((await sy()) === y1, `scrollY after the second close ${await sy()} != ${y1}`);
    await released("after the second dialogue closed");
  }

  await browser.close();
  pass = true;
  console.log("PASS");
} catch (e) {
  console.error("FAIL:", (e as Error).message);
} finally {
  child.kill();
}
process.exit(pass ? 0 : 1);
