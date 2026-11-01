// Acceptance check for domain titles: every manifest carries name + nameSl per
// docs/features/practice/spec.md §1, Practice cards show both (no lesson count), levels header shows the pair.
//   npx tsx server/probes/domain-titles-test.ts
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const TITLES: Record<string, [string, string | undefined]> = {
  bakery: ["Bakery", "Pekarna"],
  butcher: ["Butcher", "Mesnica"],
  cafe: ["Café", "Kavarna"],
  demo: ["Demo", undefined],
  lekarna: ["Pharmacy", "Lekarna"],
  library: ["Library", "Knjižnica"],
  restaurant: ["Restaurant", "Restavracija"],
  "slavko-intro": ["Meet Slavko", "Spoznaj Slavka"],
  sprehod: ["Walking the Dogs", "Sprehod s psoma"],
  trznica: ["Market", "Tržnica"],
  "upravna-enota": ["Administrative Unit", "Upravna enota"],
};

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

async function main() {
  for (const [id, [name, nameSl]] of Object.entries(TITLES)) {
    const m = JSON.parse(fs.readFileSync(`server/scenarios/${id}.json`, "utf8"));
    check(`manifest ${id}`, m.name === name && m.nameSl === nameSl, `${m.name} / ${m.nameSl}`);
  }

  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/learner`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }
  const api = await (await fetch(`${base}/api/practice`)).json();
  const byId = new Map<string, any>(api.scenarios.map((s: any) => [s.id, s]));

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.route("**/api/practice", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), started: true } });
  });
  await page.goto(base);
  await page.click('.tile[data-go="practice"]');
  await page.waitForSelector(".scenario-card");
  const cards = await page.$$eval(".scenario-card", (els) =>
    els.map((e) => ({
      name: e.querySelector(".scenario-name")?.textContent ?? "",
      sl: e.querySelector(".scenario-meta")?.textContent ?? "",
      text: (e.textContent ?? "").replace("›", ""),
      order: (e.querySelector(".scenario-name")!.compareDocumentPosition(e.querySelector(".scenario-meta")!) & 4) !== 0,
    })));
  check("cards rendered", cards.length === api.scenarios.length, `${cards.length}`);
  for (const [id, s] of byId) {
    const [name, nameSl] = TITLES[id];
    const c = cards.find((x) => x.name === name);
    check(`card ${id}`, !!c && c.sl === (nameSl ?? "") && c.order && !/lesson/i.test(c.text), c ? `${c.name} / ${c.sl}` : "missing");
    check(`api ${id}`, s.name === name && (s.nameSl ?? undefined) === nameSl);
  }

  for (const [id] of byId) {
    const [name, nameSl] = TITLES[id];
    await page.locator(".scenario-card").filter({ has: page.locator(".scenario-name", { hasText: new RegExp(`^${name}$`) }) }).first().click();
    const en = await page.textContent("#levels-title");
    const sl = await page.textContent("#levels-title-sl");
    check(`levels header ${id}`, en === name && sl === (nameSl ?? ""), `${en} / ${sl}`);
    await page.goto(base);
    await page.click('.tile[data-go="practice"]');
    await page.waitForSelector(".scenario-card");
  }
  await browser.close();
}

main()
  .catch((e) => { console.error(e); failed = true; })
  .finally(() => { child.kill("SIGKILL"); process.exit(failed ? 1 : 0); });
