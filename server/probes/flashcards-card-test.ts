// Acceptance check for card mode (docs/features/flashcards/spec.md §2–§4, §6.4 client side).
//   npx tsx server/probes/flashcards-card-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "fc-card-"));
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

type Card = { id: string; en: string; sl: string; example: { sl: string; en: string } | null };
const KEEP = ["star_sem_let", "ali_lahko", "skakati"];

try {
  await up();
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page: any = await (await browser.newContext()).newPage();

  let cards: Card[] = [], trim = true;
  await page.route((u: URL) => u.pathname === "/api/flashcards" && u.searchParams.get("domainId") === "sprehod", async (route: any) => {
    const res = await route.fetch();
    const body = await res.json();
    if (trim) body.cards = body.cards.filter((c: Card) => KEEP.includes(c.id)).map((c: Card) => (c.id === "skakati" ? { ...c, example: null } : c));
    cards = body.cards;
    await route.fulfill({ response: res, json: body });
  });

  let inCard = false;
  // A served clip: 200, or 206 when the media element sent Range (Chromium sends "bytes=0-"), as audio/mpeg.
  const audio: { id: string; served: boolean }[] = [];
  const rates: string[] = [];
  const speak: string[] = [];
  const bad: string[] = [];
  page.on("response", (r: any) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/flashcards/audio") {
      const served = (r.status() === 200 || r.status() === 206) && r.headers()["content-type"] === "audio/mpeg";
      audio.push({ id: u.searchParams.get("id")!, served });
    }
    if (r.status() === 502) bad.push(r.url());
  });
  page.on("request", (r: any) => {
    const u = new URL(r.url());
    if (u.pathname === "/api/flashcards/rate" && r.method() === "POST") rates.push(u.pathname);
    if (inCard && u.pathname === "/api/speak") speak.push(r.url());
  });

  const quitLesson = async () => {
    await page.waitForFunction(() => !document.getElementById("home")!.hidden || !document.getElementById("scene")!.hidden);
    await page.evaluate(() => { const s = document.getElementById("scene")!; if (!s.hidden) document.getElementById("scene-quit")!.click(); });
    await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  };
  const visible = (sel: string) => page.$eval(sel, (e: HTMLElement) => !e.hidden);
  const text = (sel: string) => page.$eval(sel, (e: Element) => (e.textContent || "").trim());
  const openLevels = async () => {
    await page.click('.tile[data-go="practice"]');
    await page.locator(".domain-card", { hasText: "Walking the Dogs" }).first().click();
    await page.waitForSelector("#words-row:not([hidden])");
  };
  const openCardMode = async () => {
    await page.click("#words-flashcards");
    await page.waitForFunction(() => !document.getElementById("flashcards")!.hidden && (!document.getElementById("fc-card")!.hidden || !document.getElementById("fc-empty")!.hidden));
  };
  const shown = async (): Promise<Card> => {
    await page.waitForSelector("#fc-card:not([hidden])");
    const main = await text("#fc-card .fc-main");
    return cards.find((c) => c.en === main || c.sl === main) ?? fail(`unknown card text ${main}`);
  };
  const tap = () => page.click("#fc-card");
  const rate = async (result: "nailed" | "oops") => {
    if (!(await visible("#fc-rate"))) await tap();
    await page.click(result === "nailed" ? "#fc-nailed" : "#fc-oops");
  };
  const audioPaused = () => page.$eval("#fc-audio", (a: HTMLAudioElement) => a.paused);
  // The card's clip is playing (a repeat of the last clip replays from the media cache, with no new request).
  const playing = (id: string) => page.waitForFunction((id: string) => {
    const a = document.getElementById("fc-audio") as HTMLAudioElement;
    return new URL(a.src).searchParams.get("id") === id && !a.paused && a.currentTime > 0;
  }, id, { timeout: 5000 }).catch(() => fail(`clip ${id} not playing`));
  const until = async (name: string, fn: () => boolean) => {
    for (let i = 0; i < 40; i++) { if (fn()) return; await page.waitForTimeout(100); }
    fail(`timed out: ${name}`);
  };

  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await quitLesson();
  await openLevels();
  inCard = true;
  await openCardMode();

  // 3. Controls and the first card, English side.
  eq("segments", await page.$$eval(".fc-seg-opt", (els: Element[]) => els.map((e) => [(e.textContent || "").trim(), e.getAttribute("aria-pressed")])), [["English", "true"], ["Slovene", "false"]]);
  eq("include off", await page.isChecked("#fc-include"), false);
  let card = await shown();
  eq("english side", await text("#fc-card .fc-main"), card.en);
  eq("no chips", await visible("#fc-rate"), false);
  eq("no audio yet", audio.length, 0);

  // 4. Tap: Slovene side, example, one clip answering 200, chips; tap again: English and paused.
  await tap();
  eq("slovene side", await text("#fc-card .fc-main"), card.sl);
  if (card.example) {
    eq("in context section", await text("#fc-card .fc-example"), `In Context${card.example.sl}`);
    await until("clip request", () => audio.length === 1);
    eq("clip", audio, [{ id: card.id, served: true }]);
    await playing(card.id);
  } else {
    eq("no example line", await page.$$("#fc-card .fc-example"), []);
    await page.waitForTimeout(300);
    eq("no clip request", audio.length, 0);
  }
  eq("chips shown", await visible("#fc-rate"), true);
  await tap();
  eq("back to english", await text("#fc-card .fc-main"), card.en);
  if (card.example) eq("clip paused", await audioPaused(), true);

  // 5. Slovene first applies from the next card.
  await page.click('.fc-seg-opt[data-side="sl"]');
  eq("card stays", await text("#fc-card .fc-main"), card.en);

  // 6–8. Passes. Pass 1–5: star_sem_let nailed, the others "Oops"; pass 6–10: all nailed.
  let prevLast = "";
  for (let pass = 1; pass <= 10; pass++) {
    const want = pass <= 5 ? [...KEEP] : ["ali_lahko", "skakati"];
    const seen: string[] = [];
    for (let k = 0; k < want.length; k++) {
      card = await shown();
      if (k === 0 && pass > 1) {
        if (card.id === prevLast) fail(`pass ${pass} starts with the card that ended the last one`);
      }
      if (!(pass === 1 && k === 0)) {
        eq(`pass ${pass} opens slovene`, await text("#fc-card .fc-main"), card.sl);
        if (card.example) await playing(card.id);
      }
      seen.push(card.id);
      const result = pass <= 5 && card.id !== "star_sem_let" ? "oops" : "nailed";
      if (k === want.length - 1) await page.evaluate(() => { document.getElementById("fc-toast")!.hidden = true; });
      await rate(result);
    }
    eq(`pass ${pass} cards`, [...seen].sort(), [...want].sort());
    prevLast = seen[seen.length - 1]!;
    if (pass < 10) {
      await page.waitForSelector("#fc-toast:not([hidden])");
      eq("toast", await text("#fc-toast"), "Shuffled. Going again.");
    }
    if (pass === 1) eq("rate calls after pass 1", rates.length, 3);
  }
  eq("rate calls", rates.length, 25);
  eq("clips served", audio.every((a) => a.served), true);
  eq("no clip for the card without example", audio.some((a) => a.id === "skakati"), false);

  // 8. Everything memorised: empty state; Include memorised brings the cards back with the check mark.
  await page.waitForSelector("#fc-empty:not([hidden])");
  eq("empty text", await text("#fc-empty"), "Everything here is memorised.");
  eq("no card", await visible("#fc-card"), false);
  eq("no chips", await visible("#fc-rate"), false);
  await page.click('.fc-seg-opt[data-side="en"]');
  await page.check("#fc-include");
  card = await shown();
  eq("english first again", await text("#fc-card .fc-main"), card.en);
  eq("tick on english", await page.$$eval('#fc-card [aria-label="Memorised"]', (e: Element[]) => e.length), 1);
  await tap();
  eq("tick on slovene", await page.$$eval('#fc-card [aria-label="Memorised"]', (e: Element[]) => e.length), 1);
  await page.click('.fc-seg-opt[data-side="sl"]');

  // 9. Settings survive a reload; Back returns to whichever screen opened card mode.
  await page.reload();
  await quitLesson();
  await openLevels();
  await openCardMode();
  eq("kept segments", await page.$$eval(".fc-seg-opt", (els: Element[]) => els.map((e) => e.getAttribute("aria-pressed"))), ["false", "true"]);
  eq("kept include", await page.isChecked("#fc-include"), true);
  eq("stored", await page.evaluate(() => [localStorage.flashcardsFirstSide, localStorage.flashcardsIncludeMemorised]), ["sl", "1"]);
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden && document.getElementById("flashcards")!.hidden);
  trim = false; // the full list, long enough to scroll
  await page.click("#words-overview");
  await page.waitForSelector("#words-list .words-item");
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForFunction(() => scrollY > 0);
  eq("button stays at the top", await page.$eval("#words-flashcards-btn", (e: Element) => e.getBoundingClientRect().top >= 0), true);
  await page.click("#words-flashcards-btn");
  await page.waitForFunction(() => !document.getElementById("flashcards")!.hidden);
  await shown();
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("words")!.hidden && document.getElementById("flashcards")!.hidden);
  await page.waitForSelector("#words-list .words-item");
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden);

  // 10. No synthesis path.
  eq("speak calls", speak, []);
  eq("502s", bad, []);

  await browser.close();
  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
