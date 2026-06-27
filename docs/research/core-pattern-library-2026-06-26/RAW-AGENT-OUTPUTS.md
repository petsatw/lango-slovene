# Raw agent outputs — Slovene CORE library consensus (2026-06-26)

The full, verbatim output of all 8 persona agents. Synthesis: [SYNTHESIS.md](SYNTHESIS.md). Ranked
typed list: [RANKED-PATTERNS.md](RANKED-PATTERNS.md).

Panel: N=8, mix (4 opus, 4 sonnet). Personas: (1) Slovene native sociolinguist · (2) corpus/frequency
linguist · (3) polyglot carrier-phrase teacher · (4) SLA acquisition researcher · (5) Slavic pedagogy
specialist · (6) adult expat beginner · (7) cognitive scientist of memory · (8) ASR/pronounceability
realist.

---

## Agent 1 — Slovene native sociolinguist (opus)

**Recommendation:** Three layers, reordered as L1 → L3 → L2. Front-load repair + baked-case chunks (instant transactional survival), then stems (generative growth). Reject knjižni textbook forms for pogovorni Ljubljana register. Default to vikanje with strangers.

**The "only 15" shortlist** (native Ljubljana forms):
1. **Ne razumem** — "I don't understand." Error: stressing wrong syllable. ✓high
2. **A lahko ponovite?** / **Še enkrat, prosim** — "Repeat?" Note pogovorni *a* opener, not *ali*. Error: saying *ponovi* (tikanje) to a stranger. ✓high
3. **Bolj počasi, prosim** — "Slower." ✓high
4. **Kako se reče ___?** — slot: English word. "How do you say ___?" Error: *kako rečeš*. ✓high
5. **Kaj je to?** — "What's this?" ✓high
6. **Govorite angleško?** — vikanje default. Error: *govoriš*. ✓high
7. **Slabo govorim slovensko** — "I speak Slovene badly." More native than *malo govorim*. ⚠med (gender-neutral, safe)
8. **Se učim** — "I'm learning." (drop *jaz*). ✓high
9. **Eno kavo, prosim** — slot: *eno pivo / en čaj*. Case baked in (accusative). Error: *ena kava*. ✓high
10. **Prosim za ___** — slot: nominative-ish noun. Dodges case partially. ⚠med
11. **Hvala / Oprostite / Prosim / Ja / Ne** — *oprostite* (vikanje) doubles as "excuse me" to flag a stranger. ✓high
12. **Koliko stane?** — "How much?" Fixed, no slot needed. ✓high
13. **Rad/Rada bi ___** — slot: noun (acc) or infinitive. "I'd like ___." Gender-marked: *rad* (m) / *rada* (f). Error: wrong gender, or *bi rad* word order. ✓high
14. **Lahko ___?** — slot: finite verb (*lahko plačam?*). Note: *lahko* takes FINITE, not infinitive — this is the trap. "Can I ___?" Error: *lahko plačati*. ✓high
15. **Bom ___ / Sem ___** + l-participle — the tense double-unlock: *bom jedel* (will) / *sem jedel* (did). Slot: l-participle. Error: forgetting gender agreement (*sem jedla* for f). ⚠med — highest-leverage but hardest.

**Key reasoning:**
- **Chunks before stems.** A beginner survives a counter on baked-case fixed phrases (#9, #12) on day one; stems (#13–15) are the *permanent* engine but need a participle/gender they don't yet control. Sequence accordingly.
- **Reject knjižni forms locals don't say:** *ali* → use *a*; full pronouns *jaz/ti* → drop them; *želim* → *bi rad*; *kako rečeš* with strangers → vikanje. Textbook teaches the un-said.
- **Gender + dual are unavoidable leaks.** *rad/rada* and l-participle agree with the speaker's gender — bake both forms in from the start. Ignore the dual entirely at this stage; it's high-cost, near-zero survival value.
- **Pronounceability gates adoption.** *oprostite, počasi* are clean; cluster-heavy alternatives get abandoned. Favor the sayable variant even if slightly less precise.

**Confidence:** medium — Forms and register are high-confidence native Ljubljana; the *ranking/sequencing* is a defensible judgment call, not empirical.

**Strongest counterargument to your own view:** Demoting L2 stems risks fossilizing a learner in chunk-only mode — they transact fine but never generate novel sentences, the exact "imperfect but reusable scaffold" the brief wants. One could argue *rad bi* + *lahko* + the periphrastic past/future should be taught FIRST precisely because they're the permanent generative core, with chunks as disposable training wheels. My counter: a beginner can't deploy a participle they can't form, so chunks must bridge the gap — but the line is genuinely contestable.

---

## Agent 2 — Corpus/frequency linguist, GOS (sonnet)

**Recommendation:**

**Tier 0 — Absolute ceiling (must have first):**
1. `sem / je / smo` (biti present) — copula + auxiliary; most frequent lemma in GOS by far
2. `sem bil/a / sem jedel/a` (biti + l-participle) — single periphrastic unlocks entire past
3. `bom / bo / bomo` (biti future) — same stem, unlocks entire future; slot: `bom [infinitive]`
4. `ne` — negation particle AND discourse backchanneling; Zipfian top-5 in spoken Slovene
5. `ja` / `ne` as affirmation/denial — highest-frequency discourse tokens in GOS after function words

**Tier 1 — Modal stems (frame + slot):**
6. `Hočem / Bi rad(a) [infinitive]` — want/would-like; `bi rad/a` markedly more polite, both extremely frequent
7. `Moram [infinitive]` — obligation frame; covers huge pragmatic territory
8. `Lahko [verb]? / Ali lahko...?` — permission/possibility; `lahko` is high-frequency, low-morphology cost
9. `Grem [v/na + accusative/locative]` — motion verb; freezes as chunk, sidesteps most case complexity

**Tier 2 — Baked-in case chunks (zero morphology to learn):**
10. `Eno kavo, prosim` / `En [item], prosim` — accusative already baked in; no declension needed
11. `Prosim za ___` — accusative frame with `za`; extendable
12. `Koliko stane?` — frozen; unlocks all transactions

**Tier 3 — L1 Meta/Repair:**
13. `Ne razumem. Lahko počasneje?` — repair sequence; statistically the most-used utterance type for L2 speakers
14. `Kako se reče ___?` / `Kaj je to?` — lexical gap filler; frozen
15. `Govorite angleško?` — frozen; emergency exit

**"Only 15" ranked by frequency-leverage:** biti-present → biti-past → biti-future → `ne`/`ja` → `hočem`/`bi rad(a)` → `moram` → `lahko` → `grem` → `eno kavo prosim` → `prosim za` → `koliko stane` → `ne razumem` → `kako se reče` → `kaj je to` → `govorite angleško`

**Key reasoning:**
- `biti` is unambiguously the highest-frequency lemma in spoken Slovene; its auxiliary function alone buys both tenses periphrastically — this is the single highest-leverage unlock, confidence solid
- Discourse particles `ne`/`ja`/`no`/`aha` dominate GOS backchannel data; `ne` double-duties as negation, making it the most reusable single token in the language
- Frozen accusative chunks (`eno kavo`) route around the entire case system for transactional Slovene; frequency of these exact sequences in service encounters is high (approximate)
- L1 Meta/Repair ranked last structurally but is pragmatically required from minute one; reorder it to the *surface* of the syllabus, not the *core* ranking

**Confidence:** medium-high — GOS frequency data on lemmas/auxiliaries is solid; discourse particle rankings approximate from published GOS studies; exact modal frequency ordering is estimated

**Strongest counterargument:** The repair layer (L1) should arguably be Tier 0, not Tier 3 — a beginner who can't stop the conversation and buy processing time will fail before any grammatical scaffold pays off. From a pure corpus-frequency ranking, `biti` wins; from a communicative-survival ordering, `ne razumem / počasneje` wins on Day 1, regardless of its lemma rank.

---

## Agent 3 — Polyglot carrier-phrase teacher (opus)

**Recommendation:**

**TIER 1 — the three first stems (learn these before anything else):**

1. **Modal + INFINITIVE** — `Moram / Želim / Lahko / Hočem ____` (infinitive). Slot = dictionary verb, no conjugation. Payoff: instant sentence-hood ("Moram iti / plačati / govoriti"). This is the first lever, not biti+participle — because the infinitive is the form the learner already meets in the dictionary, and *one* conjugated modal carries an unconjugated verb. Error: English speakers insert "to" ("moram **da** grem") — kill that reflex early. Confidence: high.
2. **`Rad/Rada bi ____`** (infinitive) — "I'd like to ____." Combines politeness + conditional + infinitive slot in one fixed chunk. `bi` is **person-invariant** (the gift). Payoff: instantly polite request engine for shops/café. Error: gender on *rad/rada* (male/female learner) — taught as a one-time fixed pick, not a paradigm. Confidence: high.
3. **biti + l-PARTICIPLE = the tense double-unlock** — `sem / bom + ____l` → past AND future from ONE auxiliary paradigm (sem·si·je·smo·ste·so / bom·boš·bo·bomo·boste·bodo). "Sem jedel / Bom jedel." Payoff: highest in the language — two whole tenses with zero per-verb conjugation. This is THE killer unlock; it ranks third only because modals get them talking on day one, but it's the deepest. Error: word-order/clitic placement of *sem*, and forgetting the aux. Confidence: high; verify clitic-position rules.

**TIER 2 — META/REPAIR (taught simultaneously, the survival shell):**
`Oprostite` / `Ne razumem` / `Govorite počasi?` / `Kako se reče ____?` / `Še enkrat, prosim` / `Kaj pomeni ____?` Payoff: keeps every real conversation alive. Confidence: high.

**TIER 3 — BAKED-IN-CASE CHUNKS:** `Eno kavo, prosim` / `Kje je ____?` / `Koliko stane?` — memorize whole, do NOT decline-parse. Confidence: medium (frozen forms safe; productive case is later).

**On the "one invariant stem" promise:** I keep it by reframing gender (*rad/rada*, *jedel/jedla*) not as a paradigm but as a **single lifelong pick** — the learner has ONE gender, chooses once, never toggles. The promise holds because *the learner's* form is invariant even if the language's isn't.

**IF ONLY 15:**
1. Moram + inf 2. Želim + inf 3. Lahko + inf 4. Rad/rada bi + inf 5. sem + -l (past) 6. bom + -l (future) 7. Bi + inf (conditional) 8. Grem + supine (Grem jest) 9. Oprostite 10. Ne razumem 11. Kako se reče ___? 12. Koliko stane? 13. Kje je ___? 14. Eno ___, prosim 15. Prosim / Hvala.

**Key reasoning:**
- Modals win the *sequencing* race (talk day one); biti+participle wins the *depth* race (two tenses, one paradigm) — stage modal→rad bi→biti so each new stem reuses the infinitive slot already drilled.
- `bi` person-invariance and the *single* auxiliary paradigm are the two structural gifts of Slovene; everything else is downstream of them.
- Gender agreement is neutralized by the "you have one gender, pick once" framing — no table, no toggle.

**Confidence:** high — the carrier-stem inventory is sound; flag for native verification: clitic/word-order placement of *sem/bi* and supine-vs-infinitive after motion verbs.

**Strongest counterargument to my own view:** Slovene's dual number and pervasive case marking mean "accept imperfect output" may degrade past a comprehensibility threshold faster than in Romance languages — a frozen-chunk learner saying "Moram ena kava" may hit blank stares where a Spanish learner's "Necesito un café" sails through. If case errors actually block comprehension, my scaffold-first/decline-later staging is wrong and minimal case (at least accusative for direct objects) belongs in Tier 1, not Tier 3.

---

## Agent 4 — SLA acquisition researcher (sonnet)

**Recommendation:**

**L1 — META/REPAIR (deploy first, highest ROI)**

1. Počasi, prosim. — "Slowly, please." — keeps input comprehensible; error: *počasno* (adj form); confidence: HIGH
2. Ne razumem. — "I don't understand." — core repair opener; error: *ne razumim* (wrong class); HIGH
3. Lahko ponovite? — "Can you repeat?" — fixed chunk hides modal+inf; error: none if memorized; HIGH
4. Kako se reče ___? — "How do you say ___?" — slot=L1 word; generates input on demand; HIGH
5. Kaj pomeni ___? — "What does ___ mean?" — slot=L2 word; decodes unknown items; HIGH
6. Govorite angleško? — "Do you speak English?" — exit valve; prevents communicative collapse; HIGH
7. Prosim, napišite. — "Please write it down." — bypasses phonology; HIGH

**L3 — BAKED-IN CHUNKS (second priority; morphology hidden)**

8. Rad/a bi ___. — "I would like ___." — slot=noun (acc); hides conditional entirely; gender agreement on *rad* is only risk; HIGH
9. Koliko stane? — "How much does it cost?" — fully baked; zero morphology exposed; HIGH
10. Kje je ___? — slot=place noun; no case visible at surface; HIGH
11. Imam ___. — slot=noun (acc); "I have ___"; acc mostly unmarked for English speaker; MEDIUM
12. Prosim, eno ___. — "One ___, please." — ordering chunk; *eno* is neuter but often tolerated; MEDIUM
13. Gremo v ___. — "We're going to ___." — acc/loc masked; social coordination; MEDIUM

**L2 — PRODUCTIVE STEMS (defer; introduce after L3 is solid)**

14. Biti+l-participle: *Bil/a sem v ___* — "I was in ___." — gender agreement on l-participle is a genuine two-part production load; introduce only after learner has noticed tense contrast naturally; MEDIUM
15. Modal stem: *Moram ___* + infinitive — "I must ___." — infinitive is unmarked; low morphological cost; HIGH — elevate this to L3-adjacent

**"Only 15" shortlist:** items 1–13 + *Moram* + *Oprostite* ("Excuse me" — pure phatic, zero morphology, prevents face-threat).

**Key reasoning:**
- Repair/help-seeking phrases keep conversation alive and generate further comprehensible input (Krashen i+1 via interlocutor adjustment); they are the only category that scales input quality.
- Unanalyzed chunks are the legitimate beginner strategy (Wray 2002): memorized wholes bypass morphological paradigms the learner cannot yet decompose.
- Biti+l-participle is a two-slot production requiring real-time gender retrieval — research on accuracy orders (Pienemann) says this emerges, not gets installed; forced early production produces fossilized errors.
- *Moram+inf* is the one L2 stem worth early deployment: the infinitive slot is morphologically inert for Slavic beginners.

**Confidence:** HIGH — repair-first priority is robust across SLA traditions; chunk-before-paradigm is uncontroversial.

**Strongest counterargument:** A Slovenian interlocutor outside a tourist register will rapidly outpace this scaffold; without *any* case-marked production the learner can't signal intent in ambiguous NP-heavy utterances, and a purely chunk-based beginner may plateau into "frozen" competence (Schmidt's noticing hypothesis) because they never expose underlying structure to correction. Some early productive stem exposure, even messy, may be necessary to trigger noticing and avoid premature stabilization.

---

## Agent 5 — Slavic pedagogy specialist (opus)

**Recommendation:**

**L1 META/REPAIR (non-negotiable, all baked chunks, zero grammar):**
- *Ne razumem* (I don't understand); *Ponovite, prosim* (repeat please); *Počasi, prosim* (slowly); *Kako se reče...?* (how do you say); *Govorite angleško?* (do you speak English); *Oprostite* (excuse me/sorry); *Ne vem* (I don't know).

**L2 STEMS (the productive engine):**
1. **Modal + INFINITIVE** — *moram + inf* (I must), *želim + inf* (I want), *ne morem + inf* (I can't). Slot: [modal]+[dictionary verb]. High-leverage: one finite form carries any action. (c) verb dictionary form needs no conjugation. (d) Error: conjugating the infinitive. **Verified high-confidence: moram/želim/morem take infinitive.**
2. **Lahko + FINITE verb** — *Lahko grem?* (can I go), *Lahko plačam?* (can I pay). Slot: lahko + [1sg present]. (e) **Verified high: lahko is an adverb, takes a finite verb — NOT infinitive.** This is the one split English speakers must absorb.
3. **rad/rada + bi + inf** — *Rad bi plačal* / *Rada bi kavo* (I'd like). Teach OWN-GENDER form ONLY: male learner banks *rad*, female *rada*. Never present the pair as a paradigm. (d) Error: dropping bi, or wrong gender.
4. **biti + l-participle (past)** — *sem jedel/jedla* (I ate), *sem bil/bila* (I was). Teach own-gender l-participle as a fixed chunk per high-frequency verb. Slot deferred as productive system; seed ~8 lexicalized: *sem bil, sem šel/šla, sem jedel, sem rekel*.
5. **Motion + SUPINE** — *Grem jest* (I'm going to eat), *Grem spat* (going to sleep). Slot: Grem + [supine]. (c) Bakes the supine so the learner never parses it; just memorize the -t form after grem. (d) Error: using infinitive *jesti* for supine *jest*.
6. **Future**: *bom + l-participle* — defer to L3 chunks (*bom šel*), not a live slot yet.

**L3 BAKED-IN-CASE chunks (case smuggled in, never taught):**
- *Eno kavo, prosim*; *Dve kavi, prosim* (dual, baked); *Račun, prosim*; *Koliko stane?*; *Imate...?*; *Kje je...?*; *Za s sabo* (to go).

**THE CASE PARETO LINE:** Teach ONE case productively — **accusative singular for direct objects**, and ONLY the feminine -a→-o shift (*kava→kavo, voda→vodo*), because that's the visible, high-frequency, food/ordering core. Masculine inanimate accusative = nominative (zero cost — free win). Everything else (genitive after *brez/prosim za*, locative after *v/na*) stays BAKED IN CHUNKS. The line: **fem-acc -o is the single productive case rule; all else is phrasebook.** That one rule converts a learner from phrasebook to productive in the ordering domain — the highest-frequency domain there is.

**ASPECT:** DEFER ENTIRELY. Zero core slots. Lexicalize whichever aspect the chunk happens to use; never contrast pairs. Aspect is the single biggest slot-waster for a beginner.

**DUAL:** CORE but as TWO frozen chunks only — *dve kavi*, *midva/sva* (we-two) ONLY if a partner context demands it; otherwise *dve [noun]* baked, no productive dvojina morphology.

**"IF ONLY 15":**
1. Ne razumem 2. Ponovite, prosim 3. Kako se reče...? 4. Oprostite 5. moram + inf 6. želim + inf 7. lahko + [finite] 8. rad/rada bi + inf 9. Eno kavo, prosim 10. Dve kavi, prosim 11. Koliko stane? 12. Kje je...? 13. Imate...? 14. Grem jest/spat (supine) 15. sem bil/bila (past anchor)

**Key reasoning:**
- The modal/lahko split is the whole productive payload: master *moram/želim+inf* and *lahko+finite* and you generate unlimited sentences from a dictionary.
- Fem-acc -o is the ONLY case worth a slot — high-frequency, visible, ordering-domain; the rest is genuinely fakeable with chunks at no comprehension cost.
- Gender (rad/rada, jedel/jedla) must be taught as own-gender-only to protect the stem promise; a paradigm doubles the load for zero day-one gain.
- Aspect and full dual/case morphology are deferred because their cost-per-slot is catastrophic at beginner level and chunks cover the frequent cases.

**Confidence:** high — modal-government facts verified (lahko+finite; moram/želim+infinitive; rad bi+l-participle); fem-acc -o is uncontroversially the Pareto case.

**Strongest counterargument to your own view:** Restricting accusative to feminine -o is a half-rule that may confuse more than it helps: learners hear masculine animate accusatives early (*Vidim soseda*, *Imam psa* → -a ending) and the "masc = nominative" shortcut silently fails on animates, producing *Imam pes*. A cleaner line might be to teach NO productive case at all and bake every object chunk, keeping the stem layer purely verbal — trading some productivity for a promise that never cracks.

---

## Agent 6 — Adult expat beginner (sonnet)

**Recommendation:**

**L1 META/REPAIR — reach for these every single day, non-negotiable:**

1. *Lahko po slovensko, prosim? Se učim.* — "Can we keep it in Slovene? I'm learning." This is THE phrase. Say it the moment they switch to English. Nothing else buys you practice time.
2. *Ne razumem.* — "I don't understand." Used 20× daily.
3. *Lahko počasneje?* — "Can you speak slower?" Locals speak at full speed even to obvious beginners.
4. *Kako se reče...?* — "How do you say...?" Slot: [English word]. Invaluable in shops.
5. *Kaj je to?* — "What is this?" Pointing at an unknown thing on a shelf or form.
6. *Prosim / Hvala / Ja / Ne / Oprostite* — Please / Thank you / Yes / No / Excuse me/Sorry. These are ambient lubricant. Used constantly.
7. *Govorite angleško?* — Emergency exit only. Signals defeat, but sometimes necessary.

**L2 STEMS — generative but cognitively heavy in the moment:**

8. *Bi rad/a ___* — "I would like ___." Most polite want-form. Slot: noun or infinitive. (Flag: gender agrees — *rad* m, *rada* f — predictable English speaker mistake to drop this.)
9. *Moram ___* — "I have to ___." Slot: infinitive. Covers obligations (doctor, school, landlord).
10. *Grem ___ [supine]* — "I'm going to [do X]." *Grem kupit kruh.* Slot: supine form. Covers most movement-plus-purpose sentences.
11. *Je bil/a/o ___* — Simple past via biti + l-participle. Heavy cognitively — I reached for infinitive instead and got blank stares.

**L3 BAKED-IN CHUNKS — just blurt these, don't analyse:**

12. *Eno kavo, prosim.* — One coffee please. Template: *[number] [accusative noun], prosim.* Works at every counter.
13. *Koliko stane?* — "How much does it cost?" Daily use.
14. *Imam termin pri zdravniku.* — "I have an appointment at the doctor." Fixed chunk; trying to compose this live fails every time.
15. *Žal mi je, moja slovenščina ni dobra.* — "Sorry, my Slovene isn't good." Keeps doors open, buys goodwill, stops the English switch about 40% of the time.

**"Only 15" shortlist:** Items 1–15 above, in that order.

**Key reasoning:**
- The English-switch reflex is the enemy; #1 is the only countermeasure that works socially.
- Fixed chunks (#12, #13, #14) outperform stems in high-pressure moments; fluency is fake, pattern-matching is real.
- L-participle gender agreement (#11) is the single most common production failure for English speakers — skip generating it live, prepare fixed past-tense sentences instead.
- *Oprostite* and *hvala* disproportionately signal respect; locals respond differently to learners who use them vs those who don't.

**Confidence:** Medium — core items verified from daily use; some SL forms flagged from memory (supine distinction, participle agreement).

**Strongest counterargument:** A fluent-sounding fixed-chunk approach masks your actual level so well that locals accelerate their speech, assuming you're more advanced — the opposite problem. Some argue forcing yourself into stem-based generation earlier builds faster real competence, and the discomfort of slow generation is the cost of actual acquisition, not a failure to avoid.

---

## Agent 7 — Cognitive scientist of memory/retrieval (sonnet)

**Recommendation:**

**Family 1 — Meta/Repair (highest transfer, zero domain-lock)**
1. *Ne razumem.* — "I don't understand." Cue: blank stare moment. Error: omitting subject (it's pro-drop, so dropping is actually correct — English speakers over-insert). Transfer: every interaction. Cold-recall only.
2. *Lahko počasneje?* — "Can [you go] slower?" Cue: speaker's hand slowing down. Error: *Lahko bolj počasi? (acceptable but chunkier). Transfer: universal repair.
3. *Kako se reče ___?* — "How do you say ___?" Productive slot: noun/concept. Cue: pointing. This IS the generation effect — learner generates Slovene via the query itself.
4. *Prosim / Hvala.* — One chunk, paired. No retrieval cue needed; social pressure enforces encoding.

**Family 2 — Biti paradigm (tense unlock)**
5. *Sem / si / je / smo / ste / so* — One schema, six slots. Cue: introduce yourself, then a friend, then a group. Gender agreement on l-participle (*jedel/jedla*) is ONE schema (suffix swap), not two items — treat as one paradigm with a single cue sentence: *Jedel sem / Jedla sem* (male/female speaker saying "I ate"). Load = 1 schema.
6. *Bil/a sem ___.* — Past-be frame. Slot: adjective/location. Transfer: narrative, apology, excuse.

**Family 3 — Modal frame**
7. *Moram ___ [infinitive].* — "I must/need to ___." Cue: urgency situation (train leaving). Error: using *morati* with da-clause instead of bare infinitive.
8. *Rad/a bi ___.* — "I would like ___." Cue: menu/shop. Error: *Hočem (blunt). Gender agreement again = same l-participle schema as #5.

**Family 4 — Motion + supine (escape slot)**
9. *Grem ___[supine/na+Acc].* — "I'm going to ___." Cue: map/door. Supine = infinitive lookalike; one phonological rule covers it.

**"Only 15" Shortlist** (structured, not flat):
Family 1 (4 items) + biti paradigm as 1 schema + *bil/a sem* + *jedel/jedla sem* + *moram* frame + *rad/a bi* frame + *Grem* frame + *Kje je ___?* + *Koliko stane?* + *Eno ___, prosim.* + number 1–10 as single chunk = **15 schemas/chunks**.

**Key reasoning:**
- Meta/repair items transfer to 100% of contexts; scenario-bound chunks transfer to ~1. Spaced retrieval of *Ne razumem* fires in every session automatically.
- Gender agreement (*-el/-la*) is one phonological rule applied to one schema — it does not double load if introduced as a paradigm pair from day one.
- Abstract stems need a carrier sentence as retrieval cue, not a picture. *Moram* cue = "train is leaving in 3 minutes."
- 15 schemas with many reps each beats 50 items seen once. Chunking ceiling for durable cold recall in adults: ~5–7 independent schemas per session.

**Confidence:** high — retrieval-practice and transfer-appropriate-processing literature is unambiguous on transfer over coverage.

**Strongest counterargument:** A purely schema-based core starves the learner of enough surface vocabulary to actually deploy the frames — *Grem ___* is useless without 10 location nouns. The counterargument is right that lexical breadth is a prerequisite for frame productivity, which means the "15" must include at least one high-frequency noun family (body parts or food) even at the cost of a schema slot.

---

## Agent 8 — ASR/pronounceability realist (opus)

**Recommendation:**

**L1 META/REPAIR (front first — short, stressed, vowel-clear):**
- *Ja* / *Ne* — (c) yes/no gate every exchange. (d) PITFALL: *ne* (no) vs unstressed *ne-* negator vs *né*; ASR confuses with *na*; *ja* may transcribe as filler. (e) FLAG: enforce as isolated tokens.
- *Prosim* — please/pardon/repeat. (c) repair workhorse. (d) schwa: "prosəm" — second vowel reduces; teach stressed PRO-sim. (e) verify ASR accepts schwa variant.
- *Hvala* — (c) thanks. (d) clean: open /a/, /x/ maps to English "h". SAFE.
- *Ne razumem* / *Še enkrat* — (c) repair core. (d) *razumem* rolled-r + schwa-final; *enkrat* nasal cluster. PAIR with audio drilling.
- *Oprostite* — (c) excuse me/attention. (d) long but all open vowels, rolled r. Stressed and distinct — recognizes well despite length.

**L2 STEMS:**
- *Rad bi* + noun/inf — (c) "I'd like" unlocks all requests/desire. (d) dark-l risk: *rad* is fine, but *rada* (fem) gender-splits; *bi* tiny, mis-segments. SAFE-ish, FRONT. (e) verify *bi* not dropped.
- *Grem* (+ supine) — (c) motion/intent. (d) single stressed syllable, /grem/ clean. SAFE. FRONT. Supine (*spat, jest*) is the recognizer risk, not *grem*.
- *Moram* / *Lahko* + inf — (c) modal necessity/permission. (d) *lahko* = strong stressed CV syllables, highly recognizable — a top early win. *Moram* rolled-r. FRONT *lahko*.
- *Hočem* / *Želim* — want. (d) *č* and *ž* break English mouths AND ASR; DEFER in favor of *rad bi*.
- *biti + l-participle* (*sem jedel* / *bom jedel*) — (c) past/future unlock. (d) **THE PROBLEM CHILD**: clitic *sem* reduces to "sm", unstressed, drops under ASR; *jedel* → dark-l "jedu". Hard to produce AND recognize. DEFER; when taught, anchor on the *stressed* participle and accept "sm"/dropped clitic. Drill heavily.

**L3 BAKED-IN-CASE CHUNKS (memorize whole, never parse):**
- *Eno kavo, prosim* — (d) accusative baked; *kavo* clean open vowels. SAFE. FRONT.
- *Kje je …?* — where. (d) *kje* very short, mis-segments; *je* clitic. Pair *Kje je* as one stressed unit.
- *Koliko stane?* — how much. (d) clean syllables, no killers. SAFE.
- *Imate …?* — do you have. (d) clean. SAFE.

**IF ONLY 15 (ranked by speakability × leverage):**
1. Ja 2. Ne 3. Hvala 4. Lahko (+inf) 5. Prosim 6. Grem (+supine) 7. Rad bi 8. Eno kavo prosim 9. Koliko stane 10. Imate…? 11. Oprostite 12. Moram (+inf) 13. Kje je…? 14. Ne razumem 15. Še enkrat (prosim)

**Key reasoning:**
- Speakability gates leverage: I rank items by stressed-syllable strength and vowel clarity FIRST, frequency second. *Lahko* and *grem* beat *hočem* despite similar frequency because č/ž and clitics sink recognition.
- The biti compound-tense unlock is real but acoustically cursed — unstressed reducing clitics (sem→sm) + dark-l participles are the single hardest core to both produce and recognize. Defer and over-drill; never make it an early gate.
- Whole chunks (L3) dodge case morphology AND give the recognizer long, stressed acoustic targets — high yield, low risk. Front them.
- Tiny tokens (ja/ne/kje/je) are easy to say but mis-segment; bind clitics into stressed units (*Kje je*, *Rad bi*) so the recognizer gets a real word to lock onto.

**Confidence:** medium — phoneme/ASR failure modes (dark-l, schwa, clitic reduction) are well-established; exact per-item recognizer behavior depends on the specific ASR's Slovene model and must be verified against the actual engine.

**Strongest counterargument to your own view:** Deferring the biti+l-participle compound tenses may starve learners of past/future expression — arguably *the* unlock for "everyday communication" — for the sake of recognizer comfort. A learner who can only speak in present tense and memorized chunks isn't really communicating; they're operating a phrasebook. If the goal is genuine generativity, you may have to accept messy clitic recognition and front the hard stems anyway, treating ASR tolerance (not avoidance) as the design target.
