// Domain titles (docs/features/practice/spec.md §1–§3, #113): each manifest's name/nameSl matches the §1
// table, /api/practice carries nameSl, and the Practice cards and levels header show the English title on
// line 1 with the Slovene under it; a domain without nameSl (demo) shows the English title only.
//   npx tsx server/probes/domain-titles-test.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium, type Page } from "playwright";

// The §1 table is read from the spec itself, so the probe never restates the titles.
const spec = fs.readFileSync("docs/features/practice/spec.md", "utf8");
const section = (spec.split(/^## 1\. Domain titles$/m)[1] ?? "").split(/^## /m)[0] ?? "";
const TITLES = new Map<string, { name: string; nameSl: string | null }>();
for (const line of section.split("\n")) {
  const [, id, name, nameSl] = line.match(/^\| *([a-z][a-z-]*) *\|(.*)\|(.*)\|$/) ?? [];
  if (id) TITLES.set(id, { name: name!.trim(), nameSl: nameSl!.trim() || null });
}

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), TURNLOG: "0" },
  stdio: "ignore",
});

let failed = false;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failed = true;
};

async function openPractice(page: Page) {
  await page.goto(base);
  await page.click('.tile[data-go="practice"]');
  await page.waitForSelector(".domain-card");
}

// Line 1 / line 2 of every card as the learner sees them (line 2 counts only when it is visible and below).
const readCards = (page: Page) => page.$$eval(".domain-card", (els) => els.map((e) => {
  const n = e.querySelector(".domain-name") as HTMLElement | null;
  const m = e.querySelector(".domain-meta") as HTMLElement | null;
  const shown = !!m && m.offsetHeight > 0 && !!n && m.getBoundingClientRect().top >= n.getBoundingClientRect().bottom - 1;
  return { line1: n?.textContent ?? "", line2: shown ? m!.textContent ?? "" : null, text: (e.textContent ?? "").replace("›", "") };
}));

async function readHeader(page: Page, name: string) {
  const card = page.locator(".domain-card", { has: page.locator(".domain-name", { hasText: new RegExp(`^${name}$`) }) });
  if (!(await card.count())) return { line1: "no card", line2: null };
  await card.click();
  await page.waitForSelector("#levels:not([hidden])");
  return page.evaluate(() => {
    const t = document.getElementById("levels-title")!;
    const s = document.getElementById("levels-title-sl");
    const shown = !!s && s.offsetHeight > 0 && s.getBoundingClientRect().top >= t.getBoundingClientRect().bottom - 1;
    return { line1: t.textContent, line2: shown ? s!.textContent : null };
  });
}

async function main() {
  const off: string[] = [];
  for (const [id, want] of TITLES) {
    const m = JSON.parse(fs.readFileSync(`server/domains/${id}.json`, "utf8"));
    if (m.name !== want.name || (m.nameSl ?? null) !== want.nameSl) off.push(`${id}: ${m.name} / ${m.nameSl}`);
  }
  check(`manifests match the spec §1 table (${TITLES.size} domains)`, TITLES.size > 0 && off.length === 0, off.join("; "));

  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/learner`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  const api: any[] = (await (await fetch(`${base}/api/practice`)).json()).domains;
  const apiOff = api.filter((s) => s.nameSl !== (TITLES.get(s.id)?.nameSl ?? null)).map((s) => `${s.id}: ${s.nameSl}`);
  check("GET /api/practice carries nameSl", api.some((s) => s.nameSl) && apiOff.length === 0, apiOff.join("; "));

  const withSl = api.filter((s) => TITLES.get(s.id)?.nameSl);
  const without = api.find((s) => TITLES.has(s.id) && !TITLES.get(s.id)!.nameSl);

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route("**/api/practice", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), started: true } });
  });
  await openPractice(page);
  const cards = await readCards(page);
  const cardOff = withSl.filter((s) => {
    const c = cards.find((x) => x.line1 === s.name);
    return !c || c.line2 !== TITLES.get(s.id)!.nameSl || /lesson/i.test(c.text);
  }).map((s) => s.id);
  check(`cards show the Slovene title on line 2, no lesson count (${withSl.length} cards)`, withSl.length > 0 && cardOff.length === 0, cardOff.join(", "));

  const sprehod = TITLES.get("sprehod")!;
  const h = await readHeader(page, sprehod.name);
  check("levels header shows the pair (sprehod)", h.line1 === sprehod.name && h.line2 === sprehod.nameSl, `${h.line1} / ${h.line2}`);

  if (!without) check("a domain without nameSl is listed", false, "none in /api/practice");
  else {
    await openPractice(page);
    const c = (await readCards(page)).find((x) => x.line1 === without.name);
    const hd = await readHeader(page, without.name);
    check(`no nameSl (${without.id}): card and header show the English title only`,
      !!c && c.line2 === null && !/lesson/i.test(c.text) && hd.line1 === without.name && hd.line2 === null,
      `card ${c ? `${c.line1} / ${c.line2}` : "missing"}; header ${hd.line1} / ${hd.line2}`);
  }
  await browser.close();
}

main()
  .catch((e) => { console.error(e); failed = true; })
  .finally(() => { child.kill("SIGKILL"); process.exit(failed ? 1 : 0); });
