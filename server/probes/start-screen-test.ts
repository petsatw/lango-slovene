// Acceptance check for the tutor start screen: consent copy, mutually exclusive boxes, /privacy, and the
// live create body's noSave / improve fields.
//   npx tsx server/probes/start-screen-test.ts
import { spawn } from "node:child_process";
import { chromium } from "playwright";

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

const COPY = [
  "Your voice goes live to Google or xAI so the tutor can answer. Audio is never stored.",
  'Conversations are saved to your history, unless you choose "Don\'t save this session" to opt out. Delete conversations anytime in Settings.',
  "What you share is covered by Google's and xAI's privacy policies.",
];

async function main() {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${base}/api/learner`)).ok) break; } catch {}
    if (i > 120) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 500));
  }

  const priv = await fetch(`${base}/privacy`);
  check("GET /privacy returns 200", priv.status === 200, String(priv.status));

  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage(); // fresh profile
  const bodies: any[] = [];
  await page.route("**/v1/live/sessions", async (route) => {
    bodies.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"probe"}' });
  });
  // A fresh learner opens on the first-meeting scene; report them as started so the shell shows.
  await page.route("**/api/practice", async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), started: true } });
  });
  await page.addInitScript(() => localStorage.setItem("liveAccessCode", "probe"));
  await page.goto(`${base}/?lesson=probe-lesson`);

  const enter = async () => {
    await page.click('.tile[data-go="tutor"]');
    await page.waitForSelector("#consent:not([hidden])");
  };
  const start = async () => {
    const before = bodies.length;
    await page.click("#consent-continue");
    await page.click("#practice-talk");
    for (let i = 0; i < 40 && bodies.length === before; i++) await page.waitForTimeout(100);
    return bodies[bodies.length - 1];
  };
  const state = (id: string) => page.evaluate((i) => {
    const e = document.getElementById(i) as HTMLInputElement;
    return { checked: e.checked, disabled: e.disabled };
  }, id);
  const leave = async () => { await page.click("#back"); };

  // 1. First entry.
  await enter();
  const text = (await page.innerText("#consent")).replace(/\s+/g, " ");
  check("consent copy verbatim", COPY.every((c) => text.includes(c)));
  const links = await page.$$eval("#consent a", (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
  check("links to Google, xAI and /privacy", ["https://policies.google.com/privacy", "https://x.ai/legal/privacy-policy", "/privacy"].every((h) => links.includes(h)), links.join(" "));
  const ns = await state("start-nosave");
  const im = await state("start-improve");
  check("both boxes unticked", !ns.checked && !im.checked);
  check("Start enabled with no box ticked", await page.isEnabled("#consent-continue"));

  // 2. Start with neither box ticked.
  let body = await start();
  check("create body carries neither noSave nor improve", body && !("noSave" in body) && !("improve" in body), JSON.stringify(body));

  // 3. Don't save.
  await leave(); await enter();
  check("next entry: both boxes unticked", !(await state("start-nosave")).checked && !(await state("start-improve")).checked);
  await page.check("#start-nosave");
  let s = await state("start-improve");
  check("ticking Don't save unticks and disables improve", !s.checked && s.disabled);
  await page.uncheck("#start-nosave");
  s = await state("start-improve");
  check("unticking Don't save enables improve", !s.disabled && !s.checked);
  await page.check("#start-nosave");
  body = await start();
  check("create body carries noSave: true", body?.noSave === true && !("improve" in body), JSON.stringify(body));

  // 4. Improve.
  await leave(); await enter();
  check("next entry: both boxes unticked", !(await state("start-nosave")).checked && !(await state("start-improve")).checked);
  await page.check("#start-improve");
  s = await state("start-nosave");
  check("ticking improve unticks and disables Don't save", !s.checked && s.disabled);
  await page.uncheck("#start-improve");
  s = await state("start-nosave");
  check("unticking improve enables Don't save", !s.disabled && !s.checked);
  await page.check("#start-improve");
  body = await start();
  check("create body carries improve: true", body?.improve === true && !("noSave" in body), JSON.stringify(body));

  // 5. Closing the start screen that the talk button opened leaves no live session pending.
  await page.click("#practice-talk");
  await page.waitForSelector("#consent:not([hidden])");
  await page.click("#consent-close");
  await enter();
  const n = bodies.length;
  await page.click("#consent-continue");
  await page.waitForTimeout(1000);
  check("Start after a closed start screen opens no live session", bodies.length === n);

  await browser.close();
}

main()
  .catch((e) => { console.log("FAIL ", e.message); failed = true; })
  .finally(() => {
    child.kill("SIGKILL");
    console.log(failed ? "FAIL" : "PASS");
    process.exit(failed ? 1 : 0);
  });
