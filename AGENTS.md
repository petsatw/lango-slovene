# AGENTS.md

Guidance for any agent or developer working in this repo. Tool-neutral and canonical —
`CLAUDE.md` and `GEMINI.md` point here. Keep it short; link the docs rather than restating them.

## Core Behaviors

Behavioral guidelines to reduce common LLM coding mistakes. Merge with the project-specific
instructions below as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### 5. Actively Test Your Claims with Decisive, Specific, Repeatable Evidence

**State what you observed, not what is universally true. Absolute claims about behavior are non-falsifiable and seed wrong beliefs.**

When diagnosing a problem or analyzing a behavior:
- **Mark each claim's confidence:** observed/tested, inferred, or read in code/docs — say which.
- **Avoid "always / never / every / entirely / cannot."** You saw conditions true today, in the cases you ran. Prefer "in the case observed," "in the code path read," "so far," or past tense for a specific incident.
- **Assert only what could be falsified.** "X never happens" can't be tested; "X didn't happen in the N runs observed" can. If you can't say what would disprove it, rewrite it.
- **To generalize into a rule, say so and name the evidence** — don't pass a hypothesis off as fact.
- **Test the live system over reasoning from static artifacts.** When you can exec into it, ask it, or probe it, do that and report the result.

### 6. Write What Is

**Comments and docs describe the present. Git holds the history.**

- **No histories.** "This used to be X", "the old behaviour", "that gate was removed", "(decided
  2026-08-23)" — all of it belongs in the commit message, `docs/research/`, or a handoff brief. A file
  that narrates its own changes forces every future reader to reconstruct the present out of a story.
- **No negative ontologies.** Define a thing by what it is, not by what it isn't or what it replaced.
  "Core is the learnable's `core: true` flag" — not "core is no longer read from the a1-map".
- **Warding off a tempting alternative gets one clause, not a paragraph.** "Length is not a band input —
  it measures amount, not difficulty." Enough to stop a plausible revert; not a retrospective.
- Applies to code comments, `docs/`, and skill files alike. `docs/research/` is exempt: it is a record of
  what was thought and when, and a superseded document there should say so at the top.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Testing conventions — low abstraction, high fidelity

**Principle:** *Test against reality at the highest fidelity the local infra supports, with the least test code — and assert the outcome the user intended, not the implementation.* The local stack mirrors cloud, so a test that exercises the **real client against the real (local) stack** is genuine evidence the feature works in production — because only the connection env differs between local and cloud. That single fact is what makes a test both high-fidelity *and* cleanly cloud-migrating.

**Decision tree — what kind of test for what:**

1. **Deterministic pure logic** (parsing, validation, clustering, payload shaping, formatting) → **extract a pure function, unit-test with plain inputs.** No client, no I/O, no mock. Highest fidelity for logic, zero infra. *(pure-function extraction pattern.)*
2. **DB / external effect** (insert/update/delete/select, RPC, embeddings) → **integration-test against the local stack with the real client**: seed a real row → invoke handler → assert the real resulting state → clean up. Cloud-portable by construction. *(seed → invoke → assert → clean up pattern.)*
3. **Never hand-roll a typed mock of the client's fluent chain.** Low-fidelity (verifies your fake, not the real system), high-maintenance (the literal "slave to test infra" trap), migrates nothing. *(The anti-pattern that churns test runs without adding fidelity.)*
4. **Source-text assertions** (grep a module for a substring) → allowed **only** as cheap contract guards for things with no runtime behavior to exercise ("tool is registered", "auth check still present"). Never the primary behavioral test.

**Cross-cutting rules:**
- **Assert outcomes, not call logs.** "the row's completion field is null and the envelope names the id" — not "stub.update called once." Outcome assertions hit user intent and survive refactors; call-sequence assertions force mocks and couple to implementation.
- **Read connection from env, never hardcode.** Read the connection URL from an env var; the prod var's shape is the migration target. Hardcoding `127.0.0.1` breaks cloud migration *and* the containerized test lane.
- **Helpers stay tiny and local** (`liveClient`/`insertRow`/`countRows` ≈ 15 lines, in the test file). That's the ceiling of acceptable test infra — no framework, no shared mock library. If the scaffolding exceeds the code under test, the design is wrong.
- **Derive tests from the spec's invariants/contract**, so "green" means "meets the stated intent," not "exercises the code that happens to exist."

## What this is

**Govori** — an AI voice tutor for everyday Ljubljana Slovene. Mobile-first PWA + Node server. A
learner speaks (mixed English/Slovene is fine); the server understands, replies in native Slovene,
and corrects by recast. Scenarios are **generated by an engine**, not hand-written.

**The format is primarily audio.** The purpose of this app is listening to and speaking Slovene.
There are visual elements — captions, images — and they matter, but they are secondary to that.
Assume the learner is listening, not watching.

Start at **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the keystone: what it is, what you can do
with it, why it's shaped this way, and a map to every other doc. Then, as needed:
[FILE-MAP.md](docs/FILE-MAP.md) (where things live) · [DATA-MODEL.md](docs/DATA-MODEL.md) (HTTP API +
data shapes) · [ROADMAP.md](docs/ROADMAP.md) (direction).

The one invariant to respect everywhere: **the app owns the pedagogy, not the model** — deterministic
`pending → recast → completed` rules live in the server, and the prompt is rebuilt from objective state
each turn. Don't move teaching decisions into the model.

## How the lessons teach

These are the guiding principles for the lesson surface, and they bind hardest on the **early lessons**,
where the learner has never heard the language before. Design, authoring and review all answer to them.

1. **Every phrase they say has been spoken to them moments earlier, in exactly the form they need it.**
   Heard in a sentence, heard on its own, heard slowly, then said.
2. **Each phrase comes back on a thinning schedule** — often while it's new, now and then once it's
   theirs — and it comes back because it's useful in a new moment, not recited in a list.
3. **One new sentence-shape a lesson — new words to drop into a shape they already own are free**, and
   playing with those swaps is how they learn the shape is theirs. *Govorim slovensko / angleško / dobro
   angleško / ne dobro slovensko* is one shape, not four phrases. Difficulty grows by doing something new
   with what they own: **echo → answer → interrupt → ask**.
4. **The learner's own voice is the main event.** Most of a session is them talking.
5. **However they respond, it goes well.** Nail it, hesitate, or skip it entirely — the conversation
   carries on warmly and they end up in the same place.
6. **They feel the progress themselves.** A line that was noise last week makes sense today. The
   character changes what he's doing because of something they said.
7. **Help is one tap away and arrives like a friend handing it over.**
8. **The moment is obvious** — whose turn it is, what to say — **and the character talks like a person**,
   so it stays a conversation rather than an exercise.

Principle 1 is the hard one: asking a beginner to produce a form they have not heard — including a form
that differs from the modelled one by person, case, number or tense — fails immediately. It is checkable,
and it should be checked.

### Lesson shape — guidelines, not budgets

A **node** is one NPC interaction with the learner; a **turn** is a learner response. One node is one
caption — one thing on screen. A slow re-speak (`slowSL`) is not a second node, and neither is the target
phrase said a second time on the same node — once inside a sentence, then again on its own. Both ride the
node they belong to, and neither counts toward length or the split.

**Length** is the total count of both — turns plus nodes. **The split** between them shifts with level, so
the node count *falls* as a lesson advances: the character says less and hands over more often.

Only **substantive** nodes count toward the split — the ones carrying new information or prompting
something different. A node that re-says a phrase slowly, confirms, praises, or nudges the learner onward
is real and playable, but it isn't part of the ratio. In a real conversation one person holds the floor
for several turns while the other just keeps them going.

| level | total | split (turns : nodes) | → turns | → nodes |
|---|---|---|---|---|
| beginner | 9–18 | ~40 : 60 | 4–7 | 5–11 |
| intermediate | 9–27 | ~60 : 40 | 5–16 | 4–11 |
| advanced | 18–27 | ~80 : 20 | 14–22 | 4–5 |

**Guidelines, not requirements.** Where in a band a lesson lands follows from how much play the new shape
offers, never from a length target. By advanced the learner is producing most of the lesson while the
character mostly confirms and hands back.

The reasons to repeat and improvise, and the tests a new one must pass, are in create-dialogue stage 0.

## Run & verify

```bash
npm run fetch:assets   # download prebuilt scene images + audio so ready-made scenarios work (free)
npm run dev            # http://localhost:8787 — hold the button, speak, release
npm run probe:e2       # understand+tutor adapter reachable
npm run probe:e3       # voice adapter returns real audio
npm run replay         # recorded clips → full pipeline → audio
npm run test:mastery   # the deterministic mastery-loop rules
```

**Testing philosophy:** test the seams with real services, observe the pipeline live, never mock the
heart. The probes and replay exist to exercise the real integration. (Full command list:
[FILE-MAP.md](docs/FILE-MAP.md).)

## The scenario engine — the working agreement

New scenarios are authored by the **create-scenario** procedure: author the Slovene → run
`npm run lint:scenario` (must exit 0) → an **independent** critic signs off → `npm run build:assets`
materializes audio + images. Procedure: the create-scenario skill
([.claude/skills/create-scenario/](.claude/skills/create-scenario/SKILL.md)).
Rubric every scenario must pass: [docs/scenario-authoring.md](docs/scenario-authoring.md).

**Do not bypass these:**
- **Never freehand a scenario.** Hand-written single-pass scenarios failed (ambiguous flashcards,
  textbook Slovene). The engine and its gates exist to prevent that.
- **Lint before the critic.** Deterministic checks first, fuzzy judgment second.
- **Keep judgment / logic / generation separate** — the orchestrator decides and specifies; code
  assembles prompts and calls generators; the author and critic never write files or call generators.

Today this runs as a Claude Code skill (`.claude/skills/create-scenario`), but the procedure above is
tool-neutral: any agent (Gemini, Codex, …) or a careful human can follow the same steps with the same
scripts and gates. Making that fully first-class for other tools is [roadmap](docs/ROADMAP.md) item 7.

## Conventions

- **Secrets in `.env` only** — never the shell, commits, or chat. See [docs/SECRETS.md](docs/SECRETS.md).
- Model ids and the Slovenian voice id are env-configurable; verify against current provider docs.
- `.scratch/`, `.consensus-runs/`, `/assets/`, and `*.local.json` settings are local-only (gitignored).
- **Never generate images or audio unless the operator explicitly asks.** Propagation is
  **decision-gated** — when a source asset changes, list the affected dependents and let the operator
  choose what to re-render; re-key unchanged pictures rather than regenerating. Mechanics:
  [docs/asset-pipeline.md](docs/asset-pipeline.md).
