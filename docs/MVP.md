# MVP — the core loop (rehearse → live → replay → A1)

**This is the assignment for the `mvp` branch.** The team has chosen a focused product from the larger
app. This doc defines what the MVP *is*, how it maps onto the existing ("legacy") architecture as a
**subset**, what diverges, and the order to build it. It is written so a fresh session can execute
**headlessly** — start at [Execution order](#execution-order) and work top-down, honoring the guardrails.

Legacy is preserved: the full app lives on `main` (and `feat/dialogue-intro-freechat-reinforce`). The
`mvp` branch is where we **disentangle** to a clean, simple product. **Do not delete legacy from `main`.**

---

## North star

**Crisp, simple, obvious.** The things a learner wants most are one tap away, never buried in a busy
mess. Every screen earns its place. When in doubt, cut. The "engine" stays invisible everywhere except
the A1 screen — no scores, streaks, or progress bars in the tutor or the rehearsal surfaces.

The learner's default journey is **linear** — *rehearse a scenario level → go live in free chat with that
scenario as context → (later) see A1 progress → repeat or advance* — but from anywhere they can jump
straight to any destination. (A future first-scenario onboarding will walk a new user through this loop;
not in the MVP.)

---

## The four learner destinations

A single home surface with four obvious choices. Priority = build order within the destinations.

### ① Practice scenarios — **HIGHEST PRIORITY (the dialogue display)**
- A **list of high-level scenarios** ("Restaurant", "Bakery"). Tap one →
- the scenario's **variants/levels shown crisply and obviously** (today: `1. Survival · 2. Basic A1 ·
  3. Full A1`). This variant selector is a **key design focus** — it must read at a glance, not as a row
  of ambiguous tabs. Tap a level →
- the **rehearsal decision-tree dialogue**: NPC line → 2 client-reply choices → branch → re-converge,
  tap-to-reveal English, pregenerated per-speaker audio, `↻ Start over`.
- Ends with **"Now try it for real →"** → hands into ② with this level's scenario context + introduced
  learnables (already built — the introduce→reinforce handoff).

### ② Live AI tutor — **SECOND PRIORITY (free chat, scenario-aware)**
- Tapping it goes **straight into the chat** (push-to-talk, Slovene in/out, invisible crediting).
- **Zero-state:** a learner with no attempted learnables is routed through the **seed/tutorial first**
  (teaches how to interact with the tutor). Otherwise the tutor opens on the learnables they most need to
  advance.
- **Scenario-aware when arrived from ①:** the tutor is told the originating dialogue/scenario and
  **adopts that role while remaining a tutor** — it plays the waiter/baker *and* still answers "how do you
  say…?" and helps the learner hit the level's objectives. Do **not** map bespoke voice ids to the role;
  just make the tutor *aware* of the scene and the objectives the learner is carrying in.
- The internal level ceiling (legacy "L1/L2") is **server-side only** — never a learner-visible knob.

### ③ Replays — **SECOND PRIORITY (repurposed from legacy replay)**
- After a free-chat session the learner can **go back and play back what the tutor said** (minimum:
  the tutor's spoken lines/audio per session; stretch: full transcript both sides + what was credited).
- This closes the current gap where free chat leaves no learner-visible history. Repurpose the legacy
  session-capture/replay machinery (`assets/sessions.ts` + the Past-runs player) to capture the
  **free-chat** path, which today writes no session.

### ④ A1 Readiness — **LOWEST PRIORITY (a mockup this cycle)**
- A **coverage map**: competency → the scenarios that most advance it. Learner opens it, drills into a
  competency, sees the scenarios (and variants) that move them forward there.
- **MVP = a mockup**: no mapping "engine". A **hand-authored** scenario/level → A1-competency mapping
  (start with the shipped scenario) drives a static-ish drill-down. This is the **only** place progress
  becomes visible.

---

## MVP architecture = a subset of legacy

| Concern | Legacy (files) | MVP verdict |
|---|---|---|
| Rehearsal dialogues | `server/dialogues.ts`, `dialogues/*.json`, `/api/config→dialogues`, `/api/speak`, `app.js` (`openDialogue`, `renderLevelTabs`, `presentBakerNode`, `chooseClient`) | **KEEP** → promote to *Practice scenarios* |
| Free chat (witness) | `orchestrator.converse`, `mastery.ts` (`selectForWitness`, `creditFromEvidence`), `prompt.buildConversationPrompt`, `/api/converse`, `app.js` (`beginFreeChat`, turn send) | **KEEP** → *Live AI tutor* |
| Seed onboarding | `seeds.ts`, `seeds/*.json`, `adapters/seed-scripted.ts`, `converse({seedId})` | **KEEP** → zero-state of *Live AI tutor* |
| Learner model | `assets/learner.ts`, `mastery.applyCredit`, `/api/learner` | **KEEP** (source of truth) |
| Scenario→free-chat handoff | `introduces` + focus-set `selectForWitness` + `reinforceFromDialogue` | **KEEP** (just built) |
| Session capture / replay | `assets/sessions.ts`, replay endpoints, `app.js` (`loadRuns`, `playClip*`) | **REPURPOSE** → *Replays* for free chat |
| A1 coverage | — (none) | **NEW** (mockup + authored mapping) |
| Scenario objective turn-loop | `orchestrator.understand`/`runTurn`/`applyProgress`, `/api/turn`, session/objectives, `takeaway` | **RETIRE from UI**, keep code dormant (future "scenario mode *in* free chat") |
| Story player | `scenarios` `scene.story`, `/api/config→story`, `/api/image`, `app.js` story fns | **CUT from UI** → authoring tooling |
| Practice (record-compare) | `app.js` practice fns, `#practice` | **CUT** |
| Objectives bar | `#objectives-bar`, `renderObjectives` | **REMOVE** (belonged to the objective loop) |
| Scenario picker dropdown | `#scenario-select`, `selectScenario` | **REPLACE** with the *Practice scenarios* list |
| Free-chat toggle (off/Tutorial/L1/L2) | `applyChatMode`, `CHAT_MODES` | **COLLAPSE** to a single *Live AI tutor* entry; level server-side |
| Gallery, authoring engine, asset pipeline, lints, critics | `/gallery`, `create-scenario`, `build:*`, `lint:*`, agents | **RETAIN as tooling** (not learner-facing) — the methods stay useful |

---

## Divergences from legacy (read before touching code)

The next session will see legacy code that **contradicts the MVP intent**. These are deliberate; don't
"fix" the MVP back toward legacy:

1. **Free chat is THE production surface.** The objective-driven scenario mic tutor (`/api/turn`) is *not*
   the scenario experience anymore. A "scenario" the learner touches = a rehearsal dialogue tree.
2. **Free chat now persists a session.** Legacy `converse` writes no session; the MVP captures one so
   Replays works. This is a real behavioral change to the converse path.
3. **Progress is visible only in A1 Readiness.** Everywhere else the engine stays invisible (unchanged
   maxim — see `docs/free-conversation.md`).
4. **No learner-facing "level".** The L1/L2 ceiling is an internal selection input, not UI.
5. **Rehearsal still credits nothing.** Mastery is earned only in the live tutor. The witness contract
   holds (`docs/free-conversation.md`).

---

## Net-new to build

1. **Home shell** — the four-destination navigation replacing the single scenario page.
2. **Practice scenarios** — scenario list + crisp variant/level selector wrapping the existing tree.
3. **Scenario-context plumbing** into `converse` — originating dialogue → pinned role + its unmastered
   objectives as the focus set (extends the existing `focusLearnables` + role machinery; any new Slovene
   the tutor is primed with must respect `never-freehand` — but role/context here is English priming, not
   authored Slovene lines).
4. **Live-tutor zero-state router** — empty learner model → seed; else → objective-driven open.
5. **Free-chat session capture + Replays view** — feed `assets/sessions` from `converse`; a per-session
   playback of the tutor's lines.
6. **A1 Readiness mockup** + an authored `scenario/level → A1 competency` mapping file.

---

## Remaining design decisions

Marked **[OPERATOR]** (needs the product owner) or **[SESSION]** (the building session may default).
Recommended default in **bold**.

- **[RESOLVED] MVP content: bakery + restaurant.** Bakery is built + audio-ready. **Restaurant is in
  scope**, three levels derived from the operator's "Zmaj Slavko v restavraciji" infographic — full
  authoring brief in **[restaurant-scenario.md](restaurant-scenario.md)** (panel→level mapping, voices
  npc=`female-speaker`/client=`male-speaker`, the `baker`→`npc` speaker-enum generalization, per-level
  concepts). Author via the gated procedure; audio is operator-triggered.
- **[OPERATOR] Seed onboarding content.** The current seed teaches café-survival phrases. **Default: keep
  it as the tutor-interaction tutorial for the MVP** (its job is teaching *how to talk to the tutor*),
  revisit its content later.
- **[SESSION] Replays depth.** **Default: minimum — replay the tutor's spoken lines/audio per session.**
  Full transcript + credited-items is a stretch goal.
- **[SESSION] "Session" boundary for replay** = one continuous free-chat until the learner exits.
- **[SESSION] Retire vs. delete the objective-loop code.** **Default: unwire from the UI, keep the module
  dormant** (it seeds the future "scenario mode in free chat"). Do not delete.
- **[OPERATOR] A1 competency taxonomy source.** The A1 mapping needs a competency list — likely from the
  team member's collected materials. **Default for the mockup: a small hand-authored list** covering the
  shipped scenario, replaceable when the real taxonomy arrives.

---

## Execution order

Each phase ends green before the next. Verify with the existing gates + a real-browser screenshot of any
UI (headless Chrome via CDP is fine — see this session's `scratchpad/cdp-shot.mjs` pattern; audio can't be
verified headlessly).

- **Phase 0 — disentangle + home shell.** Add the four-destination home; unwire the retired/cut surfaces
  from the UI (objective loop, story, practice, objectives bar, scenario dropdown, the free-chat toggle).
  Keep their modules on disk. *Verify:* app boots to the four destinations; nothing dead-links.
- **Phase 1 — Practice scenarios (P1).** Scenario list → crisp variant selector → existing tree +
  handoff. *Verify:* screenshot the list → variant → tree → "Now try it for real".
- **Phase 2 — Live AI tutor (P2).** Single entry; zero-state seed routing; scenario-context plumbing so an
  arrived-from-scenario chat pins the role + carries the level's unmastered objectives. *Verify:*
  converse turn with scenario context reaches the prompt (deterministic) + screenshot the entry.
- **Phase 3 — Replays (P2).** Capture free-chat sessions; per-session tutor playback. *Verify:* a live
  chat produces a session record; Replays plays its tutor lines.
- **Phase 4 — A1 Readiness (P3, mockup).** Authored mapping + drill-down screen. *Verify:* screenshot the
  drill-down from competency → scenarios.

---

## Guardrails

- **Never freehand Slovene.** Any new dialogue/learnable content goes author (`slovenian-author`) →
  critic (`scenario-critic`) → lint (`lint:scenario`/`lint:dialogue`). Scenario *context priming* for the
  tutor is English, not authored lines — fine.
- **Never generate images/audio unless the operator asks.** Propagation is decision-gated
  (`docs/asset-pipeline.md`).
- **Testing: real stack, least code, assert outcomes** (`AGENTS.md`). Keep the pure mastery/dialogue tests
  green (`npm run test:learnable`, `test:dialogue`, `lint:dialogue`).
- **Preserve the witness contract + credit firewall** — server owns crediting; rehearsal credits nothing.
- **`.env` is permission-locked** for the agent; ask the operator for any new secret/voice id.
- **Legacy stays on `main`.** Disentangle by unwiring on `mvp`, not by deleting shared modules.

---

## Anchors (start here)

- Product ethos: [free-conversation.md](free-conversation.md) · rehearsal mode:
  [rehearsal-dialogues.md](rehearsal-dialogues.md) · mastery: [learnable-subsystem-spec.md](learnable-subsystem-spec.md)
- MVP content brief: [restaurant-scenario.md](restaurant-scenario.md) (the second canned scenario)
- Direction: [ROADMAP.md](ROADMAP.md) (item 12 built; item 5 "tutor leads" still deferred)
- The just-built handoff: `orchestrator.converse` (`focusLearnables`), `mastery.selectForWitness`,
  `public/app.js` `reinforceFromDialogue`.
- Architecture map: [ARCHITECTURE.md](ARCHITECTURE.md) · [FILE-MAP.md](FILE-MAP.md) · [DATA-MODEL.md](DATA-MODEL.md)

## Provenance
Written 2026-07-29 on branch `mvp` (off `feat/dialogue-intro-freechat-reinforce` @ `1de1d14`). Reflects
the team's MVP scoping decisions from that session. Re-confirm the two **[OPERATOR]** content decisions
before Phase 1 content work.
