# Library rehearsal dialogues — coverage-first design (honor the original flowchart)

**Design draft** for the `library` scenario. The goal is to **honor the native-speaker submission**
([library-visit-flowchart.md](library-visit-flowchart.md)) — its full breadth and its complications. Built on
the reframed model in [docs/dialogue-difficulty-model.md](docs/dialogue-difficulty-model.md): difficulty is
**computed after authoring**, above-A1 content is **classified by band**, and trees may have **>2 choices**
with context carried as **choice text or a parenthetical**.

**Content source of truth = `library-visit-flowchart.md`.** The lines there (her Slovene) are the seeds;
this doc specifies *structure + mapping decisions*, not final language. The create-dialogue pipeline routes
every line through `slovenian-author` + `scenario-critic` before writing — reuse her wording wherever it
holds; only simplify a line if the pipeline flags it, and record why.

## Fixed decisions

- **One `library` scenario, six dialogues = her six sections.** Each dialogue is one branching tree that
  covers that section's situations *including* its complications (no ID, expired card, unpaid fine, book
  unavailable, reading-room-only, overdue, damaged) — every situation and complication is carried, at
  whatever band it computes to.
- **Complications are choices / parentheticals.** A context-dependent outcome (book available vs not) is
  offered as a selectable client branch or a `(parenthetical)` context on a choice.
- **Levels are computed, not authored.** Do **not** pre-assign L1/L2/L3. Author each section faithfully;
  the classifier assigns each dialogue's band (basic/intermediate/advanced) and orders them. Expected bands
  are noted per dialogue below as *targets to aim at*, not labels to set.
- **Learner = Slavko (male)**, reusing `male-speaker` and her own §3.2 name. Client lines carry male forms.
- **NPC = knjižničarka**, reusing `female-speaker`, delivered verbatim via `deliverySL` on npc lines:
  `"[soft spoken, whimsical and a little eccentric young librarian] <sl>"`. (Bakery precedent:
  `[hesitant and a little apathetic]` — a full descriptive tag creates the character; do not trim.)
- **Varied openings — USE them.** Each dialogue opens with its own **Slavko `intro` monologue** (the
  restaurant pattern: `intro: { audio, text, en }`, tagged for his signature sound), varied per section and
  fitting that errand. Author new library-appropriate intros; the *pattern* is reused, the content is new.

## Audio reuse (operator build)

`build:dialogue-assets` is **content-addressed by (clean `sl`, voice profile)** and free on a cache hit, so
reuse is **automatic** — any library line whose clean `sl` + voice already exists in the store is not
re-synthesized. Guidance + one real caveat:
- **Client (Slavko / `male-speaker`):** exact repeats already synthesized (e.g. `Da, prosim.`, `Ne, hvala.`,
  `Nasvidenje.`) reuse free. Compose closings/confirmations with her existing wording to maximize hits.
- **NPC (librarian / `female-speaker`):** the cache key is the clean `sl`, and `female-speaker` is shared
  with the restaurant waiter. So a shared clean `sl` (e.g. `Dober dan, izvolite?`) will **hit the existing
  clip with its original delivery**, not the librarian's whimsical tag. The librarian's delivery only applies
  to lines whose clean `sl` is **not already cached** under `female-speaker` — which most library-specific
  lines are. Don't fight this: accept cached delivery on generic shared lines; her character rides on the
  library-specific ones.
- Audio stays **operator-run** and generates trees at `audio: "pending"` — never auto-generated here.

## The six dialogues (structure — lines live in the flowchart md)

Each maps a section of the flowchart. `→` = npc response; `↳` = client choice (may be >2);
`(paren)` = context carried on a choice.

### A · Delovni čas / Opening hours — *(§1.1)* — target: intermediate
Slavko intro (checking hours before he sets out). npc greets → **↳** ask opening hours → **→** weekday +
Saturday hours → **↳** { close · *(paren: summer)* ask about holiday schedule → **→** adjusted summer
hours + website } → close. Mostly linear + one follow-up branch.

### B · Vpis in članstvo / Registration & membership — *(§2.1, §2.2, §2.3)* — target: intermediate→advanced
Slavko intro (first library card / sorting out his membership). npc greets → **↳ intent (3 choices):**
1. **Register** → **→** "ID?" → **↳** { have it → success card · *(paren: no ID)* → can't register, come back }
2. **Renew expired card** → **→** renew? → confirm address → success · *(paren: unpaid fine)* → settle €2 → renewed
3. **Lost card** → **→** issue new (~€2), old invalid.

Covers all three membership situations + the ID and unpaid-fine complications. Its higher-CEFR vocabulary
(*podaljšati, zamudnina, neporavnano*) raises the computed band, and the band reflects that.

### C · Izposoja / Borrowing — *(§3.1, §3.2)* — target: basic→intermediate
Slavko intro (excited about a specific book). npc greets → **↳ intent (2 choices):**
1. **Borrow this book** → **→** card please → **↳** { *(available)* → due in 30 days, enjoy ·
   *(paren: not available)* → reserve in 15 days? yes/no · *(paren: reading-room only)* → reserve for the
   reading room? yes/no }
2. **Pick up a reserved book** → **→** name? → "Slavko" → card → borrow arranged, 30 days, enjoy.

### D · Vračanje / Returning — *(§4.1, §4.2, §4.3)* — target: advanced
Slavko intro (a little sheepish — the book's overdue / he damaged it). npc greets → **↳ return this book →
→** checks → **↳ situation (3 branches):**
1. *(on time)* → all good. **[basic-ish]**
2. *(paren: overdue 5 days)* → apologize → fine → **↳** { pay now → receipt · pay next time → borrowing blocked }
3. *(paren: damaged)* → treated as lost → pay a replacement fee **or** bring an identical copy.

Spans A1→B2 exactly as she drew it; the band computes advanced. Keep all three outcomes.

### E · Uporaba prostora / Using the space — *(§5.1, §5.2)* — target: intermediate
Slavko intro (wants a quiet seat / to use a computer). npc greets → **↳ intent (2 choices):**
1. **Reading room** → **→** show card + choose seat → **↳** seat B2 → **→** seat reserved, check in at entrance.
2. **Computer** → **→** first floor → **↳** "do I need to reserve?" → **→** { no reservation ·
   *(paren: reservation required)* → needs card }.

### F · Drugo / Other — *(§6.1, §6.2)* — target: basic→intermediate
Slavko intro (needs to print / get online). npc greets → **↳ intent (2 choices):**
1. **Print a document** → **→** Printbox by the entrance → **↳** how does it work? → **→** upload via
   USB/email/website, log in at the machine.
2. **WiFi** → **→** yes → **↳** password? → **→** on a sticker by the entrance (or told).

## Catalog + classification notes

- **Mint from client (Slavko) lines only**, in citation form, reusing existing ids first
  (`rad_bi`, `ali_imate`, `dober_dan`, `hvala`, `nasvidenje`, `da`, `ne`, `kdaj`, `kako_ime` …).
- **New library learnables get a deliberate A1-tag decision at mint** (per the reframe) — e.g.
  *izposoditi, vrniti, vpisati se, rezervirati, podaljšati, zamudnina, geslo, računalnik, izkaznica*. Tag the
  ones that are A1 material; leave the above-A1 ones untagged. An untagged item is kept and simply raises the
  computed band. The narrow `a1-map` CORE stays as-is.
- **If a dialogue looks like it introduces nothing new, check the catalog** for missing A1 items it should
  carry.
- **Bands + `levelLabel` are computed** after authoring; order the six by ascending band for `level`.

## Dependencies (this design needs the reframed harness)

Honoring her flowchart uses the [dialogue-difficulty-model.md](docs/dialogue-difficulty-model.md)
capabilities: **>2-choice trees + parenthetical context** in the data model + `public/app.js` renderer
(scroll indicator), the **catalog A1 tag** + the **band classifier** in `lint:a1`. These must be built (or
stubbed) for the 3-choice intents and complication branches to render and classify; the six trees can be
authored as data in parallel. See the handoff for sequencing.
