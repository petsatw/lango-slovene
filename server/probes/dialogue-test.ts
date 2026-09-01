// Dialogue-loader tests — the schema + referential-integrity rules for rehearsal dialogues, focused on
// the `introduces` link that ties a level to catalog learnables (roadmap 12a). Real files, real
// validator, no mocks: the three shipped bakery levels must validate, and a bad `introduces` id must be
// rejected — that rejection is what guarantees "what this dialogue introduces" is always a real set.
// Run: `npm run test:dialogue`.

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateDialogue, resolveNode, nodeForms } from "../dialogues";
import { advanceDialogue, advanceModeOf } from "../adapters/dialogue-scripted";
import { LEARNABLES } from "../learnables";

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) console.log(`  ✅ ${name}`);
  else {
    failures++;
    console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(__dirname, "..", "dialogues");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();
const load = (f: string) => JSON.parse(readFileSync(path.join(DIR, f), "utf8"));

console.log("dialogue loader — introduces link:");
{
  // Every shipped dialogue validates, carries an `introduces` array, and every id resolves in the catalog.
  for (const f of files) {
    const raw = load(f);
    let d: any;
    try {
      d = validateDialogue(f, raw);
    } catch (err: any) {
      check(`${f} validates`, false, err?.message);
      continue;
    }
    check(`${f} validates`, true);
    check(`${f} has an introduces array`, Array.isArray(d.introduces));
    check(`${f} introduces only real catalog ids`, d.introduces.every((id: string) => !!LEARNABLES[id]),
      d.introduces.filter((id: string) => !LEARNABLES[id]).join());
  }

  // Negative: an unknown introduces id is rejected (referential integrity — no dangling "introduced" set).
  const base = load(files[0]!);
  let threw = false;
  try {
    validateDialogue("bad.json", { ...base, introduces: ["definitely_not_a_learnable"] });
  } catch {
    threw = true;
  }
  check("unknown introduces id is rejected by the loader", threw);

  // Negative: a non-array introduces is rejected.
  threw = false;
  try {
    validateDialogue("bad.json", { ...base, introduces: "kruh" });
  } catch {
    threw = true;
  }
  check("non-array introduces is rejected", threw);
}

// A minimal two-choice tree, valid against the real loader — the fixture for the schema + adapter checks
// below. Real catalog ids and a real voice profile, so nothing here is mocked.
const tree = (): any => ({
  id: "fixture-l1",
  scenarioId: "fixture",
  level: 1,
  levelLabel: "Survival",
  title: "fixture",
  objectives: [{ label: "o", descriptorEN: "d" }],
  introduces: ["dober_dan"],
  audio: "pending",
  voices: { npc: "slavko", client: "slavko" },
  root: "n1",
  nodes: {
    n1: { speaker: "npc", sl: "Živjo.", en: "Hi.", next: ["c1", "c2"] },
    c1: { speaker: "client", sl: "Dober dan.", en: "Good day.", learnables: ["dober_dan"], next: ["n2"] },
    c2: { speaker: "client", sl: "Zdravo.", en: "Hello.", learnables: ["zdravo"], next: ["n2"] },
    n2: { speaker: "npc", sl: "Adijo.", en: "Bye.", next: [] },
  },
});
const rejects = (label: string, mutate: (t: any) => void) => {
  const t = tree();
  mutate(t);
  let threw = false;
  try { validateDialogue("fixture.json", t); } catch { threw = true; }
  check(label, threw);
};

console.log("\nscene fields — slowSL / per-node learnables / advance:");
{
  check("the fixture itself validates", (() => { try { validateDialogue("fixture.json", tree()); return true; } catch { return false; } })());

  // slowSL is a SECOND clip keyed on its own text; identical text would collapse the two into one.
  rejects("slowSL identical to sl is rejected", (t) => { t.nodes.n1.slowSL = t.nodes.n1.sl; });
  check("a distinct slowSL is accepted", (() => {
    const t = tree(); t.nodes.n1.slowSL = "Živjo … prijatelj.";
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());

  // Per-node learnables: what the line is MADE OF, on any node, catalog-resolved. An npc line carries them
  // so the per-line band can count it; crediting stays client-only (asserted below).
  check("learnables on an npc node is accepted (what the line is made of)", (() => {
    const t = tree(); t.nodes.n1.learnables = ["dober_dan"];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());
  rejects("an unknown learnable id is rejected", (t) => { t.nodes.c1.learnables = ["definitely_not_a_learnable"]; });
  rejects("an unknown learnable id on an npc node is rejected too", (t) => { t.nodes.n1.learnables = ["definitely_not_a_learnable"]; });
  // …and MAY be empty: the bare-name beat is a real production that exercises no catalog item.
  check("an EMPTY learnables array is accepted (a non-Slovene beat like saying your own name)", (() => {
    const t = tree(); t.nodes.c1.learnables = [];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());

  rejects("an unknown advance mode is rejected", (t) => { t.advance = "shout"; });

  // Beat pacing: the silent hold, when the gloss arrives, and the quiet-learner ladder.
  check("captionDelayMs + glossPolicy + stallHandlers validate together", (() => {
    const t = tree();
    t.nodes.n1.captionDelayMs = 4000;
    t.nodes.n1.glossPolicy = "after";
    t.nodes.n1.slowSL = "Živjo … prijatelj.";
    t.nodes.n1.stallHandlers = [
      { afterMs: 15500, kind: "pulse" },
      { afterMs: 18000, kind: "respeak" },
      { afterMs: 22000, kind: "soften", label: "Whisper it if you like." },
    ];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());
  rejects("a negative captionDelayMs is rejected", (t) => { t.nodes.n1.captionDelayMs = -1; });
  rejects("an unknown glossPolicy is rejected", (t) => { t.nodes.n1.glossPolicy = "shout"; });
  rejects("stallHandlers on a client node is rejected", (t) => {
    t.nodes.c1.stallHandlers = [{ afterMs: 15000, kind: "pulse" }];
  });
  rejects("a stall ladder that fails to escalate is rejected", (t) => {
    t.nodes.n1.stallHandlers = [{ afterMs: 18000, kind: "pulse" }, { afterMs: 15000, kind: "pulse" }];
  });
  // The ladder must never answer a stuck learner with more of the language they do not have.
  rejects("an unknown stall kind is rejected", (t) => {
    t.nodes.n1.stallHandlers = [{ afterMs: 15000, kind: "nag", sl: "Ja?" }];
  });
  rejects("a soften rung without its English label is rejected", (t) => {
    t.nodes.n1.stallHandlers = [{ afterMs: 15000, kind: "soften" }];
  });
  rejects("a respeak rung with nothing to re-speak is rejected", (t) => {
    t.nodes.n1.stallHandlers = [{ afterMs: 15000, kind: "respeak" }];
  });

  // The English on-ramp that earns the right to withhold English later.
  check("frameEN validates", (() => {
    const t = tree(); t.frameEN = ["You're in Ljubljana.", "Just listen."];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());
  rejects("an empty frameEN is rejected", (t) => { t.frameEN = []; });
  check("advance defaults to tap when absent", advanceModeOf(validateDialogue("fixture.json", tree())) === "tap");
}

console.log("\nlearner facts — the choice beat and the varying line:");
{
  // A spoken lesson that asks the learner one thing about themselves and then says their word back to
  // them. `n1` asks, `c1` is their answer said each way, `n2` is the character echoing it — the one line
  // here that costs a second recording.
  const asking = (): any => ({
    ...tree(),
    advance: "audio",
    root: "n1",
    nodes: {
      n1: { speaker: "npc", sl: "Kaj si ti?", en: "Which are you?", choice: { fact: "gender" }, next: ["c1"] },
      c1: {
        speaker: "client", sl: "Sem študent.", en: "I'm a student.", learnables: ["dober_dan"],
        variesBy: "gender", variants: { f: { sl: "Sem študentka.", en: "I'm a student." } },
        next: ["n2"],
      },
      n2: {
        speaker: "npc", sl: "Ti si študent.", en: "You are a student.",
        variesBy: "gender", variants: { f: { sl: "Ti si študentka." } },
        next: [],
      },
    },
  });
  const rejectsAsking = (label: string, mutate: (t: any) => void) => {
    const t = asking();
    mutate(t);
    let threw = false;
    try { validateDialogue("fixture.json", t); } catch { threw = true; }
    check(label, threw);
  };

  check("a lesson that asks for a fact validates", (() => {
    try { return !!validateDialogue("fixture.json", asking()); } catch (e: any) { return false; }
  })());

  // The fact is a catalog entry with a closed set of answers — both the question and the variants are
  // checked against it, so a lesson can never offer or store something nothing declared.
  rejectsAsking("a choice naming an unknown fact is rejected", (t) => { t.nodes.n1.choice = { fact: "favourite_colour" }; });
  rejectsAsking("a variant answering outside the fact's values is rejected", (t) => { t.nodes.c1.variants.x = { sl: "Sem nekaj." }; });
  rejectsAsking("variants without a variesBy are rejected", (t) => { delete t.nodes.c1.variesBy; });
  rejectsAsking("a variesBy with no variants is rejected", (t) => { delete t.nodes.c1.variants; });
  // A variant is the same beat said differently — its turn and its catalog tags belong to the beat.
  rejectsAsking("a variant overriding the beat's structure is rejected", (t) => { t.nodes.c1.variants.f.next = ["n2"]; });
  rejectsAsking("a variant overriding the beat's learnables is rejected", (t) => { t.nodes.c1.variants.f.learnables = ["zdravo"]; });

  // The question and its answers are one authored thing: the buttons ARE the client line, said each way.
  rejectsAsking("a choice on a client node is rejected", (t) => { t.nodes.c1.choice = { fact: "gender" }; });
  rejectsAsking("a choice whose client line does not vary on that fact is rejected", (t) => {
    delete t.nodes.c1.variesBy; delete t.nodes.c1.variants;
  });
  rejectsAsking("a choice whose answers put the same line on every button is rejected", (t) => {
    t.nodes.c1.variants.f.sl = "Sem študent.";
  });

  // The text invariants are per FORM: a variant with a different surface needs its own focusSpan, and its
  // own slow line, exactly as the base does.
  // "Sem študent" sits inside "Sem študentka." and would pass the occurs-once test while marking two
  // thirds of a word, so an inherited span is refused rather than measured.
  rejectsAsking("a variant that rewrites the line and inherits the base's focusSpan is rejected", (t) => {
    t.nodes.c1.focusSpan = "Sem študent";
  });
  check("a variant that rewrites the line and states its own focusSpan is accepted", (() => {
    const t = asking();
    t.nodes.c1.focusSpan = "Sem študent";
    t.nodes.c1.variants.f.focusSpan = "Sem študentka";
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());
  rejectsAsking("a focusSpan absent from the variant's line is rejected", (t) => {
    t.nodes.c1.focusSpan = "Sem študent";
    t.nodes.c1.variants.f.focusSpan = "Sem učitelj";
  });
  rejectsAsking("a variant whose slow line equals its own line is rejected", (t) => {
    t.nodes.n2.slowSL = "Ti si … študent.";
    t.nodes.n2.variants.f.slowSL = "Ti si študentka.";
  });

  // The beat's own English: one line above the options, authored on the client node because it stands in
  // for that line's gloss while the learner picks between its forms.
  check("chooseEN on the client line is accepted", (() => {
    const t = asking(); t.nodes.c1.chooseEN = "Choose which one best suits you.";
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());
  rejectsAsking("chooseEN on an npc node is rejected", (t) => { t.nodes.n1.chooseEN = "Choose one."; });
  // `soften` relabels the single button, and a beat that asks has options instead — so a choice beat's
  // English is authored in one place, and it is the one that shows immediately.
  rejectsAsking("a soften rung on a beat that asks is rejected in favour of chooseEN", (t) => {
    t.nodes.n1.slowSL = "Kaj si … ti?";
    t.nodes.n1.stallHandlers = [{ kind: "soften", label: "Tap the one that is you." }];
  });
  check("pulse and respeak rungs are still accepted on a beat that asks", (() => {
    const t = asking();
    t.nodes.n1.slowSL = "Kaj si … ti?";
    t.nodes.n1.stallHandlers = [{ kind: "pulse" }, { kind: "respeak" }];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());

  rejectsAsking("a needs naming an unknown fact is rejected", (t) => { t.needs = ["favourite_colour"]; });
  check("a needs naming a declared fact is accepted", (() => {
    const t = asking(); t.needs = ["gender"];
    try { return !!validateDialogue("fixture.json", t); } catch { return false; }
  })());

  // Resolution: one function, used by the renderer, the prompt, the asset builder and the lints alike.
  const d = validateDialogue("fixture.json", asking());
  check("a known fact resolves the line to that answer's form",
    resolveNode(d.nodes.n2!, { gender: "f" }).sl === "Ti si študentka.");
  check("an answer with no variant of its own keeps the line as authored",
    resolveNode(d.nodes.n2!, { gender: "m" }).sl === "Ti si študent.");
  check("an unanswered fact keeps the line as authored",
    resolveNode(d.nodes.n2!, {}).sl === "Ti si študent.");
  check("a variant carries over everything it does not override",
    resolveNode(d.nodes.c1!, { gender: "f" }).learnables?.join() === "dober_dan");
  check("every form of a line is offered to the asset builder",
    nodeForms(d.nodes.n2!).map((f) => f.node.sl).join(" | ") === "Ti si študent. | Ti si študentka.");

  // Advancing: the answer is the learner's, so the beat refuses to move without it, and the step reports
  // it for the caller to store rather than storing anything itself.
  const step = advanceDialogue(d, "n1", { kind: "audio", answer: "f" });
  check("answering a choice beat advances the spine", step.clientNodeId === "c1" && step.npcNodeId === "n2");
  check("the answer is reported for the caller to store", step.fact?.id === "gender" && step.fact?.value === "f");
  check("a beat that asks nothing reports no fact", advanceDialogue(d, "n2", { kind: "audio" }).fact === null);
  let threw = false;
  try { advanceDialogue(d, "n1", { kind: "audio" }); } catch { threw = true; }
  check("a choice beat refuses to advance without an answer", threw);
}

console.log("\ndialogue adapter — tap vs spoken advance:");
{
  const tapped = validateDialogue("fixture.json", tree());
  const spoken = validateDialogue("fixture.json", { ...tree(), advance: "audio" });

  // Tap: the learner picks, and rehearsal credits NOTHING (the witness contract).
  const t1 = advanceDialogue(tapped, "n1", { kind: "tap", choice: "c2" });
  check("tap advances to the chosen client line", t1.clientNodeId === "c2" && t1.npcNodeId === "n2");
  check("tap credits nothing even on a node with learnables", t1.learnableProgress.length === 0);

  // Audio: the recording is never inspected — arrival advances the spine and plants ATTEMPTS.
  const a1 = advanceDialogue(spoken, "n1", { kind: "audio" });
  check("audio follows next[0] — the canonical spine", a1.clientNodeId === "c1");
  check("audio plants the beat's learnables as attempts", a1.learnableProgress.length === 1 && a1.learnableProgress[0]!.result === "attempt");
  check("audio never mints a mastery", a1.learnableProgress.every((p) => p.result === "attempt"));

  // Tagging an npc line describes it for the band; it must never become something the learner is
  // credited for merely HEARING. The npc tags here are dense on purpose — only c1's may be planted.
  const taggedNpc = validateDialogue("fixture.json", (() => {
    const t: any = { ...tree(), advance: "audio" };
    t.nodes.n1.learnables = ["hvala", "zdravo"];   // deliberately NOT c1's own tag
    t.nodes.n2.learnables = ["nasvidenje"];
    return t;
  })());
  const tn = advanceDialogue(taggedNpc, "n1", { kind: "audio" });
  check("a tagged npc line credits nothing — only the client beat's learnables are planted",
    JSON.stringify(tn.learnableProgress.map((p) => p.id)) === JSON.stringify(["dober_dan"]));

  // A beat with no learnables (the bare name) still advances — it just credits nothing.
  const bare = validateDialogue("fixture.json", (() => { const t: any = { ...tree(), advance: "audio" }; t.nodes.c1.learnables = []; return t; })());
  check("a zero-learnable beat advances and credits nothing", advanceDialogue(bare, "n1", { kind: "audio" }).learnableProgress.length === 0);

  const t2 = advanceDialogue(tapped, "n2", { kind: "tap", choice: "c1" });
  check("a terminal npc node ends the tree", t2.done && t2.npcNodeId === null && t2.clientNodeId === null);

  // A spoken beat the learner is not asked to answer: npc → npc. The character carries himself forward,
  // no turn is demanded and nothing is credited. Without this every line he speaks would need a turn.
  const passthrough = validateDialogue("fixture.json", (() => {
    const t: any = { ...tree(), advance: "audio" };
    t.nodes.nAside = { speaker: "npc", sl: "Aha!", en: "Aha!", next: ["c1"] };
    t.nodes.n1.next = ["nAside"];
    return t;
  })());
  const pt = advanceDialogue(passthrough, "n1", { kind: "audio" });
  check("audio may run npc → npc, demanding no turn", pt.npcNodeId === "nAside" && pt.clientNodeId === null && !pt.done);
  check("a pass-through beat credits nothing", pt.learnableProgress.length === 0);
  check("the spine resumes from a pass-through beat", advanceDialogue(passthrough, "nAside", { kind: "audio" }).clientNodeId === "c1");

  const throws = (label: string, fn: () => unknown) => {
    let threw = false;
    try { fn(); } catch { threw = true; }
    check(label, threw);
  };
  throws("a tap input into an audio-mode dialogue is refused", () => advanceDialogue(spoken, "n1", { kind: "tap", choice: "c1" }));
  throws("an audio input into a tap-mode dialogue is refused", () => advanceDialogue(tapped, "n1", { kind: "audio" }));
  throws("tapping a choice the node doesn't offer is refused", () => advanceDialogue(tapped, "n1", { kind: "tap", choice: "n2" }));
  throws("advancing from a client node is refused", () => advanceDialogue(tapped, "c1", { kind: "tap", choice: "n2" }));
}

if (failures) {
  console.log(`\n❌ ${failures} check(s) failed`);
  process.exit(1);
}
console.log("\n✅ all dialogue-loader checks passed");
process.exit(0);
