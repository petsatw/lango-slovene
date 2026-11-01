// Acceptance check for the domain wire and stored keys (docs/features/terminology/spec.md §4): stored
// lines that carry `scenarioId` or `domainId` read the same, responses name a domain by `domainId` /
// `domains` / `domainTokens` / `domain`, and the events the app writes carry `props.domainId`.
//   npx tsx server/probes/domain-wire-test.ts
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { SCENARIOS } from "../scenarios";

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const data = mkdtempSync(path.join(tmpdir(), "domain-wire-"));
const teamKey = randomBytes(12).toString("hex");
const idOf = (code: string) => "t-" + createHash("sha256").update(code).digest("hex").slice(0, 16);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

// ---- fixtures ----
const ts1 = "2026-10-01T10:00:00.000Z";
const ts2 = "2026-10-01T10:01:00.000Z";
const eventLine = (ts: string, props: object) => JSON.stringify({ name: "level_started", ts, learnerId: "Lfix", testerCode: null, props });
const seeded = [eventLine(ts1, { scenarioId: "bakery", level: 1 }), eventLine(ts2, { domainId: "bakery", level: 1 })];
mkdirSync(path.join(data, "events"), { recursive: true });
const log = path.join(data, "events", "events.jsonl");
writeFileSync(log, seeded.join("\n") + "\n");

mkdirSync(path.join(data, "sessions"), { recursive: true });
const session = (id: string, key: string, createdAt: string) =>
  writeFileSync(path.join(data, "sessions", `${id}.json`), JSON.stringify({
    id, [key]: "cafe", createdAt, updatedAt: createdAt, status: "completed", finalObjectives: [],
    learnerId: idOf("TEST-01"), testerCode: "TEST-01", turns: [{ index: 0, role: "tutor", text: "Dober dan" }],
  }));
session("run-old", "scenarioId", "2026-10-02T10:00:00.000Z");
session("run-new", "lessonId", "2026-10-03T10:00:00.000Z");

const keyA = "a".repeat(64), keyB = "b".repeat(64);
mkdirSync(path.join(data, "image"), { recursive: true });
for (const k of [keyA, keyB]) writeFileSync(path.join(data, "image", `${k}.jpg`), "x");
writeFileSync(path.join(data, "manifest.jsonl"), [
  { key: keyA, type: "image", scenarioId: "bakery", objectiveId: "obj-old", styleId: "s" },
  { key: keyB, type: "image", domainId: "bakery", objectiveId: "obj-new", styleId: "s" },
].map((r) => JSON.stringify(r) + "\n").join(""));

const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: data, TESTER_CODES: "TEST-01", TEAM_READ_KEY: teamKey },
  stdio: "ignore",
});

let failed = false;
const check = (name: string, ok: unknown, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !detail ? "" : " — " + detail}`);
  if (!ok) failed = true;
};
const scenarioKeys = (o: unknown, trail = ""): string[] =>
  Array.isArray(o) ? o.flatMap((x) => scenarioKeys(x, trail))
    : o && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) => [...(/scenario/i.test(k) ? [trail + k] : []), ...scenarioKeys(v, trail + k + ".")])
      : [];
const rows = () => readFileSync(log, "utf8").trim().split("\n").filter(Boolean);

try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  // 3. stored data
  const team = async (qs: string) => (await fetch(`${base}/v1/team/events?${qs}`, { headers: { Authorization: `Bearer ${teamKey}` } })).json();
  const first = await team(`limit=1&since=${ts1}`);
  const second = await team(`limit=1&cursor=${first.next}`);
  const kOf = (r: any) => JSON.parse(Buffer.from(r.next, "base64url").toString("utf8")).k;
  check("team events: both seeded rows have props.domainId bakery",
    first.rows[0]?.props?.domainId === "bakery" && second.rows[0]?.props?.domainId === "bakery",
    JSON.stringify([first.rows[0]?.props, second.rows[0]?.props]));
  check("team events: k equals the value computed from the raw line", kOf(first) === `${sha(seeded[0]!)}#1` && kOf(second) === `${sha(seeded[1]!)}#1`);

  const cafe = SCENARIOS.find((s) => s.id === "cafe")!;
  const cafeName = cafe.name ?? cafe.title;
  const history = await (await fetch(`${base}/api/history`, { headers: { "x-tester-code": "TEST-01" } })).json();
  const taps = history.entries.filter((e: any) => e.kind === "tap");
  check("history: both tap entries carry the café's name in domain", taps.length === 2 && taps.every((e: any) => e.domain === cafeName), JSON.stringify(taps.map((e: any) => e.domain)));

  const cli = (script: string) => spawnSync(process.execPath, ["--import", "tsx", script], {
    env: { ...process.env, DATA_DIR: data, ASSET_DIR: data }, encoding: "utf8",
  }).stdout;
  const runs = cli("server/scripts/runs.ts");
  check("npm run runs lists both records", /run-old/.test(runs) && /run-new/.test(runs) && (runs.match(/tap\s+cafe/g) ?? []).length === 2, runs);
  const prune = cli("server/scripts/prune-assets.ts");
  check("npm run prune:assets lists both records", prune.includes("bakery/obj-old") && prune.includes("bakery/obj-new"), prune);

  // 4. response bodies
  for (const p of ["/api/practice", "/api/match/index", "/api/a1", "/api/history"]) {
    const body = await (await fetch(`${base}${p}`, { headers: { "x-tester-code": "TEST-01" } })).json();
    const hits = scenarioKeys(body);
    check(`${p}: no key contains "scenario"`, hits.length === 0, [...new Set(hits)].slice(0, 5).join(", "));
  }

  // 6. /api/scene
  const scene = (body: object) => fetch(`${base}/api/scene`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const practice = await (await fetch(`${base}/api/practice`)).json();
  const spoken = practice.domains.find((d: any) => d.dialogues.some((x: any) => x.advance === "audio"));
  const ok = await scene({ domainId: spoken.id, level: spoken.dialogues.find((x: any) => x.advance === "audio").level });
  const opening = await ok.json();
  check("POST /api/scene with domainId is 200 and returns the opening beat", ok.status === 200 && opening && typeof opening === "object" && Object.keys(opening).length > 0, String(ok.status));
  check("POST /api/scene without domainId is 400", (await scene({ level: 1 })).status === 400);

  // 5. the events the app writes
  const lv = practice.domains
    .flatMap((sc: any) => sc.dialogues.map((d: any) => ({ sc, d })))
    .find((x: any) => (x.d.advance ?? "tap") === "tap" && !x.d.intro && x.d.introduces?.length);
  if (!lv) throw new Error("no tap level to play");
  const index = await (await fetch(`${base}/api/match/index`)).json();
  const entry = index.entries.find((e: any) => e.dialogueId === lv.d.id);
  const word = entry?.nodes.flatMap((n: any) => n.tokens).find((t: string) => t.length > 3 && /^[a-z]+$/.test(t) && !t.endsWith("s"));
  if (!word) throw new Error("no line word for the finder match");

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${base}/?c=TEST-01`);
  await page.waitForFunction(() => !document.getElementById("scene")!.hidden);
  await page.evaluate(() => document.getElementById("scene-quit")!.click());
  await page.waitForFunction(() => !document.getElementById("home")!.hidden);

  await page.locator('.tile[data-go="practice"]').click();
  await page.locator(".scenario-card").filter({ hasText: lv.sc.name }).first().click();
  await page.locator("#level-list .level-card").nth(lv.sc.dialogues.indexOf(lv.d)).click();
  const choice = page.locator("#dialogue-choices .choice-list .dialogue-choice").first();
  await choice.click();
  await page.waitForTimeout(300);
  await page.locator("#dialogue-restart").click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 60 && !(await page.locator("#dialogue-choices.is-terminal").count()); i++) {
    await choice.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  if (!(await page.locator("#dialogue-choices.is-terminal").count())) throw new Error("the level did not reach its end");
  await page.locator("#feedback-chip").click();
  await page.locator("#feedback-text").fill("wire note");
  await page.locator("#feedback-send").click();
  await page.waitForSelector("#feedback", { state: "hidden" });

  await page.locator("#dialogue-close").click();
  await page.waitForFunction(() => document.getElementById("dialogue")!.hidden);
  for (let i = 0; i < 4 && !(await page.locator("#finder-input").isVisible()); i++) {
    await page.evaluate(() => document.getElementById("back")!.click());
    await page.waitForTimeout(300);
  }
  await page.locator("#finder-input").pressSequentially(`${lv.sc.name} ${word}`, { delay: 20 });
  await page.waitForTimeout(1500);
  await page.locator("#finder-results .level-card").filter({ hasText: lv.d.title }).first().click();
  await page.waitForFunction(() => !document.getElementById("dialogue")!.hidden);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const NAMES = ["level_started", "level_restarted", "level_completed", "finder_match_opened", "feedback_submitted"];
  const written = () => rows().slice(seeded.length).map((l) => JSON.parse(l));
  for (let i = 0; i < 20 && !NAMES.every((n) => written().some((r) => r.name === n)); i++) await page.waitForTimeout(250);
  await browser.close();

  const mine = written();
  for (const n of NAMES) {
    // The first-run scene opens before the level is chosen and has no level number.
    const r = mine.filter((x) => x.name === n && x.props?.level !== null);
    check(`${n} is written with props.domainId ${lv.sc.id}`, r.length > 0 && r.every((x) => x.props?.domainId === lv.sc.id), JSON.stringify(r.map((x) => x.props)));
  }
  check("no line written after the seeded ones contains scenarioId", !rows().slice(seeded.length).some((l) => l.includes("scenarioId")));
} catch (err) {
  console.error(err);
  failed = true;
} finally {
  child.kill("SIGKILL");
}
console.log(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
