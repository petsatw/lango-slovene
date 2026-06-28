// Pretty-print the most recent turns from the observability log (assets/turnlog/turns.jsonl).
// Usage:
//   npm run turnlog            # last 10 turns, compact
//   npm run turnlog -- 25      # last 25 turns
//   npm run turnlog -- --full  # include the full system prompt + history per turn
//
// Read-only. The verbatim + credited ids + post-credit counts are the point: they show exactly what
// the model heard, what it replied, and whether a verdict moved one earned item or bundled several.

import { existsSync, readFileSync } from "node:fs";
import { LOG_PATH } from "../assets/turnlog";

const args = process.argv.slice(2);
const full = args.includes("--full");
const n = Number(args.find((a) => /^\d+$/.test(a))) || 10;

if (!existsSync(LOG_PATH)) {
  console.log(`No turn log yet at ${LOG_PATH}\n(Run a turn — free chat, seed, or scenario — then re-run this.)`);
  process.exit(0);
}

const lines = readFileSync(LOG_PATH, "utf8").trim().split("\n").filter(Boolean);
const turns = lines.slice(-n).map((l) => JSON.parse(l));

console.log(`Turn log — last ${turns.length} of ${lines.length}  (${LOG_PATH})\n`);

for (const t of turns) {
  const tag =
    t.path === "free" ? `free L${t.level ?? "?"}` : t.path === "seed" ? `seed:${t.seedId}` : `scenario:${t.scenarioId}`;
  const audio = t.audio ? `  audio ${t.audio.bytes}B ${t.audio.file}` : "";
  console.log(`── ${t.ts}  [${tag}]  ${t.provider}${t.model ? "/" + t.model : ""}  ${t.e2Ms}ms${audio}`);

  const o = t.output ?? {};
  console.log(`   heard   : "${o.userVerbatim ?? ""}"  (${o.userSaid ?? ""})`);
  console.log(`   reply   : "${o.tutorReply ?? ""}"`);
  if (o.correction) console.log(`   recast  : ${o.correction}`);

  const prog: { id: string; result: string }[] = o.learnableProgress ?? [];
  if (prog.length) {
    const parts = prog.map((p) => {
      const c = t.creditedCounts?.[p.id];
      const mark = p.result === "success" ? "✓" : "·";
      return `${mark} ${p.id}=${p.result}${c ? ` (${c.successes}/5)` : ""}`;
    });
    console.log(`   credit  : ${parts.join("   ")}`);
  } else {
    console.log(`   credit  : (none)`);
  }

  // Free-conversation witness evidence: what the model reported per target + off-target captures.
  if (t.witness) {
    const w = t.witness;
    const ev = (w.targets ?? [])
      .map((g: any) => {
        const mark = g.produced ? (g.correct && g.saidLang === "sl" ? "✓" : "~") : "·";
        const said = g.produced ? ` "${g.said ?? ""}"·${g.saidLang ?? "?"}` : "";
        return `${mark} ${g.id}${said}`;
      })
      .join("   ");
    console.log(`   lang    : ${w.utteranceLang || "?"}`);
    console.log(`   evidence: ${ev || "(no targets)"}`);
    if (w.observed?.length) {
      console.log(`   observed: ${w.observed.map((x: any) => `${x.surface} (${x.gloss})`).join(", ")}`);
    }
    if (w.candidates?.length) {
      console.log(`   NEW?    : ${w.candidates.map((x: any) => `${x.surface} (${x.gloss})`).join(", ")}`);
    }
  }

  if (full) {
    console.log(`   --- system prompt ---\n${indent(t.input?.systemPrompt ?? "")}`);
    const hist: { role: string; text: string }[] = t.input?.history ?? [];
    if (hist.length) console.log(`   --- history (${hist.length}) ---\n${indent(hist.map((h) => `${h.role}: ${h.text}`).join("\n"))}`);
  }
  console.log("");
}

function indent(s: string): string {
  return s
    .split("\n")
    .map((l) => "     " + l)
    .join("\n");
}
