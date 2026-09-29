// Live-mode crediting on plain inputs: the transcriber's hint list, the verdict rule over a grader
// reading, the lesson score, and what a learner model may take. No server, no vendor, no learner store.
//
//   npm run test:live-match

import { keytermsFor, variantsOf } from "../live/match";
import { creditable, readTarget, scoreLesson, type ChannelReading, type LiveGrade } from "../live/grader";
import { LEARNABLES } from "../learnables";
import type { Learnable } from "../learnables";
import type { LearnerModel } from "../types";

let failures = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}\n       expected ${e}\n       got      ${a}`);
  }
}

function target(id: string): Learnable {
  const l = LEARNABLES[id];
  if (!l) throw new Error(`no such learnable: ${id}`);
  return l;
}

const zivjo = target("zivjo");
const eno = target("eno_femacc");
const rad_bi = target("rad_bi");

console.log("\nsurfaces");
check("slot alternation splits", variantsOf("Rad / Rada bi ___."), ["Rad bi ___.", "Rada bi ___."]);

console.log("\nkeyterms");
const terms = keytermsFor([zivjo, eno, rad_bi]);
check("carries the literal runs and the mishearing", terms, [
  "Živjo",
  "zero",
  "Eno",
  "prosim",
  "Rad bi",
  "Rada bi",
]);
check("within the vendor's ceiling", terms.every((t) => t.length <= 50) && terms.length <= 100, true);

console.log("\nthe verdict rule (readTarget)");
{
  const ts = (role: "user" | "tutor", text: string) => ({ ts: "", role, text });
  const transcript = [
    ts("tutor", "Dober dan."),
    ts("user", "Kilo krompirja, prosim."),
    ts("tutor", "Prosim, kilo krompirja. Še kaj?"),
    ts("user", "Potatoes please"),
    ts("tutor", "Krompir? Kilo?"),
  ];
  const reading = (saidLine: number, over: Partial<{ uptake: boolean; correct: boolean; recast: boolean; saidLang: string }> = {}) =>
    ({ id: "krompir", saidLine, uptake: true, correct: true, recast: false, saidLang: "sl", ...over });

  check("an inflected form the grader cites and the tutor took up is a success",
    readTarget(transcript, reading(2)).verdict, "success");
  check("its span is the learner's own line", readTarget(transcript, reading(2)).said, "Kilo krompirja, prosim.");
  check("a recast is help, not a success", readTarget(transcript, reading(2, { recast: true })).verdict, "attempt");
  check("an incorrect form is an attempt", readTarget(transcript, reading(2, { correct: false })).verdict, "attempt");
  check("no uptake is an attempt", readTarget(transcript, reading(2, { uptake: false })).verdict, "attempt");
  check("an English line earns nothing", readTarget(transcript, reading(4, { saidLang: "en" })).verdict, "none");
  check("a cited tutor line earns nothing", readTarget(transcript, reading(3)).verdict, "none");
  check("a line that is not there earns nothing", readTarget(transcript, reading(9)).verdict, "none");
}

console.log("\nthe lesson score (scoreLesson)");
{
  const ch = (id: string, verdict: ChannelReading["verdict"], inLesson = true): ChannelReading =>
    ({ id, inLesson, uptake: true, saidLine: 1, correct: true, recast: false, said: "x", saidLang: "sl", verdict });
  const score = scoreLesson(
    [target("dober_dan"), target("imate_danes"), target("krompir"), target("ja")],
    [ch("dober_dan", "success"), ch("imate_danes", "success"), ch("ja", "attempt"), ch("hruska", "success", false)],
  );
  check("X of Y counts lesson successes only", [score.succeeded.length, score.total], [2, 4]);
  check("a learnable outside the lesson does not count toward it", score.succeeded.includes("hruska"), false);
  check("attempts are listed apart", score.attempted, ["ja"]);
}

console.log("\nwhat a learner model may take (creditable)");
{
  const mastered = { attempts: 6, successes: 5 };
  const model: LearnerModel = { learnables: { hruska: mastered, ja: mastered }, facts: {}, updatedAt: "" } as LearnerModel;
  const ev = (id: string, correct: boolean) => ({ id, produced: true, said: "x", saidLang: "sl", correct, confidence: 1 });
  const ch = (id: string, inLesson: boolean) =>
    ({ id, inLesson, uptake: true, saidLine: 1, correct: true, recast: false, said: "x", saidLang: "sl", verdict: "attempt" }) as ChannelReading;
  const grade = {
    evidence: { targets: [ev("hruska", false), ev("ja", false), ev("to_je_vse", true), ev("nasvidenje", false)] },
    channels: [ch("hruska", false), ch("ja", true), ch("to_je_vse", false), ch("nasvidenje", false)],
  } as unknown as LiveGrade;
  const kept = creditable(model, grade).targets.map((t) => t.id);
  check("a success outside the lesson is credited", kept.includes("to_je_vse"), true);
  check("an attempt outside the lesson at an unmastered item is credited", kept.includes("nasvidenje"), true);
  check("an attempt outside the lesson cannot lower a mastered item", kept.includes("hruska"), false);
  check("a lesson target's attempt still counts", kept.includes("ja"), true);
}

console.log(failures ? `\n❌ ${failures} failed\n` : "\n✅ all passed\n");
process.exit(failures ? 1 : 0);
