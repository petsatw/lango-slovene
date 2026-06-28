# The Mastery Loop — Insights, Decisions & User Stories

**Status: captured intent (design interview).** Companion to [learnable-subsystem.md](learnable-subsystem.md)
(structure/capabilities) and grounded in the current app ([ARCHITECTURE.md](ARCHITECTURE.md),
[orchestrator.ts](../server/orchestrator.ts), [prompt.ts](../server/prompt.ts)). This document captures
the **mastery loop** specifically — roadmap item 4's inner mechanic — as worked out in interview. It is
the artifact to review on completion: did the build serve these experiences, and do they hold at scale.

Two conventions used throughout:
- **Decided:** a settled choice. Where the user drew a line, it is written **X — *not* Y** so the
  rejected option is never lost.
- **[NEW]** marks something the app does **not** have today — a feature the mastery loop must add. (The
  current app only moves one objective `pending ○ → recast ◐ → completed ●` inside a single **ephemeral**
  sitting; there is no learnable layer, no durable mastery, no counts.)

---

## Part 1 — Scope & framing

- **Decided: single learner, one device** — *not* multi-learner, *not* cross-device. "Per-learner model"
  = one durable, local model. No accounts, no sign-in, no identity work.
- **Decided: this work is the mastery loop itself** — *not* the tutor that leads. All steering/selection
  is deferred (see Part 2 → Steering).
- **Decided: assume a starter pack exists** — a basic set of scenarios, vocabulary, and patterns as
  learnables — and the learner starts at **zero** against it. No generation, no leading, no exposure
  tracking, no motivation inside this work.

---

## Part 2 — Insights & decisions (detailed)

### Terminology
- The unit of mastery is a **learnable**. Three kinds: **vocabulary**, **chunk**, **pattern**.
- A **stem** is a **pattern** (a frame with an open slot). Say **pattern** for the stem-type.
- High-leverage learnables are tagged **core**; the curated ranking is the **core pattern library**
  ([research/core-pattern-library-2026-06-26/](research/core-pattern-library-2026-06-26/)).
- **Decided: "meta-learning objectives" are not a separate structure** — they are **pattern/chunk
  learnables with very high priority** because they unlock the rest of the language ("how do you say",
  repair phrases). Priority is the only thing special about them — *not* a distinct category or flag.

### The learnable and its states
- Lifecycle: **unseen → attempted → mastered**, and a mastered learnable can fall back (see Reset).
- **Decided: entry into the model is an attempt** — a learnable lands in the model when the learner first
  tries to **produce** it. **Not** exposure (merely hearing the tutor say it, or seeing it in the story).
- **"Familiar"** = attempted or mastered.
- **Exposure is parked** as a future-state mechanic. Recorded open question (the user's): *what is the
  strong signal that the app has an "exposure-shaped hole" — that attempt-only entry is leaving a gap?*

### Mastery: counting & threshold
- **Decided: mastery is count-based** — *not* one clean shot, *not* a timer. **Mastered = successes ≥
  threshold.**
- **Threshold is a static variable, currently 5**, tunable upward if 5 proves too low. Sessions are
  short, so mastery normally accrues across several sittings (except the repetition path, Flow 10).
- **Two counters per learnable** [NEW]:
  - **attempts** — rises on **every** swing, success or fail.
  - **successes (`n/5`)** — rises **only** on a successful production; this is what mastery measures.
- The success count keeps climbing past the threshold (`5, 6, 7…`); "mastered" is just the threshold
  check.

### What counts as a successful attempt (and what doesn't)
- A **successful attempt** = the learner **produces** the learnable, the tutor judges it **understandable
  AND correct**, and it **did not need a recast**.
- **Decided: prompted, echoed, and cold productions all count equally** — *not* cold-only. If the learner
  says the learnable in any form — unprompted, after an eliciting prompt, or echoing a leading choice —
  it counts. (Explicit reversal of an earlier "unaided/cold" framing: "echoing is fine… let's not go
  crazy here.")
- **Uptake is already encouraged by the loop — no separate concept needed.** A recast never counts (you
  must produce the form yourself to advance), productions count across contexts and sittings, and the
  single-retry ratchet ranges from unaided open prompts to handed-over leading choices. The project's
  internal "forced/enforced-uptake" label is **retired** as confusing (and it was never standard SLA
  terminology — see note below). Cold-vs-aided production is at most an *optional signal the loop could
  stamp* for resurfacing later — not a requirement, not a gate.

  *Terminology note: "uptake" (Lyster & Ranta, 1997) means a learner's immediate response to corrective
  feedback — and "repair" there explicitly includes repeating the corrected form. The "cold/unaided,
  later" idea the project cared about is really **pushed output** (Swain) + **retrieval/spaced practice**,
  not "uptake." The mastery loop already covers it, so no special term is used.*
- **Non-counters** (raise *attempts*, not *successes*): a production that isn't understood; one that's
  understood but incorrect; any turn that needed a **recast**.
- **Decided: credit follows only from what the learner actually produced.** If it isn't known what the
  learner did, nothing can be credited. A step that doesn't state the learner's production yields no
  mastery progress (only an attempt).
- "Understandable" and "correct" — concrete definitions are **parked** for later.
- **Latency:** scoring may run **in the background / after the fact** if on-the-fly assessment is too slow.

### Per-learnable crediting
- **Decided: one utterance credits each learnable it exercises separately** — *not* the whole utterance
  as one lump. "Eno kavo, prosim" credits the **pattern** `eno + [fem acc]` **and** the **vocab** `kava`,
  each toward its own 5.
- **Decided: producing only part credits only that part.** Echoing just **"kavo"** credits the **vocab
  only** — the pattern frame was not produced, so the pattern gets nothing.

### Where counting happens
- **Decided: counts accrue wherever the tutor assesses live input** — scenario turns and free
  conversation.
- **Excludes** **story preview** (just listening) and **free practice / record-and-compare** (local,
  unassessed). "Anywhere" means anywhere the tutor judges a live production — *not* literally everywhere
  in the app.

### Decay, flub & reset
- **Decided: no time-based decay** — nothing ages out on a clock.
- **Decided: the only way mastery comes undone is a flub of a mastered learnable**, which **resets** it
  back into the pool to be re-earned. A flub = a stutter, a self-correction ("cat — no, dog"), or
  anything that registers as an unsuccessful attempt. Keep this mechanism **very dumb** for now.
- **Decided: pre-mastery, an unsuccessful attempt does not penalize** — the count simply doesn't rise
  (**stall, not regress**). Reset applies **only to already-mastered** learnables.
- Flub **decrements the success count by 1** (clamp ≥ 0) — *operator-confirmed*, gentler than the
  earlier assumed reset-to-0: a flub costs one, it doesn't wipe progress. At exactly threshold (5→4) the
  item falls back into the pool, re-masterable with one clean success; deep past threshold a single flub
  doesn't unseat it. See [learnable-subsystem-spec.md](learnable-subsystem-spec.md) §3.1.

### Groups & presentation (inside scenarios)
- An **objective draws from a group** of catalog learnables that satisfy it.
- **Groups are catalog-backed and settled at authoring.** Existing catalog learnables form the group;
  any natural-but-missing items get **created during scenario creation** to complete it (e.g., `tea` for
  a café; repair phrases "can you repeat that?" / "again please?").
- **Decided: a group with any unmastered item presents that item** (the one needing mastery) — *not*
  random while items remain.
- **Decided: random selection turns on only when the whole group is mastered** — and it's **review with
  teeth**: a flub during review resets that item, which turns random **off** and re-targets it.
- **Decided: if a group has only one item, the objective stays targeted on repeat**; if it has others,
  the objective **switches to another unmastered item**.
- **Decided: no fancy ordering within a group** ("next unmastered") — *do not complicate*. The **one
  exception**: **ranking applies only to high-leverage patterns**, to drive them to threshold fast.
  Ranking is **not** a general scheduler.

### Patterns vs vocab — the asymmetry
- **Decided: a mastered pattern keeps being used as the carrier** — it is **not** replaced by an
  unrelated new pattern just to have an unmastered target. A pattern swaps **only within an equivalent
  pattern group**, if one exists.
- **Vocab** cycles to the next unmastered filler in its group; once the group is exhausted → random
  review.
- Consequence: patterns master quickly (used with every filler), individual vocab each needs its own 5.

### The two layers — scene vs mastery
- **Decided: scene/objective completion and mastery are independent layers.** The existing
  `pending → recast → completed`, the 14-turn cap, and session-complete are **one** layer (exists today,
  ephemeral). The durable mastery count is a **separate** layer [NEW].
- **Mastery does not depend on scenario/objective/session status.** Its only question per attempt: *was
  it successful? → increment.*
- **Finishing a scenario ≠ mastering its learnables.** A learner can complete the café having only nudged
  a few counts and return another day.
- The layers **do not gate each other** — extra successful productions count even after an objective's
  dot is already `●` (see Flow 10).
- A scenario whose **whole group is mastered** flips to **on-repeat review**.

### Free conversation [NEW]
- A casual conversation mode. Draws on the learner's **attempted + mastered** learnables, **plus one or
  two un-attempted items from the existing catalog** (new *to the learner*, still the starter pack).
- **Decided: "new" means un-attempted catalog items** for the core loop — *not* items generated mid-
  conversation. The tutor's vocabulary is **bounded by the learner model** (familiar + 1–2 new).
- Most of free conversation is working **attempted-but-not-mastered** learnables toward mastery, using
  only familiar items plus the tiny edge expansion.
- **Three levels, learner-pickable:** (1) only what I've seen; (2) seen + a couple adjacent new;
  (3) push the edge. **Levels 1–2 are the mastery loop; level 3 (edge-finding) is deferred to
  tutor-leads.** Even level 3 leans heavily on already-familiar learnables as stepping stones.
- **Far edge of this journey:** catalog fully mastered → free conversation begins introducing
  newly-**created** items, likely **just vocabulary that deepens existing knowledge** (broad pattern
  expansion is more nuanced → tutor-leads). Creating new items happens **off the latency path** —
  background after the conversation, or pre-prepared before it. **Latency is the core driver**: never
  make the learner wait ~30s while the tutor "prepares."

### Steering, selection & visibility
- **Decided: all steering is deferred to tutor-leads** — including any picker reorder or "do this next"
  recommendation. (Explicit final position, reversing an earlier openness to a reordered picker.) In the
  mastery loop the learner **picks freely from the picker exactly as today**.
- **Decided: "what the learner cares about / is working toward" enters through a playful edge-finding
  mode** (free-conversation level 3) — *not* a settings screen or goal-setting ritual. That mode is
  **tutor-leads**, not the mastery loop.
- **Decided: the subsystem is an invisible internal mastery engine** — no new learner-facing UI, no
  dashboards, no scores, no streaks, no progress framing. Edge-finding output feeds the model
  **silently**. Resurfacing of due learnables is **woven invisibly into scenes**, never a visible review
  step, never nagging.
- **Decided: motivation/incentives are out of scope and deferred to a late roadmap item** (item 10).
  Duolingo proves the game can carry a product even when acquisition is weak; never let the game stand in
  for teaching. The takeaway stays internal-tracking — no scores/streaks.

### The not-a-grind principle
- **Decided: never frame the loop as a grind / drill / reps / torture.** It must feel **dynamic, natural,
  and fun**; mastery accrues through **natural reuse across varied contexts**. (Saved as a standing
  principle.)

### Recast & scaffold (existing turn policy, for grounding)
- A **recast** = the tutor naturally says the correct form back when the production was hard to understand
  or incorrect. A recast turn does **not** count toward mastery.
- The **single-retry scaffold ratchets down** one rung per stumble: open prompt → either/or including the
  target → leading choice containing the target. One good production completes the objective in-session
  (no forced cold repetition within a session).

---

## Part 3 — User stories (canonical)

Pure user stories — **role · capability · benefit** — with **Given/When/Then** acceptance criteria.
These are deliberately **not** constrained to current app features; where a feature is implied it's
incidental, not a requirement. The flows in Part 4 are the concrete acceptance scenarios that exercise
these stories.

### Learner — memory & mastery

**US-1 — Met where I left off.**
As a learner, I want the tutor to remember what I've learned between sessions, so that I never start from
zero and my time goes to what I don't yet know.
- *Given* I produced a learnable successfully in earlier sessions, *When* I return days later, *Then* the
  tutor treats it as known and doesn't re-teach it.

**US-2 — Mastery is earned, not a fluke.**
As a learner, I want something counted as mastered only after I've produced it correctly several times,
so that "mastered" means I really own it.
- *Given* a learnable, *When* my successful productions reach the threshold (a tunable number, currently
  5), *Then* it's mastered; one correct production alone is not enough.

**US-3 — Credit for exactly what I showed.**
As a learner, I want credit to land on each thing I actually produced correctly, so that nailing the word
but fumbling the grammar settles the word and keeps the grammar coming back.
- *Given* an utterance exercising several learnables, *When* I produce some correctly and others not,
  *Then* only the ones produced understandably-and-correctly advance.
- *Given* I produce only part of a phrase (e.g. just the noun), *When* it's assessed, *Then* only that
  part is credited, not the wider pattern.

**US-4 — Trying is safe.**
As a learner, I want a wrong attempt before I've mastered something to simply not count rather than set
me back, so that I can try without fear.
- *Given* an unmastered learnable, *When* I attempt it and it's wrong or needs a recast, *Then* my success
  count is unchanged (only my attempt count rises).

**US-5 — Keep what I've earned unless I actually slip.**
As a learner, I want to keep a mastered learnable until I genuinely flub it, so that my progress doesn't
decay for no reason.
- *Given* a mastered learnable, *When* time passes without me using it, *Then* it stays mastered (no decay).
- *Given* a mastered learnable, *When* I flub it (stutter, self-correct, or err), *Then* it resets and
  returns to practice.

**US-6 — Stop asking what I own.**
As a learner, I want to stop being prompted for things I already say easily, so that practice stays on
what's still shaky.
- *Given* a mastered learnable, *When* I'm in a scenario, *Then* the tutor stops targeting it — unless
  it's the only item available, in which case it may recur lightly.

**US-7 — Progress counts wherever I really use it.**
As a learner, I want a correct production to count regardless of where I produce it, so that genuine use
is always recognized.
- *Given* the tutor assesses a live production of mine, *When* it's understandable and correct and needed
  no recast, *Then* it counts — prompted, echoed, or unprompted alike.
- *Given* I only listen (story) or practise privately (record-and-compare), *When* no live assessment
  happens, *Then* nothing is counted.

**US-8 — Resume where I stood.**
As a learner, I want an interrupted session to resume from my standing progress, so that a closed tab or
dropped connection doesn't erase it.
- *Given* I abandon a sitting, *When* I return, *Then* my durable progress persists even if the scene
  restarts.

### Learner — how it teaches

**US-9 — Taught the way it's used.**
As a learner, I want a word taught as a word, a fixed phrase as a whole, and a pattern across varied
fillers, so that practice matches how I'll actually use each.
- *Given* a learnable's kind, *When* I practise it, *Then* a chunk isn't split into parts and a pattern
  isn't drilled as a frozen string.

**US-10 — Corrected like a conversation.**
As a learner, I want my errors fixed by a natural in-character recast, one thing at a time, so that I'm
not buried in grammar.
- *Given* an error worth fixing, *When* the tutor replies, *Then* it recasts the correct form in character
  without lecturing; on a repeated stumble it eases support by one step rather than repeating louder.

**US-11 — The most useful things come first.**
As a learner, I want the high-leverage patterns (those that unlock the most language) prioritized, so
that I gain broad ability quickly.
- *Given* core learnables exist, *When* the tutor chooses what to bring back, *Then* core patterns are
  prioritized toward mastery.

**US-12 — Conversation that stays within reach.**
As a learner, I want a relaxed conversation that mostly reuses what I'm close to owning plus a little
that's new, so that I consolidate naturally and stretch without being overwhelmed.
- *Given* free conversation, *When* the tutor speaks, *Then* it stays within my familiar learnables plus
  one or two new items, and works my not-yet-mastered ones toward mastery.

**US-13 — It feels natural, not a drill.**
As a learner, I want repeated practice to arrive as natural reuse in fresh contexts, so that improving
stays enjoyable rather than a chore.
- *Given* a learnable needs more reps, *When* it returns, *Then* it returns woven into real exchanges, not
  as a visible drill or score.

### Operator / author

**US-14 — Author real practice of an objective.**
As an author, I want to define, at authoring time, the group of learnables that satisfies each objective —
creating any natural-but-missing ones — so that every scenario gives genuine practice.
- *Given* I author a scenario, *When* I define an objective, *Then* it references a group of catalog
  learnables, and missing-but-natural items are created to complete it.

**US-15 — Mark what's high-leverage.**
As an author, I want to designate learnables as core, so that the loop knows what to prioritize.
- *Given* a learnable, *When* I mark it core, *Then* ranking treats it as high-leverage.

**US-16 — Small, swappable memory.**
As an operator, I want the learner model kept small and replaceable, so that it can be reset or swapped
without elaborate migration.
- *Given* the learner model, *When* I need to swap or reset it, *Then* its state is compact and not tied
  to a fixed internal format.

**US-17 — See whether it's working** *(proposed, unconfirmed)*.
As an operator, I want to inspect what the model thinks is owned / shaky / due, so that I can judge
whether mastery tracking behaves.
- *Given* the learner model, *When* I inspect it, *Then* owned/shaky/due is legible. *(Proposed in
  interview, not yet confirmed.)*

---

## Part 4 — The mastery journey as flows (the branches)

These are **flows** — concrete acceptance scenarios, not canonical user stories. Each is a real path a
learner takes through the app and hangs under the stories in Part 3. They're anchored to the café
objective `order_coffee` = "Eno kavo, prosim" — the first **pattern** `eno + [fem acc]` and first **vocab**
`kava` both live inside it. `n/5` = successes; **[NEW]** = the mastery layer the step depends on.

### Flow 1 — Clean, sitting by sitting
*The learner who simply gets it right, a bit at a time, across days.*
1. Picker → **Café** → fresh session, `order_coffee` dot `○`.
2. Hold button, "Eno kavo, prosim" → verdict `completed` → dot `●` → **[NEW]** pattern 1/5, kava 1/5.
3. Finish the scene → session complete → takeaway → close app.
4. Days later → Café → dot back to `○` (ephemeral today), but **[NEW]** counts persist (pattern 1, kava 1).
5. Order cleanly again → **[NEW]** pattern 2, kava 2.
6. Sittings 3–5 the same → **[NEW]** pattern 5, kava 5: both mastered.
7. **[NEW]** Next Café sitting: if `kava` is the only drink in the group, `order_coffee` stays targeted on
   repeat; if the group has other drinks, it switches to another unmastered item.

### Flow 2 — Scaffolded, and the echo credits only the vocab
*The learner who needs help to land it — and the precise crediting that follows.*
1. Picker → Café; (optional) step the story preview, free-practice the line locally — **neither is
   assessed, neither counts**.
2. Stall on the turn → tutor ratchets to either/or → leading choice "…**kavo** ali **pivo**?".
3. Learner echoes **"kavo"** → verdict `completed` → dot `●` → **[NEW]** **kava 1/5 only**; the pattern
   `eno ___, prosim` was **not produced**, so pattern stays 0/5.
4. To credit the pattern, the learner must later produce the **full frame**; vocab and pattern climb
   separately across sittings.

### Flow 3 — Error → recast → recovery (credit depends entirely on what the learner does next)
*The learner who makes the predictable mistake; whether they progress hinges on their own production.*
1. Picker → Café; "Ena kava, prosim" (the predictable **nominative** error) → verdict `attempted` → dot
   `◐` → tutor recasts "…eno kavo?" → **[NEW]** pattern **attempts +1**, **successes unchanged**.
2. Then it depends on the learner:
   - **3a — recovers:** learner produces **"Eno kavo, prosim"** correctly → dot `●` → **[NEW]** pattern
     1/5, kava 1/5.
   - **3b — doesn't:** learner errs again, echoes nothing, or moves on → **[NEW]** only attempts rise;
     successes stay 0/5.
3. Across sittings, only the **3a** productions accumulate toward mastery.

### Flow 4 — The 5 come from more than one place
*Because coffee appears only in café, the count is filled across café + free conversation.*
1. Two Café sittings with clean orders → **[NEW]** pattern 2, kava 2.
2. **[NEW] free-conversation mode**: tutor asks what you'd like → learner produces **"Eno kavo, prosim"**
   → assessed `completed` → pattern 3, kava 3.
3. Coffee comes up again in the chat → **[NEW]** pattern 4, kava 4 (only if the learner **produces** it;
   if they say only "kavo", just kava).
4. Next Café sitting, clean order → **[NEW]** pattern 5, kava 5: mastered across café + free conversation.

### Flow 5 — The pattern outpaces the vocab (needs a drink group)
*High-leverage frames master fast; individual words lag.*
1. **[NEW]** `order_coffee` carries a drink group {kava, voda, pivo…} — café currently has only kava, so
   **this story requires that group to be authored**.
2. Café: "Eno kavo" → **[NEW]** pattern 1, kava 1.
3. Next sitting the group offers a new drink: "Eno vodo" → **[NEW]** pattern 2, kava still 1 (voda 1).
4. Cycling drinks across sittings → **[NEW]** the pattern reaches 5 (mastered) while kava is still < 5.
5. **[NEW]** The mastered pattern **stays as the carrier frame**; kava keeps being targeted until it
   reaches 5.

### Flow 6 — Master → flub → reset → remaster
*Mastery can be lost, but only by flubbing it.*
1. Five clean café orders → **[NEW]** kava 5/5 mastered, no longer targeted.
2. Later café sitting: learner self-corrects mid-order "Eno čaj— ne, kavo" → verdict `attempted`, dot
   `◐` → **[NEW] flub** resets kava → 0/5.
3. kava re-enters `order_coffee`'s target → learner orders cleanly across sittings → **[NEW]** back to 5/5.
4. (No time decay — nothing resets except a flub.)

### Flow 7 — Stall without regress
*Before mastery, a miss costs nothing but the turn.*
1. Café: clean order → **[NEW]** kava 1.
2. Next sitting: "ena kava" error → dot `◐`, recast → **[NEW]** attempts +1, **kava stays 1** (no penalty
   before mastery).
3. Hits and misses alternate across sittings → **[NEW]** the count rises only on successes, never drops →
   eventually reaches 5: mastered, just slower.

### Flow 8 — A lost sitting (cap or abandon)
*A sitting can end without advancing anything — and the durable count should survive it.*
1. Café: the learner burns turns without completing `order_coffee` → turn 14 → session force-completes →
   dot left `◐` → **[NEW]** no count change.
2. Or the learner closes the browser mid-scene → run saved `abandoned` (replayable) → **[NEW]** the
   in-progress count **persists**, so the next sitting resumes from it (instead of today's full reset).

### Flow 9 — Never masters (the failure path)
*Many attempts, no mastery — the count simply never reaches threshold.*
1. Across many café sittings and free conversation, every "Eno kavo" is the nominative error or
   unintelligible → verdict `attempted` each time → dot `◐`, tutor recasts and ratchets.
2. Even the leading-choice echo never lands understandable-and-correct enough for a `completed` verdict →
   **[NEW]** successes never leave 0 (attempts keep rising).
3. After many attempts, neither pattern nor kava reaches 5 → **[NEW]** both stay unmastered, permanently
   in the pool.

### Flow 10 — Repetition ("cheating," but valid)
*The learner who just says the line over and over — and it legitimately counts.*
1. In **free conversation**, or even in **live tutoring after `order_coffee`'s dot is already `●`**, the
   learner repeats **"Eno kavo, prosim"** again and again.
2. Each understandable-and-correct utterance → **[NEW]** pattern +1 **and** kava +1 — independent of
   scene/objective completion (the two layers don't gate each other).
3. Five clean repeats → **[NEW]** both mastered, possibly **within a single sitting**.
4. It's arguably not the intended flow, but it's valid — the mastery counter cares only that the learner
   **produced** it, not where. (In live tutoring the tutor completes the objective on the first good
   production and steers away, so repetition is more natural in free conversation; nothing forbids it
   either place.)

---

## Part 5 — Scope boundary

**In (the mastery loop):** the durable per-learnable counters and threshold; per-learnable crediting;
the unseen→attempted→mastered lifecycle and flub-reset; groups & presentation inside scenarios; the two
layers; free-conversation levels 1–2 (familiar + 1–2 un-attempted catalog items); counting wherever the
tutor assesses.

**Out / deferred to tutor-leads (roadmap 5):** all steering, selection, and recommendation (incl. picker
reorder); edge-finding (free-conversation level 3); generating learnables beyond the catalog.

**Deferred later still:** motivation/incentives/scores/streaks (roadmap 10); pronunciation review on
record-and-compare (roadmap 11); exposure-based entry (future).

---

## Part 6 — Parked & open questions
- Concrete definitions of **"understandable"** and **"correct."**
- The signal that the app has an **"exposure-shaped hole"** (the user's question).
- ~~Flub reset to 0 vs decrement~~ — **resolved: decrement by 1** (operator-confirmed). See spec §0/§3.1.
- The **dual** `dve …` — one chunk, or deferred.
- **Kind boundaries** (vocabulary vs chunk vs pattern) in authoring practice.
- **Non-visual learnable cueing** (carrier situation, no image).
- **Predictable-error hint** placement — on the learnable, the objective, or both.
- How the catalog **designates/curates "core"** learnables.
- Whether the operator gets an **inspection view** of the model (owned/shaky/due) — proposed, not yet
  confirmed.

---

## Part 7 — Design deltas from the current app (the [NEW] inventory)
What the mastery loop must add on top of today's single-session, objective-level, ephemeral machine:
1. A **learnable layer** (vocabulary/chunk/pattern catalog) that objectives reference, splitting an
   objective like `order_coffee` into pattern + vocab.
2. **Per-learnable crediting** — today the verdict is per **objective** (`completed`/`attempted`); the
   loop needs credit to land per learnable from a single utterance.
3. **Durable per-learnable counters** (attempts + successes) that **persist across sittings** — today
   progress is ephemeral and resets on reload.
4. The **threshold/mastered** check, **flub-reset**, and the **pre-mastery no-penalty** rule.
5. **Groups & presentation** logic (present unmastered; random review when all mastered; pattern-as-
   carrier; ranking for core patterns only).
6. **Free-conversation mode** (levels 1–2), bounded by the learner model, with new-item creation off the
   latency path.
7. **Resume from in-progress** instead of a full session reset.
