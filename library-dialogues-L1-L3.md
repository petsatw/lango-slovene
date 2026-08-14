# Library rehearsal dialogues — five trees escalating L1 → L3 (all within A1)

**Design draft** for the `library` scenario. Derived from `library-visit-flowchart.md`, reshaped to fit the
rehearsal-dialogue harness (real 2-choice branching, no degenerate linear trees, branch only where the
**learner** chooses). Reuses the original author's Slovene verbatim wherever it holds at A1.

- **Learner persona:** **Slavko** (male) — reuses the existing `male-speaker` voice and the PDF's own named
  client in §3.2. All client lines carry male forms (*rad bi, izposodil, vrnil*).
- **NPC:** *knjižničarka* (librarian). **No new voice profile** — reuse the existing `female-speaker` id,
  steered per-line via `deliverySL`. Every npc line = `"[soft spoken, whimsical and a little eccentric young
  librarian] <sl>"` (the clean `sl` stays the caption + cache key; the tag only steers synthesis, npc lines
  only). `voices: { "npc": "female-speaker", "client": "male-speaker" }` — both env ids already set.
- **Register:** vikanje (formal *vi*), polite service — as in the original.
- **Marks:** unmarked SL = verbatim from the flowchart · **✎** = simplified/new, needs `slovenian-author` +
  `scenario-critic` sign-off (never freehand Slovene — these are seeds) · *(recept.)* = receptive npc line,
  not a minted learnable.
- **Status:** design only. Final language + catalog delta + `introduces` go through the create-dialogue
  pipeline. Open A1-map question flagged per dialogue.

## Escalation map

| # | Level | Band | Title | Branch points | ~Nodes |
|---|---|---|---|---|---|
| 1 | 1 | Beginning A1 | Izposoja knjige / Borrow a book | 1 | 9 |
| 2 | 2 | Beginning A1 | Vračanje knjige / Return a book | 1 | 10 |
| 3 | 3 | Basic A1 | Računalnik in WiFi / Computer & WiFi | 2 | 12 |
| 4 | 4 | Basic A1 | Vpis v knjižnico / Register | 1 (binary state) | 9 |
| 5 | 5 | Advanced A1 | Rezervacija in prevzem / Reserve & pick up | 3 | 14 |

Length + branch-count rise across the set; vocabulary/grammar stays inside A1 (survival chunks, present
tense, accusative, yes/no, negation, `ali` questions).

---

## D1 · Level 1 (Beginning A1) — Izposoja knjige / Borrow a book
*Source: §3.1 (happy path only; the "not available" branches move to D5).*

**Objectives**
1. Greet the librarian — *social opener.* (`dober_dan`)
2. Ask to borrow this book — *`rad bi` + accusative.* (`rad_bi`, ✎`izposoditi_knjigo`)
3. Hand over your card — *fixed chunk.* (✎`izvolite_tukaj`)
4. Take in the due date — *numbers/time, receptive.*
5. Close politely. (`hvala`, `nasvidenje`)

**Tree**
- **K** (root): Dober dan, izvolite? *(recept.)* — "Good day, can I help?"
  - **O:** Dober dan. Rad bi si izposodil to knjigo. — "Good day. I'd like to borrow this book."
  - **O:** ✎ Dober dan. Ali imate to knjigo? — "Good day. Do you have this book?" *(reuses `ali_imate`)*
  - → **K:** Seveda, prosim izkaznico. — "Of course, your card please."
    - **O:** ✎ Izvolite. — "Here you are."
    - **O:** ✎ Tukaj imate. — "Here you go."
    - → **K:** Izvolite. Rok vračila knjige je 30 dni. Prijetno branje! — "Here you go. Due back in 30 days. Enjoy!"
      - **O:** ✎ Hvala, nasvidenje. — "Thanks, goodbye."
      - **O:** ✎ Najlepša hvala. Nasvidenje! — "Thank you very much. Goodbye!"
      - → *end*

**Catalog** — reuse: `dober_dan`, `rad_bi`, `ali_imate`, `hvala`, `nasvidenje`. New: ✎`izposoditi_knjigo`
(*Rad bi si izposodil ___*), ✎`izvolite_tukaj`, possibly `knjiga`.
**A1-map risk:** *izposoditi* verb — confirm it maps to an A1 competency or exclude.

---

## D2 · Level 2 (Beginning A1) — Vračanje knjige / Return a book
*Source: §4.1 (degenerate, 2 lines) merged with §4.2 (late return). The B1 "unpaid fine / borrowing
blocked" content is **dropped**; replaced with an A1 pay-now / pay-tomorrow choice — same spirit, A1 words.*

**Objectives**
1. Say you're returning a book — *`rad bi` + `vrniti` + accusative.* (✎`vrniti_knjigo`)
2. Apologize for lateness — *fixed politeness.* (`oprostite`)
3. Choose how to settle a small fee — *the real learner decision.*
4. Handle money/time — *numbers, `jutri`.* (`jutri`)
5. Close.

**Tree**
- **K** (root): Dober dan, izvolite? *(recept.)*
  - **O:** ✎ Dober dan. Rad bi vrnil to knjigo. — "Good day. I'd like to return this book."
  - **O:** ✎ Dober dan. To knjigo bi vrnil, prosim. — "Good day. I'd like to return this book, please."
  - → **K:** ✎ Vidim, da ste malo zamudili. Plačilo je 2 evra. — "I see you're a little late. That's €2." *(recept.; simplified from B1)*
    - **O:** ✎ Oprostite. Plačam takoj. — "Sorry. I'll pay now."  → **K(a)**
    - **O:** ✎ Oprostite. Lahko plačam jutri? — "Sorry. Can I pay tomorrow?"  → **K(b)**
    - **K(a):** ✎ Hvala. Tukaj je potrdilo. Nasvidenje! — "Thanks. Here's your receipt. Goodbye!"
    - **K(b):** ✎ V redu. Prosim, plačajte jutri. Nasvidenje! — "Alright. Please pay tomorrow. Goodbye!"
      - *(both converge)* **O:** Hvala, nasvidenje. — "Thanks, goodbye." → *end*

**Catalog** — reuse: `dober_dan`, `rad_bi`, `oprostite`, `hvala`, `nasvidenje`, `jutri`, `placam`(if present).
New: ✎`vrniti_knjigo`, ✎`placam_takoj`, ✎`lahko_placam_jutri`.
**A1-map risk:** *vrniti* verb. **Tweak note:** the two npc outcomes (a/b) are driven by a genuine learner
choice — this is the harness-friendly recasting of §4.2's fork.

---

## D3 · Level 3 (Basic A1) — Računalnik in WiFi / Computer & WiFi
*Source: §5.2 + §6.2 — two degenerate topics merged into one tree with two branch points. The reservation
"required" alternate (npc-state) is collapsed to the single "not required" outcome; the `[geslo]` slot
becomes "on a sticker."*

**Objectives**
1. Ask permission to use something — *`ali lahko` + present verb.* (✎`ali_lahko`)
2. Ask a follow-up — *`ali` yes/no question.*
3. Ask whether they have WiFi — *`ali imate`.* (`ali_imate`)
4. Ask for the password — *`kakšno je ___`.* (✎`kaksno_je_geslo`)
5. Thank and close. (`hvala_lepa`, `nasvidenje`)

**Tree**
- **K** (root): Dober dan, izvolite? *(recept.)*
  - **O:** Dober dan. Ali lahko uporabljam računalnik? — "Good day. Can I use a computer?"
  - **O:** ✎ Dober dan. Rad bi uporabljal računalnik. — "Good day. I'd like to use a computer."
  - → **K:** Seveda. Računalniki so v prvem nadstropju. — "Of course. The computers are on the first floor."
    - **O:** ✎ Ali moram rezervirati? — "Do I need to reserve?"  → **K1**
    - **O:** ✎ Ali imate tudi WiFi? — "Do you also have WiFi?"  → **K2** *(skip ahead)*
    - **K1:** Ne. Rezervacija ni potrebna. Če je kakšen prost, ga lahko uporabite. — "No. No reservation needed. If one's free, use it."
      - **O:** ✎ V redu, hvala. Ali imate tudi WiFi? — "Alright, thanks. Do you also have WiFi?" → **K2**
    - **K2:** Da, seveda. — "Yes, of course."
      - **O:** Kakšno je geslo? — "What's the password?"
      - **O:** ✎ Kje je geslo? — "Where's the password?"
      - → **K:** ✎ Geslo je na nalepki pri vhodu. — "The password's on a sticker by the entrance."
        - **O:** Hvala lepa, nasvidenje. — "Thanks a lot, goodbye." → *end*

**Catalog** — reuse: `dober_dan`, `rad_bi`, `ali_imate`, `hvala`, `hvala_lepa`, `nasvidenje`. New:
✎`ali_lahko` (*Ali lahko ___?*), ✎`racunalnik`, ✎`kaksno_je_geslo`, ✎`rezervirati`.
**A1-map risk:** *rezervirati* verb; *geslo/računalnik* nouns (likely map under an everyday/tech theme —
confirm).

---

## D4 · Level 4 (Basic A1) — Vpis v knjižnico / Register
*Source: §2.1 (register + ID). §2.2 (expired, B1) and §2.3 (lost) are dropped for level. The ID have/haven't
fork is a **genuine learner choice** — the cleanest harness fit in the set.*

**Objectives**
1. Say you want to register / get a card — *`rad bi` + reflexive verb.* (✎`vpisati_se`)
2. Answer a document request — *have / don't have (the real choice).* (`da`, `ne`)
3. Hand over a document, or explain you don't have it — *negation.* (`nimam`)
4. Take in a conditional instruction — *receptive.*
5. Close.

**Tree**
- **K** (root): Dober dan, izvolite? *(recept.)*
  - **O:** ✎ Dober dan. Rad bi se vpisal v knjižnico. — "Good day. I'd like to register at the library."
  - **O:** ✎ Dober dan. Rad bi člansko izkaznico. — "Good day. I'd like a library card."
  - → **K:** Ali imate s sabo osebni dokument? — "Do you have your ID with you?"
    - **O:** Ja, izvolite. — "Yes, here you are."  → **K(a)**
    - **O:** ✎ Ne, nimam ga pri sebi. — "No, I don't have it with me."  → **K(b)**
    - **K(a):** ✎ Odlično. Tukaj je vaša izkaznica. Dobrodošli! — "Excellent. Here's your card. Welcome!"
    - **K(b):** ✎ Brez dokumenta vas ne morem vpisati. Prosim, vrnite se z dokumentom. — "I can't register you without ID. Please come back with it." *(simplified from original)*
      - *(both converge)* **O:** Hvala, nasvidenje. — "Thanks, goodbye." → *end*

**Catalog** — reuse: `dober_dan`, `rad_bi`, `ali_imate`, `da`/`ja`, `ne`, `hvala`, `nasvidenje`, `nimam`(if
present). New: ✎`vpisati_se`, ✎`izkaznica`, possibly ✎`osebni_dokument`.
**A1-map risk:** *vpisati se* reflexive verb; *osebni dokument* chunk.

---

## D5 · Level 5 (Advanced A1) — Rezervacija in prevzem / Reserve & pick up
*Source: §3.1 "not available → reserve" + §3.2 "pick up reserved book." Longest tree, three branch points
— the full-A1 capstone. Reuses the PDF's own reserve/pickup lines; keeps the named client "Slavko."*

**Objectives**
1. Ask for a specific book — *`ali imate` / `rad bi`.*
2. Decide to reserve or not — *yes/no learner choice.* (`da`, `ne`)
3. Give your name — *identity.* (`kako_ime` / ✎`ime_mi_je`)
4. Ask when it'll be ready — *`kdaj` question.* (`kdaj`)
5. Close.

**Tree**
- **K** (root): Dober dan, izvolite? *(recept.)*
  - **O:** ✎ Dober dan. Ali imate to knjigo? — "Good day. Do you have this book?"
  - **O:** ✎ Dober dan. Rad bi to knjigo, prosim. — "Good day. I'd like this book, please."
  - → **K:** ✎ Trenutek, preverim... Žal je trenutno ni. — "One moment, I'll check... sorry, it's not here now." *(recept.; from §3.2 + §3.1)*
    - → **K:** Želite, da vam jo rezerviram? — "Would you like me to reserve it?"
      - **O:** Da, prosim. — "Yes, please."  → **K(a)**
      - **O:** ✎ Ne, hvala. Pridem drugič. — "No thanks. I'll come another time."  → **K(b)** → close
      - **K(a):** ✎ V redu. Kako vam je ime? — "Alright. What's your name?"
        - **O:** Slavko. — "Slavko."
        - **O:** ✎ Ime mi je Slavko. — "My name is Slavko."
        - → **K:** ✎ Hvala. Ko bo knjiga tu, vas pokličemo. — "Thanks. When the book's here, we'll call you."
          - **O:** ✎ Odlično, hvala. Nasvidenje. — "Great, thanks. Goodbye." → *end*
          - **O:** ✎ Kdaj bo na voljo? — "When will it be available?"  → **K:** ✎ Predvidoma čez teden dni. — "In about a week." → **O:** Hvala, nasvidenje. → *end*
      - **K(b):** ✎ V redu, nasvidenje. — "Alright, goodbye." → **O:** Nasvidenje. → *end*

**Catalog** — reuse: `dober_dan`, `rad_bi`, `ali_imate`, `da`/`ja`, `ne`, `hvala`, `nasvidenje`, `kdaj`,
`kako_ime`. New: ✎`rezervirati`(shared w/ D3), ✎`ime_mi_je`, ✎`knjiga`(shared).
**A1-map risk:** *rezervirati*; *na voljo* (receptive).

---

## Cross-cutting notes

- **Genuinely new productive learnables across all five ≈ 8–10** (`izposoditi_knjigo`, `vrniti_knjigo`,
  `vpisati_se`, `rezervirati`, `ali_lahko`, `racunalnik`, `geslo`, `izkaznica`, `ime_mi_je`, `izvolite_tukaj`).
  The rest is reuse — so the set *does* introduce new language, unlike an unmodified A1 slice.
- **The new verbs go straight into the A1 map.** *izposoditi, vrniti, vpisati se, rezervirati* — add each as
  an A1-competency mapping in `a1-map.json` (stage-11 fold-in) and re-run `lint:a1`. The map is an
  extensible operator-owned reference, **not** a frozen canon — extending it is the normal path, not a
  blocker. (See docs/a1-taxonomy.md — canonical *reference*, with admitted MVP scoping gaps.)
- **One prereq before it loads:** a `library` scenario must exist (for the 🎭 Rehearse button + the
  reinforce-handoff's role/context). Confirm whether `reconcile:dialogue` writes the scenario manifest or a
  minimal `server/scenarios/library.json` stub is needed first. **No voice work** — female + male ids reused.
- **Every ✎ line is a seed, not final** — the create-dialogue pipeline routes them through
  `slovenian-author` + `scenario-critic` before anything is written.
- **The delivery tag is verbatim to ElevenLabs and stays as written.** `build:dialogue-assets` synthesizes
  `deliverySL ?? sl` and keys the cache on the clean `sl`. Precedent: the bakery npc uses a full descriptive
  tag `[hesitant and a little apathetic]` on every line and it creates the character with no intro monologue.
  So `deliverySL: "[soft spoken, whimsical and a little eccentric young librarian] <sl>"` on every librarian
  (npc) line is on-pattern — do **not** trim it. Client (Slavko) lines carry no `deliverySL`.
