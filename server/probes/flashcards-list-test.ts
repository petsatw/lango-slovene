// Acceptance check for the Words and Phrases row and list (docs/features/flashcards/spec.md §2, §3).
//   npx tsx server/probes/flashcards-list-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "fc-list-"));
const env: NodeJS.ProcessEnv = {
  ...process.env, E3_PROVIDER: "elevenlabs",
  ELEVENLABS_MODEL_ID: "eleven_v3",
  ELEVENLABS_VOICE_ID: "fSzEIez35vDdOs4DQwVh",
  ELEVENLABS_VOICE_ID_MALE: "Jcyy5bkqt86ud0xdZhfW",
  ELEVENLABS_VOICE_ID_SHOP_ASSISTANT: "MMDUS1hxcZnX8i9ZdqNf",
  PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01",
};
delete env.ELEVENLABS_API_KEY;
delete env.GEMINI_API_KEY;
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], { env, stdio: "ignore" });

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

try {
  await up();
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  const openLevels = async () => {
    await page.click('.tile[data-go="practice"]');
    await page.locator(".domain-card", { hasText: "Walking the Dogs" }).first().click();
    await page.waitForSelector("#words-row:not([hidden])");
  };
  const rows = () => page.$$eval("#words-list .words-item", (els: Element[]) =>
    els.map((e) => ({ en: e.children[0]!.textContent, sl: e.children[1]!.textContent, text: (e.textContent || "").trim(), tick: e.querySelector(".words-tick")?.getAttribute("aria-label") ?? null })));
  const openList = async () => {
    await page.click("#words-overview");
    await page.waitForSelector("#words-list .words-item");
  };

  // 3. The row sits above the first level card and reads only its label and chip.
  await openLevels();
  eq("row text", await page.$eval("#words-row", (e: Element) => [...e.children].map((c) => (c.textContent || "").trim())), ["Words and Phrases", "Overview", "Flashcards"]);
  const above = await page.evaluate(() => {
    const row = document.getElementById("words-row")!, card = document.querySelector("#level-list .level-card")!;
    return !!(row.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  eq("row above first level card", above, true);

  // 4. The list. Audio is recorded from here on: the first-open spoken lesson preloads its own clips.
  const audioCalls: string[] = [];
  page.on("request", (r) => { if (/\/api\/speak|\/api\/flashcards\/audio/.test(r.url())) audioCalls.push(r.url()); });
  await openList();
  eq("title", await page.$eval("#words .screen-title", (e: Element) => e.textContent), "Words and Phrases");
  let list = await rows();
  eq("row count", list.length, 80);
  eq("first row", [list[0]!.en, list[0]!.sl], ["can / may", "Ali lahko ___? / Lahko ___."]);
  eq("ticks at start", list.filter((r) => r.tick).length, 0);

  // 5. Tapping a row changes nothing and requests no audio.
  await page.locator("#words-list .words-item").first().click();
  eq("list after tap", await rows(), list);

  // 6. Five nailed ratings through the app's own learner headers.
  await page.evaluate(async () => {
    const h = { "Content-Type": "application/json", "x-learner-id": localStorage.getItem("learnerId") || "", "x-tester-code": localStorage.getItem("testerCode") || "" };
    for (let i = 0; i < 5; i++) {
      await fetch("/api/flashcards/rate", { method: "POST", headers: h, body: JSON.stringify({ domainId: "sprehod", id: "star_sem_let", result: "nailed" }) });
    }
  });

  // 7. Back returns to the levels overview.
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden && document.getElementById("words")!.hidden);

  await page.click("#words-overview");
  await page.waitForSelector("#words-list .words-item");
  const cards = await (await fetch(`${base}/api/flashcards?domainId=sprehod`, { headers: { "x-tester-code": "TEST-01" } })).json();
  list = await rows();
  // Each row is exactly its card's en and sl, in deck order; only star_sem_let ends in ✓.
  const want = cards.cards.map((c: { id: string; en: string; sl: string }) => `${c.en}${c.sl}${c.id === "star_sem_let" ? "✓" : ""}`);
  eq("row text", list.map((r) => r.text), want);
  eq("tick name", list.filter((r) => r.tick).map((r) => r.tick), ["Memorised"]);
  eq("audio requests", audioCalls, []);

  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden);

  // 8. screen_viewed words reaches events.jsonl after a visibilitychange flush.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const log = path.join(data, "events", "events.jsonl");
  let seen = false;
  for (let i = 0; i < 20 && !seen; i++) {
    await page.waitForTimeout(250);
    try {
      seen = readFileSync(log, "utf8").split("\n").filter(Boolean).some((l) => {
        const r = JSON.parse(l);
        return r.name === "screen_viewed" && r.props?.screen === "words";
      });
    } catch {}
  }
  if (!seen) fail("no screen_viewed with screen words in events.jsonl");

  await browser.close();
  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
