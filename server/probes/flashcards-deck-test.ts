// Acceptance check for the flashcard deck and its cache-only clip route (docs/features/flashcards/spec.md §5, §6).
//   npx tsx server/probes/flashcards-deck-test.ts
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// The public voice ids from docs/DEPLOY.md, so clip keys match the committed assets/audio/.
const VOICE_ENV: Record<string, string> = {
  E3_PROVIDER: "elevenlabs",
  ELEVENLABS_MODEL_ID: "eleven_v3",
  ELEVENLABS_VOICE_ID: "fSzEIez35vDdOs4DQwVh",
  ELEVENLABS_VOICE_ID_MALE: "Jcyy5bkqt86ud0xdZhfW",
  ELEVENLABS_VOICE_ID_SHOP_ASSISTANT: "MMDUS1hxcZnX8i9ZdqNf",
};
Object.assign(process.env, VOICE_ENV);
delete process.env.ELEVENLABS_API_KEY;
delete process.env.GEMINI_API_KEY;

const { deckFor } = await import("../flashcards");
const { DIALOGUES } = await import("../dialogues");
const { isSynthesized } = await import("../scripts/dialogue-lib");
const store = await import("../assets/store");
const { getE3 } = await import("../adapters/index");
const { CATALOG } = await import("../catalog");

const fail = (m: string): never => { throw new Error(m); };
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) fail(`${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// Temp ASSET_DIR: audio/ holds symlinks to every committed clip.
const committed = path.join(process.cwd(), "assets", "audio");
const assetDir = mkdtempSync(path.join(tmpdir(), "fc-assets-"));
mkdirSync(path.join(assetDir, "audio"));
for (const f of readdirSync(committed)) if (f.endsWith(".mp3")) symlinkSync(path.join(committed, f), path.join(assetDir, "audio", f));
const snapshot = () => readdirSync(path.join(assetDir, "audio")).sort();
const before = snapshot();

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["--import", "tsx", "server/server.ts"], {
  env: { ...process.env, PORT: String(port), DATA_DIR: mkdtempSync(path.join(tmpdir(), "fc-data-")), ASSET_DIR: assetDir, TESTER_CODES: "TEST-01" },
  stdio: "ignore",
});

async function up() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("server did not start");
}

const clip = (q: string, headers: Record<string, string> = {}) => fetch(`${base}/api/flashcards/audio?${q}`, { headers });
const expectMiss = async (name: string, q: string) => {
  const r = await clip(q);
  eq(`${name} status`, r.status, 404);
  eq(`${name} body`, await r.json(), { error: "no clip" });
};

try {
  // Deck.
  const sprehod = deckFor("sprehod") ?? fail("no sprehod deck");
  const first = sprehod[0] ?? fail("empty sprehod deck");
  eq("first card", { id: first.id, en: first.en, sl: first.sl }, { id: "ali_lahko", en: "can / may", sl: "Ali lahko ___? / Lahko ___." });
  const card = (id: string) => sprehod.find((c) => c.id === id) ?? fail(`no card ${id}`);
  eq("star_sem_let example", [card("star_sem_let").example?.sl, card("star_sem_let").example?.en], ["Star je pet mesecev.", "He's five months old."]);
  eq("skakati example", card("skakati").example?.sl, "Ne, še mladiček je. Skače.");
  eq("koliko example", deckFor("upravna-enota")?.find((c) => c.id === "koliko")?.example, null);
  const ime = card("ime_mi_je");
  eq("ime_mi_je en", ime.en, "my / your / his / her name is ___");
  eq("ime_mi_je note", ime.note, "the person is a dative pronoun ('Ime mu je Enzo.')");
  // The English side is only the phrase (#146).
  const bakery = deckFor("bakery") ?? fail("no bakery deck");
  const bk = (id: string) => bakery.find((c) => c.id === id)?.en;
  eq("bakery en", [bk("ali_or"), bk("razumem"), bk("dekagram"), bk("vzel_bom")], ["or", "to understand", "decagram", "I'll take ___."]);
  for (const d of Object.keys(DIALOGUES)) for (const c of deckFor(d) ?? []) {
    if (/[()]|[čšžČŠŽ]|(^|\s)'/.test(c.en)) fail(`${d} ${c.id}: en "${c.en}" carries a parenthetical or quoted Slovene`);
  }
  // A multi-word card takes only a form-matching example (#146).
  const prip = bakery.find((c) => c.id === "priporocate") ?? fail("no priporocate card");
  if (prip.example && /Priporočam/.test(prip.example.sl)) fail(`priporocate example is "${prip.example.sl}"`);
  // Every demo example is a line some synthesized node carries for that card (a spoken level's client lines are not).
  for (const c of deckFor("demo") ?? []) {
    if (!c.example) continue;
    const ok = (DIALOGUES["demo"] ?? []).some((d) =>
      Object.values(d.nodes).some((n) => n.sl === c.example!.sl && n.learnables?.includes(c.id) && isSynthesized(d, n)));
    if (!ok) fail(`demo ${c.id} example "${c.example.sl}" is only a spoken client line`);
  }

  // Server.
  await up();
  const star = card("star_sem_let").example!;
  const e3 = getE3();
  const profile = star.voice && CATALOG.voiceProfiles[star.voice] ? star.voice : undefined;
  const starKey = store.audioKey(e3.name, e3.voiceTagFor(profile), star.sl);
  const bytes = readFileSync(path.join(committed, `${starKey}.mp3`));

  const hit = await clip("domainId=sprehod&id=star_sem_let");
  eq("hit status", hit.status, 200);
  eq("hit type", hit.headers.get("content-type"), "audio/mpeg");
  if (!bytes.equals(Buffer.from(await hit.arrayBuffer()))) fail("hit bytes differ from the committed clip");
  const ranged = await clip("domainId=sprehod&id=star_sem_let", { Range: "bytes=0-99" });
  eq("range status", ranged.status, 206);
  eq("range length", (await ranged.arrayBuffer()).byteLength, 100);

  await expectMiss("koliko", "domainId=upravna-enota&id=koliko");
  await expectMiss("unknown domain", "domainId=nope&id=star_sem_let");
  await expectMiss("id outside domain", "domainId=sprehod&id=koliko");
  await expectMiss("extra params", "domainId=upravna-enota&id=koliko&text=Nova%20beseda&e3=gemini&voice=character");

  // Disk store only: warm the server's in-memory cache, drop the file, the route must miss.
  const warm = await fetch(`${base}/api/speak?text=${encodeURIComponent(star.sl)}&domainId=sprehod&voice=${encodeURIComponent(star.voice ?? "")}`);
  eq("speak warm status", warm.status, 200);
  eq("speak warm bytes", Buffer.from(await warm.arrayBuffer()).equals(bytes), true);
  rmSync(path.join(assetDir, "audio", `${starKey}.mp3`));
  await expectMiss("deleted clip", "domainId=sprehod&id=star_sem_let");

  // Nothing written.
  eq("audio dir", snapshot(), before.filter((f) => f !== `${starKey}.mp3`));
  if (existsSync(path.join(assetDir, "manifest.jsonl"))) fail("manifest.jsonl written");

  console.log("PASS");
  child.kill("SIGKILL");
  process.exit(0);
} catch (e: any) {
  console.log("FAIL", e.message);
  child.kill("SIGKILL");
  process.exit(1);
}
