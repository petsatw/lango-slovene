// Acceptance check for the flashcard events (docs/features/flashcards/spec.md §9): a drill through card mode
// and the list leaves the five flashcard events, with their props, in the log on the volume.
//   npx tsx server/probes/flashcards-events-test.ts
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "fc-events-"));
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

type Card = { id: string; en: string; sl: string; example: unknown };
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

  const flush = () => page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const shown = async (): Promise<Card> => {
    await page.waitForSelector("#fc-card:not([hidden])");
    const main = (await page.$eval("#fc-card .fc-main", (e: Element) => (e.textContent || "").trim())) as string;
    return cards.find((c) => c.en === main || c.sl === main) ?? fail(`unknown card text ${main}`);
  };
  const cardModeOpen = () => page.waitForFunction(() => !document.getElementById("flashcards")!.hidden && !document.getElementById("fc-card")!.hidden);

  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  // 3. Overview chip: flip the first side to Slovene and back, rate the three cards, Back.
  await page.click('.tile[data-go="practice"]');
  await page.locator(".domain-card", { hasText: "Walking the Dogs" }).first().click();
  await page.waitForSelector("#words-row:not([hidden])");
  await page.click("#words-flashcards");
  await cardModeOpen();
  await page.click('.fc-seg-opt[data-side="sl"]');
  await page.click('.fc-seg-opt[data-side="en"]');
  for (let k = 0; k < 3; k++) {
    const card = await shown();
    await page.click("#fc-card");
    await page.click(card.id === "star_sem_let" ? "#fc-nailed" : "#fc-oops");
  }
  await page.waitForSelector("#fc-toast:not([hidden])");
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("levels")!.hidden);

  // 4. List button: Include memorised on, Back.
  await page.click("#words-overview");
  await page.waitForSelector("#words-list .words-item");
  await page.click("#words-flashcards-btn");
  await page.waitForFunction(() => !document.getElementById("flashcards")!.hidden && !document.getElementById("fc-empty")!.hidden || !document.getElementById("fc-card")!.hidden);
  await page.check("#fc-include");
  await page.click("#back");
  await page.waitForFunction(() => !document.getElementById("words")!.hidden && document.getElementById("flashcards")!.hidden);

  // 5. The log.
  await flush();
  await page.waitForTimeout(1000);
  const all = rows();
  const start = all.findIndex((r) => r.name === "screen_viewed" && r.props.screen === "flashcards");
  if (start < 0) fail("no screen_viewed flashcards");
  const seq = all.slice(start).filter((r) => r.name.startsWith("flashcard") || (r.name === "screen_viewed" && ["flashcards", "words"].includes(r.props.screen)));
  const order = seq.map((r) => r.name === "screen_viewed" ? `screen:${r.props.screen}` : r.name);
  // The three rate rows settle in any order between started and pass_completed.
  eq("order", order, [
    "screen:flashcards", "flashcards_started", "flashcards_setting_changed", "flashcards_setting_changed",
    "flashcard_rated", "flashcard_rated", "flashcard_rated", "flashcards_pass_completed", "flashcards_ended",
    "screen:words", "screen:flashcards", "flashcards_started", "flashcards_setting_changed", "flashcards_ended",
    "screen:words",
  ]);
  const p = (i: number) => seq[i].props;
  eq("started 1", p(1), { domainId: "sprehod", from: "overview", firstSide: "en", includeMemorised: false, deckSize: 3 });
  eq("setting 1", [p(2), p(3)], [{ setting: "firstSide", value: "sl" }, { setting: "firstSide", value: "en" }]);
  const rated = [4, 5, 6].map(p);
  for (const r of rated) {
    eq("rated domain/side", [r.domainId, r.firstSide], ["sprehod", "en"]);
    eq(`rated ${r.learnableId}`, [r.result, r.hasAudio], [r.learnableId === "star_sem_let" ? "nailed" : "oops", r.learnableId !== "skakati"]);
    if (r.learnableId === "star_sem_let") eq("memorised", r.memorised, false);
  }
  eq("rated ids", rated.map((r) => r.learnableId).sort(), [...KEEP].sort());
  eq("pass", p(7), { domainId: "sprehod", pass: 1, cards: 3 });
  const ended = p(8);
  eq("ended 1", [ended.domainId, ended.rated, ended.ms > 0], ["sprehod", 3, true]);
  eq("started 2", p(11), { domainId: "sprehod", from: "list", firstSide: "en", includeMemorised: false, deckSize: 3 });
  eq("setting 2", p(12), { setting: "includeMemorised", value: true });
  eq("ended 2", [p(13).domainId, p(13).rated, p(13).ms > 0], ["sprehod", 0, true]);

  // 6. No `nailed` count, no free text.
  for (const r of seq) {
    if ("nailed" in r || "nailed" in r.props || "text" in r || "text" in r.props) fail(`row carries nailed/text: ${JSON.stringify(r)}`);
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
