// Acceptance check for the "Hear it in context" switch (docs/features/flashcards/spec.md §4.1, §4.2, §9).
//   npx tsx server/probes/flashcards-in-context-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "fc-context-"));
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
const log = path.join(data, "events", "events.jsonl");
const rows = (): any[] => {
  try { return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
};

try {
  await up();
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page: any = await (await browser.newContext()).newPage();

  let cards: Card[] = [];
  await page.route((u: URL) => u.pathname === "/api/flashcards" && u.searchParams.get("domainId") === "sprehod", async (route: any) => {
    const res = await route.fetch();
    const body = await res.json();
    body.cards = body.cards.filter((c: Card) => KEEP.includes(c.id)).map((c: Card) => (c.id === "skakati" ? { ...c, example: null } : c));
    cards = body.cards;
    await route.fulfill({ response: res, json: body });
  });

  const audio: { id: string; status: number }[] = [];
  page.on("response", (r: any) => {
    const u = new URL(r.url());
    // Chromium sends Range on media requests, so a served clip may answer 206.
    if (u.pathname === "/api/flashcards/audio") audio.push({ id: u.searchParams.get("id")!, status: r.status() === 206 ? 200 : r.status() });
  });

  const text = (sel: string) => page.$eval(sel, (e: Element) => (e.textContent || "").trim());
  const sections = () => page.$$eval("#fc-card .fc-example", (els: Element[]) => els.map((e) => (e.textContent || "").trim()));
  // No card's example.en reaches the page text.
  const noEn = async (where: string) => {
    const body: string = await page.evaluate(() => document.body.innerText);
    for (const c of cards) if (c.example && body.includes(c.example.en)) fail(`${where}: page shows example.en of ${c.id}`);
  };
  const shown = async (): Promise<Card> => {
    await page.waitForSelector("#fc-card:not([hidden])");
    const main = await text("#fc-card .fc-main");
    return cards.find((c) => c.en === main || c.sl === main) ?? fail(`unknown card text ${main}`);
  };
  const tap = () => page.click("#fc-card");
  const next = async () => {
    if (!(await page.$eval("#fc-rate", (e: HTMLElement) => !e.hidden))) await tap();
    await page.click("#fc-nailed");
  };
  const playing = (id: string) => page.waitForFunction((id: string) => {
    const a = document.getElementById("fc-audio") as HTMLAudioElement;
    return new URL(a.src).searchParams.get("id") === id && !a.paused && a.currentTime > 0;
  }, id, { timeout: 5000 }).catch(() => fail(`clip ${id} not playing`));
  const until = async (name: string, fn: () => boolean) => {
    for (let i = 0; i < 40; i++) { if (fn()) return; await page.waitForTimeout(100); }
    fail(`timed out: ${name}`);
  };
  const openCardMode = async () => {
    await page.click('.tile[data-go="practice"]');
    await page.locator(".domain-card", { hasText: "Walking the Dogs" }).first().click();
    await page.waitForSelector("#words-row:not([hidden])");
    await page.click("#words-flashcards");
    await page.waitForFunction(() => !document.getElementById("flashcards")!.hidden && !document.getElementById("fc-card")!.hidden);
  };
  const quitLesson = async () => {
    await page.waitForFunction(() => !document.getElementById("home")!.hidden || !document.getElementById("scene")!.hidden);
    await page.evaluate(() => { const s = document.getElementById("scene")!; if (!s.hidden) document.getElementById("scene-quit")!.click(); });
    await page.waitForFunction(() => !document.getElementById("home")!.hidden);
  };
  // Rate through cards on their English side until one with an example is on screen.
  const toExampleCard = async (): Promise<Card> => {
    for (let i = 0; i < 6; i++) {
      const c = await shown();
      if (c.example) return c;
      await next();
      await page.waitForTimeout(100);
    }
    return fail("no card with an example came up");
  };

  await page.goto(`${base}/?c=TEST-01`);
  await quitLesson();
  await openCardMode();

  // Default on.
  eq("switch on", await page.isChecked("#fc-context"), true);
  eq("switch label", await text("label.fc-switch:has(#fc-context)"), "Hear it in context");
  eq("key unset or on", await page.evaluate(() => localStorage.flashcardsInContext ?? "1"), "1");

  // On: English side has no section; Slovene side shows heading + sl; one clip.
  let card = await toExampleCard();
  eq("english side", await text("#fc-card .fc-main"), card.en);
  eq("no section on english", await sections(), []);
  await noEn("english side");
  await tap();
  eq("section", await sections(), [`In Context${card.example!.sl}`]);
  eq("heading", await text("#fc-card .fc-example-head"), "In Context");
  await until("clip request", () => audio.length === 1);
  eq("clip", audio, [{ id: card.id, status: 200 }]);
  await playing(card.id);
  await noEn("slovene side");

  // Off while the clip plays.
  await page.uncheck("#fc-context");
  eq("clip paused", await page.$eval("#fc-audio", (a: HTMLAudioElement) => a.paused), true);
  eq("section gone", await sections(), []);
  eq("stored off", await page.evaluate(() => localStorage.flashcardsInContext), "0");
  await noEn("switch off");
  await tap();
  await tap();
  eq("no section on turn back", await sections(), []);
  await noEn("turned back");
  for (let k = 0; k < 3; k++) {
    const c = await shown();
    if ((await text("#fc-card .fc-main")) === c.en) await tap();
    eq(`no section on ${c.id}`, await sections(), []);
    await noEn(`off ${c.id}`);
    await next();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(300);
  eq("no new clip request while off", audio.length, 1);

  // Reload: still off; turn on; a clip only when a Slovene side next comes into view.
  await page.reload();
  await quitLesson();
  await openCardMode();
  eq("still off", await page.isChecked("#fc-context"), false);
  await page.check("#fc-context");
  await page.waitForTimeout(300);
  eq("no clip on the card on screen", audio.length, 1);
  eq("stored on", await page.evaluate(() => localStorage.flashcardsInContext), "1");
  card = await toExampleCard();
  await tap();
  eq("section back", await sections(), [`In Context${card.example!.sl}`]);
  await until("second clip request", () => audio.length === 2);
  eq("second clip", audio[1], { id: card.id, status: 200 });
  await noEn("on again");
  // The card without an example shows no section and makes no request.
  for (let i = 0; i < 6; i++) {
    await next();
    const c = await shown();
    if (!c.example) {
      const before = audio.length;
      await tap();
      eq("no-example card has no section", await sections(), []);
      await page.waitForTimeout(300);
      eq("no-example card makes no request", audio.length, before);
      break;
    }
  }

  // The log.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1000);
  const changes = rows().filter((r) => r.name === "flashcards_setting_changed").map((r) => r.props);
  eq("events", changes, [{ setting: "inContext", value: false }, { setting: "inContext", value: true }]);

  await browser.close();
  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
