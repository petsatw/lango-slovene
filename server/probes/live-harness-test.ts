// harnessFor: a session plays the preamble plus its own `## @<id>` section; an unsectioned harness is whole.
import { harnessFor } from "../live/prompt";
let fail = 0;
const check = (name: string, ok: boolean) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}`); if (!ok) fail++; };
const H = "PRE\n\n## @x\nFREE\n\n## @x-l1 — Basic 1 · One\nONE\n\n## @x-l2 — Basic 2 · Two\nTWO\n";
check("unsectioned harness is whole", harnessFor("A\n## B\nC", "x-l1") === "A\n## B\nC");
check("scenario-id session gets the preamble + its own section", (() => { const s = harnessFor(H, "x"); return s.startsWith("PRE") && s.includes("FREE") && !s.includes("ONE"); })());
check("unknown id falls back to the preamble", harnessFor(H, "x-l9") === "PRE");
const l2 = harnessFor(H, "x-l2");
check("tree gets preamble + its own section", l2.startsWith("PRE") && l2.includes("TWO") && l2.includes("Basic 2 · Two"));
check("tree does not get other sections", !l2.includes("ONE") && !l2.includes("FREE"));
check("authoring comments are stripped", harnessFor("<!-- note\n## @x-l1 -->\n" + H, "x-l9") === "PRE");
process.exit(fail ? 1 : 0);
