// The live-mode MATCHER, on plain inputs. Pure logic, so it is tested as pure logic: transcript lines
// and catalog surfaces in, a verdict out. No server, no vendor, no learner model.
//
//   npm run test:live-match

import { keytermsFor, matchTarget, normalise, segmentsOf, variantsOf } from "../live/match";
import { readTarget } from "../live/grader";
import { LEARNABLES } from "../learnables";
import type { Learnable } from "../learnables";

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
const dober_dan = target("dober_dan");
const eno = target("eno_femacc");
const rad_bi = target("rad_bi");
const ja = target("ja");

console.log("\nnormalisation");
check("diacritics fold", normalise("Živjo, Čaj!"), "zivjo caj");
check("punctuation goes", normalise("Dober dan."), "dober dan");
check("empty stays empty", normalise("!!!"), "");

console.log("\nsurfaces");
check("slot alternation splits", variantsOf("Rad / Rada bi ___."), ["Rad bi ___.", "Rada bi ___."]);
check("frame becomes word runs", segmentsOf("Eno ___, prosim."), ["eno", "prosim"]);
check("one-letter runs drop", segmentsOf("___, ker ___."), ["ker"]);

console.log("\nthe ASR channel");
check("exact", matchTarget("Živjo!", zivjo), { matched: true, via: "surface" });
check("inside a sentence", matchTarget("Ja, dober dan gospa.", dober_dan), {
  matched: true,
  via: "surface",
});
check("diacritics dropped by the vendor", matchTarget("Zivjo", zivjo), {
  matched: true,
  via: "surface",
});
// The session this whole design came out of: the learner said Živjo, the transcript read "Zero", and
// the tutor answered as though greeted.
check("a recorded mishearing", matchTarget("Zero.", zivjo), { matched: true, via: "alias" });
check("mangled but recognisable", matchTarget("Dobr dan", dober_dan), {
  matched: true,
  via: "fuzzy",
});
check("a frame with its slot filled", matchTarget("Eno kavo prosim", eno), {
  matched: true,
  via: "surface",
});
check("a frame out of order", matchTarget("Prosim eno", eno), { matched: false, via: null });
check("either side of an alternation", matchTarget("Rada bi kavo", rad_bi), {
  matched: true,
  via: "surface",
});
check("something else entirely", matchTarget("I'm Chris.", zivjo), { matched: false, via: null });
check("a short word is exact or nothing", matchTarget("Je.", ja), { matched: false, via: null });
check("silence", matchTarget("", dober_dan), { matched: false, via: null });

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

  // The matcher cannot see `krompir` in "krompirja"; the grader can, and the tutor served it.
  check("an inflected form the grader cites and the tutor took up is a success",
    readTarget(transcript, null, reading(2)).verdict, "success");
  check("its span is the learner's own line", readTarget(transcript, null, reading(2)).said, "Kilo krompirja, prosim.");
  check("a recast is help, not a success", readTarget(transcript, null, reading(2, { recast: true })).verdict, "attempt");
  check("an incorrect form is an attempt", readTarget(transcript, null, reading(2, { correct: false })).verdict, "attempt");
  check("no uptake is not a success", readTarget(transcript, null, reading(2, { uptake: false })).verdict, "none");
  check("an English line earns nothing", readTarget(transcript, null, reading(4, { saidLang: "en" })).verdict, "none");
  check("a cited tutor line earns nothing", readTarget(transcript, null, reading(3)).verdict, "none");
  check("the matcher alone still grants an attempt",
    readTarget(transcript, { line: 2, text: "Kilo krompirja, prosim." }, reading(0, { uptake: false, correct: false })).verdict, "attempt");
}

console.log(failures ? `\n❌ ${failures} failed\n` : "\n✅ all passed\n");
process.exit(failures ? 1 : 0);
