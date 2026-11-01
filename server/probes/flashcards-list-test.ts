// Acceptance check for the Words and Phrases row and list, and the list's "Hear it in context" column
// (docs/features/flashcards/spec.md §2, §3, §3.1).
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
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await (await browser.newContext()).newPage();
  // Every media element that play() is called on, so the probe can read its state.
  await page.addInitScript(() => {
    const w = window as any;
    w.__media = new Set();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) { w.__media.add(this); return play.call(this); };
  });
  // The deck as served, with skakati's example nulled.
  await page.route(/\/api\/flashcards\?domainId=sprehod$/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    for (const c of body.cards) if (c.id === "skakati") c.example = null;
    await route.fulfill({ response: res, json: body });
  });
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
    els.map((e) => {
      const btns = [...e.children[2]!.querySelectorAll("button")];
      return {
        en: e.children[0]!.textContent, sl: e.children[1]!.textContent,
        tick: e.querySelector(".words-tick")?.getAttribute("aria-label") ?? null,
        tickText: e.querySelector(".words-tick")?.textContent ?? null,
        third: (e.children[2]!.textContent || "").trim(), buttons: btns.length,
        label: btns[0]?.getAttribute("aria-label") ?? null,
      };
    }));
  const openList = async () => {
    await page.click("#words-overview");
    await page.waitForSelector("#words-list .words-item");
  };
  const audioPath = (id: string) => `/api/flashcards/audio?domainId=sprehod&id=${id}`;
  const media = () => page.evaluate(() => [...(window as any).__media].map((m: HTMLMediaElement) =>
    ({ src: m.currentSrc, paused: m.paused, t: m.currentTime })).filter((m) => m.src.includes("/api/flashcards/audio")));
  const playing = async (id: string) => (await media()).filter((m) => m.src === `${base}${audioPath(id)}` && !m.paused);
  const allPaused = async () => (await media()).every((m) => m.paused);
  // Waits until the clip for id is playing past t seconds.
  const waitPlaying = (id: string, t: number) => page.waitForFunction(([src, t]) => [...(window as any).__media].some((m: HTMLMediaElement) =>
    m.currentSrc === src && m.currentTime > t && !m.paused), [`${base}${audioPath(id)}`, t] as const);
  const tapPlay = (id: string) => page.locator(`#words-list .words-item:nth-child(${order.indexOf(id) + 1}) .words-play`).click();
  const flush = () => page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const logPath = path.join(data, "events", "events.jsonl");
  const logLines = () => { try { return readFileSync(logPath, "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
  const settledLines = async () => {
    let n = -1, same = 0;
    for (let i = 0; i < 40 && same < 3; i++) { await page.waitForTimeout(250); const k = logLines(); same = k === n ? same + 1 : 0; n = k; }
    return n;
  };
  const audioReqs: string[] = [];
  const audioStatus = new Map<string, number[]>();
  page.on("request", (r) => { if (r.url().includes("/api/flashcards/audio")) audioReqs.push(r.url()); });
  page.on("response", (r) => { if (r.url().includes("/api/flashcards/audio")) audioStatus.set(r.url(), [...(audioStatus.get(r.url()) ?? []), r.status() === 206 ? 200 : r.status()] /* Chromium's Range request answers 206 */); });
  let order: string[] = [];

  // 3. The row sits above the first level card and reads only its label and chip.
  await openLevels();
  eq("row text", await page.$eval("#words-row", (e: Element) => [...e.children].map((c) => (c.textContent || "").trim())), ["Words and Phrases", "Overview", "Flashcards"]);
  const above = await page.evaluate(() => {
    const row = document.getElementById("words-row")!, card = document.querySelector("#level-list .level-card")!;
    return !!(row.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  eq("row above first level card", above, true);

  // 4. The list.
  await openList();
  eq("title", await page.$eval("#words .screen-title", (e: Element) => e.textContent), "Words and Phrases");
  let list = await rows();
  eq("row count", list.length, 80);
  eq("first row", [list[0]!.en, list[0]!.sl], ["can / may", "Ali lahko ___? / Lahko ___."]);
  eq("ticks at start", list.filter((r) => r.tick).length, 0);

  // 4b. Heading "Hear it in context" sits above the first row, over its third column, and is not a row.
  const head = await page.evaluate(() => {
    const el = [...document.querySelectorAll("#words *")].find((e) => e.children.length === 0 && e.textContent === "Hear it in context")!;
    const row = document.querySelector("#words-list .words-item")!;
    const h = el.getBoundingClientRect(), c = row.children[2]!.getBoundingClientRect();
    return { isRow: !!el.closest(".words-item"), above: h.bottom <= row.getBoundingClientRect().top, over: h.left < c.right && h.right > c.left };
  });
  eq("heading", head, { isRow: false, above: true, over: true });

  // 4c. One play button per card with an example, none for skakati.
  const deck = await (await fetch(`${base}/api/flashcards?domainId=sprehod`, { headers: { "x-tester-code": "TEST-01" } })).json();
  const cardsRouted = deck.cards.map((c: any) => (c.id === "skakati" ? { ...c, example: null } : c));
  order = cardsRouted.map((c: any) => c.id);
  eq("buttons", list.map((r) => [r.buttons, r.label, r.third]),
    cardsRouted.map((c: any) => (c.example ? [1, "Hear it in context", "▶"] : [0, null, ""])));
  const withEx: string[] = cardsRouted.filter((c: any) => c.example).map((c: any) => c.id);
  if (withEx.length < 8 || !withEx.includes("star_sem_let")) fail(`cards with an example: ${withEx.length}`);
  const [B, C, D, E, F, G] = withEx.filter((id) => id !== "star_sem_let").slice(0, 6) as [string, string, string, string, string, string];

  // 5. No preloading: nothing requested or played until a ▶ is tapped; a row tap outside ▶ does nothing.
  await page.waitForTimeout(1000);
  await page.locator("#words-list .words-item .words-en").first().click();
  eq("audio requests before tap", audioReqs, []);
  eq("media before tap", await media(), []);
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
  const want = cards.cards.map((c: { id: string; en: string; sl: string }) => [c.en, c.sl, c.id === "star_sem_let" ? "✓" : null]);
  eq("row text", list.map((r) => [r.en, r.sl, r.tickText]), want);
  eq("tick name", list.filter((r) => r.tick).map((r) => r.tick), ["Memorised"]);

  // 9. ▶ plays from the start, restarts, and plays one clip at a time.
  const A = "star_sem_let";
  await tapPlay(A);
  await waitPlaying(A, 0.5);
  eq("A request", audioStatus.get(`${base}${audioPath(A)}`), [200]);
  eq("A requests", audioReqs.filter((u) => u.endsWith(audioPath(A))).length, 1);
  await page.evaluate(([i, src]) => {
    const m = [...(window as any).__media].find((e: HTMLMediaElement) => e.currentSrc === src) as HTMLMediaElement;
    (document.querySelectorAll("#words-list .words-item")[i]!.querySelector(".words-play") as HTMLElement).click();
    (window as any).__after = m.currentTime;
  }, [order.indexOf(A), `${base}${audioPath(A)}`] as const);
  if ((await page.evaluate(() => (window as any).__after)) >= 0.3) fail("A did not restart");
  await page.waitForTimeout(500);
  const again = await playing(A);
  if (again.length !== 1 || again[0]!.t <= 0) fail("A not playing after restart");

  await tapPlay(B);
  await waitPlaying(B, 0.2);
  eq("only B unpaused", (await media()).filter((m) => !m.paused).map((m) => m.src), [`${base}${audioPath(B)}`]);

  // 10. Leaving stops it: Back, then the Flashcards button.
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden);
  eq("paused after Back", await allPaused(), true);
  await openList();
  await tapPlay(B);
  await waitPlaying(B, 0.2);
  await page.click("#words-flashcards-btn");
  await page.waitForFunction(() => !document.getElementById("flashcards")!.hidden);
  eq("paused after Flashcards button", await allPaused(), true);
  await page.click("#back");
  await page.waitForSelector("#words:not([hidden]) .words-item");

  // 11. A 404 is silent: no change on screen, one request, and the next ▶ plays.
  await page.route(`**${audioPath(C)}`, (route) => route.fulfill({ status: 404, json: { error: "no clip" } }));
  const shape = () => page.evaluate(() => ({ text: (document.getElementById("words") as HTMLElement).innerText, n: document.querySelectorAll("#words *").length }));
  const before = await shape();
  await tapPlay(C);
  await page.waitForTimeout(1000);
  eq("404 screen unchanged", await shape(), before);
  eq("404 requested once", audioReqs.filter((u) => u.endsWith(audioPath(C))).length, 1);
  await tapPlay(D);
  await waitPlaying(D, 0.2);

  // 12. Playing records no event.
  await page.click("#back");
  await openList();
  await flush();
  const lines = await settledLines();
  for (const id of [E, F, G]) await tapPlay(id);
  await page.waitForTimeout(500);
  await flush();
  eq("events after three plays", await settledLines(), lines);

  // 13. The card-mode switch off leaves the column as it is.
  await page.evaluate(() => localStorage.setItem("flashcardsInContext", "0"));
  await page.click("#back");
  await openList();
  list = await rows();
  eq("buttons with switch off", list.map((r) => [r.buttons, r.label, r.third]),
    cardsRouted.map((c: any) => (c.example ? [1, "Hear it in context", "▶"] : [0, null, ""])));
  eq("heading with switch off", await page.evaluate(() => (document.getElementById("words") as HTMLElement).innerText.includes("Hear it in context")), true);
  const H = withEx.filter((id) => ![A, B, C, D, E, F, G].includes(id))[0]!;
  await tapPlay(H);
  await waitPlaying(H, 0.2);
  eq("H request", audioStatus.get(`${base}${audioPath(H)}`), [200]);

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
