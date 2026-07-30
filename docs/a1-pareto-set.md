# The A1 Pareto set — the high-leverage learnables

The **Pareto set for Slovene A1**: the ~15–25 highest-ROI sentence stems, frames, glue elements, interrogatives
and verb cores that unlock the majority of the four-skill exam tasks, because A1 is heavily formulaic and
survival-oriented. Master these and most remaining vocabulary slots into patterns the learner already controls
(the Ferriss "deconstruct to the highest-ROI LEGO bricks" approach).

These are **learnables** — the app's atomic, context-independent, masterable building blocks
(vocabulary | chunk | pattern; docs/learnable-subsystem-spec.md). Pareto membership is recorded on the
learnable itself: **`core: true` + `paretoCategory: [...]`**. This *extends* the existing core/rank
high-leverage signal that already drives tutor selection ([mastery.ts](../server/mastery.ts)) — one importance
signal, not two. Categories: `identity` · `question` · `transaction` · `location_time` · `social_glue` ·
`verb_core` (many-to-many).

> Reviewed by `slovenian-author` (2026-07-30) for naturalness, citation form, and standalone viability, then
> minted. **Both the flagged set and the "to-mint" set below are now LIVE in the catalog** — 77 new learnables
> seeded via `npm run seed:catalog` (146 learnables total, all A1-mapped). Numbers were minted as plain
> supporting vocabulary (the Pareto flag stays on the stems/frames/glue). A few items were seeded on a
> sensible default and remain *verify with R* (see the decisions section).

---

## Flagged in the catalog now (already existed → tagged)

17 existing learnables were tagged `core: true` + `paretoCategory`:

| id | sl | paretoCategory |
|---|---|---|
| `koliko_stane` | Koliko stane? | question, transaction |
| `ali_imate` | Ali imate ___? | question, transaction |
| `rad_bi` | Rad / Rada bi ___. | transaction |
| `eno_femacc` | Eno ___, prosim. | transaction |
| `en_masacc` | En ___, prosim. | transaction |
| `dve_dualacc` | Dve ___, prosim. | transaction |
| `placam_s_kartico` | Lahko plačam s kartico? | transaction |
| `prosim` | prosim | transaction, social_glue |
| `dober_dan` | Dober dan. | social_glue |
| `hvala` | hvala | social_glue |
| `ne_razumem` | Ne razumem. | social_glue |
| `se_enkrat` | Še enkrat, prosim. | social_glue |
| `kako_se_rece` | Kako se reče ___? | social_glue |
| `ja` / `ne` | ja / ne | social_glue |
| `oprostite` | oprostite | social_glue |
| `govorim_slovensko` | Govorim slovensko. | identity, verb_core |

---

## To mint (author-reviewed spec — deferred to the catalog-seed flow)

Not yet in the catalog. Each will be authored/verified through `slovenian-author` → `scenario-critic` →
catalog-seed reconcile. Citation forms + errors below already incorporate the author's corrections.

### `identity`
| id | citation SL | gloss | kind | predictable error |
|---|---|---|---|---|
| `sem_ime` | Sem ___. | I am ___ (name) | P | the *Moje ime je ___* calque instead of the natural *Sem ___* |
| `pisem_se` | Pišem se ___. | my surname is ___ | P | calquing *moje ime je*; dropping reflexive *se* |
| `zivim_v` | Živim v ___. | I live in ___ | P | locative after *v* (*v Ljubljani*) |
| `sem_iz` | Sem iz ___. | I am from ___ | P | genitive after *iz* (*iz Amerike*) |
| `star_sem_let` | Star / Stara sem ___ let. | I am ___ years old | P | gender (*star*/*stara*); gen. pl. *let* after 5+ |
| `imam` | Imam ___. | I have ___ | P | accusative object; negation *nimam* (not *ne imam*) |
| `delam_kot` | Delam kot ___. | I work as ___ | P | *kot* + nominative profession; noun gender |

### `question` — interrogatives + stems
Interrogatives (vocabulary): `kdo`, `kaj`, `kje` (*vs* `kam`), `kdaj`, `kako`, `koliko` (+gen.), `od_kod`,
`kam` (*vs* `kje`), `zakaj` (*vs zato*).

| id | citation SL | gloss | kind | note / error |
|---|---|---|---|---|
| `kako_ime` | Kako ti / vam je ime? | what's your name? | C | **one learnable, both register forms folded in** (vi first); register diff IS the error |
| `od_kod_ste` | Od kod ste / si? | where are you from? | C | register ste/si |
| `koliko_star` | Koliko si / ste star(a)? | how old are you? | C | gender *star*/*stara*; register |
| `kje_je` | Kje je ___? | where is ___? | P | keep subject nominative |
| `kje_zivis` | Kje živiš / živite? | where do you live? | C | register |
| `kaj_delas` | Kaj delaš / delate? | what do you do? | C | register; job or current activity |
| `kaj_je_to` | Kaj je to? | what is this? | C | — |
| `ob_kateri_uri` | Ob kateri uri ___? | at what time ___? | P | *ob* + locative *uri* |
| `kako_pridem_do` | Kako pridem do ___? | how do I get to ___? | P | genitive after *do* |
| `govorite_anglesko` | Ali govorite angleško? | do you speak English? | C | **(added — top expat survival stem)** adverb *angleško*, not noun; no extra aux |
| `koliko_je_ura` | Koliko je ura? | what time is it? | C | **(added)** distinct from asking a schedule |
| `kako_ste` | Kako ste? / Kako si? | how are you? | C | **(added)** both forms folded; not a *delati* calque |

### `transaction`
| id | citation SL | gloss | kind | note / error |
|---|---|---|---|---|
| `lahko_dobim` | Lahko dobim ___? | can I get ___? | P | **(added — the natural everyday request; preferred over `zelim`)** accusative object; no extra verb |
| `zelim` | Želim ___. | I would like ___ (formal) | P | **narrowed to formal/bookings only** — do NOT teach as the everyday shop request |
| `z_gotovino` | Z gotovino. | with cash | C | **re-cited to the bare reply** (was *Plačam z gotovino.*); instrumental *z gotovino* |

### `location_time`
| id | citation SL | gloss | kind | note / error |
|---|---|---|---|---|
| `grem_v` | Grem v / na ___. | I'm going to ___ | P | *v* vs *na*; accusative of direction |
| `avtobus_gre` | Avtobus gre / pelje ob ___. | the bus goes at ___ | P | *gre* and *pelje* are **both** natural (coexist — not a pick); *avtobus* and *vlak* are distinct nouns → their own vocab; time = *ob* + locative number |
| `zjutraj` `popoldne` `zvecer` `jutri` `danes` | (adverbs) | morning/afternoon/evening/tomorrow/today | V | — |
| **clock time** | ob ___ (ob **petih**, ob **treh**, ob pol treh) | at ___ o'clock | P | **corrected:** clock time is *ob* + LOCATIVE of the number, not *ob ___ uri* — that frame is only valid for *ob eni uri* |
| **cardinals** | nič, ena, dva/dve, tri, štiri, pet, šest, sedem, osem, devet, deset (+ price-tens dvajset…) | numbers | V | mint each as its own vocab lemma (needed to *say* prices/ages/times); the en/eno/dve **agreement patterns** stay separate |

### `social_glue`
| id | citation SL | gloss | kind | note / error |
|---|---|---|---|---|
| `zivjo` | Živjo | hi / bye (informal) | V | most common casual greeting in Ljubljana; serves both hello and bye |
| `zdravo` | Zdravo | hi / bye (informal) | V | current informal greeting; also both hello and bye — a distinct lexeme, not a substitute for `zivjo` |
| `adijo` | Adijo | bye (informal) | V | leave-taking only |
| `lahko_noc` | Lahko noč | good night | C | evening leave-taking |
| `nasvidenje` | Nasvidenje | goodbye | V | neutral/formal-ish leave-taking; distinct from the chunk *Hvala, nasvidenje* |

*(The formal greetings are already in the catalog: `dober_dan` "Dober dan." daytime, `dober_vecer` "Dober
večer!" evening. The informal set above is a family of distinct learnables, not a single slot — greetings are
high-frequency glue and the A1 inventory itself lists several.)*
| `ponovite_prosim` | Ponovite, prosim. | please repeat | C | register; distinct from `se_enkrat` (repeat vs again) |
| `pocasi_prosim` | Počasi, prosim. | slowly, please | C | — |
| `vsec_mi_je` | Všeč mi je ___. | I like ___ | P | dative *mi*; plural subject → *všeč so mi* |
| `ni_mi_vsec` | Ni mi všeč. | I don't like it | C | — |
| `oprosti` | Oprosti | sorry (ti) | V | the *ti* form; `oprostite` is *vi* — both coexist |
| `hvala_lepa` | Hvala lepa. | thank you very much | C | *lepa* agrees with fem. *hvala* — the slip is *hvala lepo* |
| `me_veseli` | Me veseli. | nice to meet you | C | **(added)** — *verify priority with R* |
| `da` | da | yes (affirmation) | V | **kept** — a distinct lexeme from `ja` (colloquial), both common and both produced; `da` is the more formal/emphatic "yes". Not a duplicate. |

### `verb_core`
Most verb cores are already carried by the stems above (biti→`sem_*`, imeti→`imam`, iti→`grem_v`,
delati→`delam_kot`, živeti→`zivim_v`, priti→`kako_pridem_do`, plačati→`placam_s_kartico`/`z_gotovino`,
prositi→`prosim`, govoriti→`govorim_slovensko`). Genuinely new:

| id | citation SL | gloss | kind | note / error |
|---|---|---|---|---|
| `ne_vem` | Ne vem. | I don't know | C | high-frequency hedge; distinct from `ne_razumem` |
| `jem` | Jem ___. | I eat ___ | P | accusative object |
| `pijem` | Pijem ___. | I drink ___ | P | accusative object |
| `gledam` | Gledam ___. | I watch / look at ___ | P | accusative object |
| `kupim` | Rad bi kupil ___. / Kupil bom ___. | I'd like to buy ___ | P | **re-cited** — bare *kupim* reads future/generic; use *rad bi kupil* / *kupil bom*; gender on l-participle |
| `ne_govorim_dobro` | Ne govorim dobro slovensko. | I don't speak Slovene well | C | **(added)** top survival line; negative complement to `govorim_slovensko` |
| `hocem` | Hočem ___. | I want ___ | P | *hoteti* is a real high-frequency verb core — keep it. But do NOT teach *Hočem ___* as the polite **request** stem (it's blunt); requests go through `rad_bi`/`lahko_dobim`. Encode that register caveat in the error. *Verify with R whether to seed it.* |

---

## Decisions folded in (from the author review)

- **Reuse is by lexical identity, never by function.** Collapse two entries only when they are the **same
  item** — same lemma/frame/phrase, differing only by inflection, case, or spelling (`kavo`→`kava`, `Rada
  bi`→`rad_bi`). **Distinct commonly-used lexemes that share a communicative job are distinct learnables and
  all coexist** — never force a pick: `Živjo`/`Zdravo`/`Adijo` (greetings), `ja`/`da` (yes), `gre`/`pelje`
  (goes/runs), `rad_bi`/`lahko_dobim`/`želim`/`prosim` (ways to request). This is the DRY catalog rule (mint a
  *surface* once) read correctly; it was earlier over-stated as "one learnable per meaning", which is wrong.
- **Register (q2) — a judgment, not a blanket rule.** ti + vi variants of the **same construction** (*Kako si
  / Kako ste?*) are one item with an addressee-selected inflection — foldable into a single citation (vi
  first), the register difference encoded as the error, like `rad_bi` folds *rad/rada*. That's lexical
  identity, not two items — and it does NOT license collapsing distinct lexemes (above). Self-statements
  (*Sem…*, *Živim v…*) have no register axis. *If R prefers ti and vi as separate learnables per stem, that's
  equally valid — a packaging choice, not a rule.*
- **Numbers (q3):** do both — mint cardinals 0–10 (+ price-tens) as individual **vocabulary** lemmas (the
  learner must produce the lexemes to say prices/ages/times) AND keep the existing `en_masacc`/`eno_femacc`/
  `dve_dualacc` **agreement patterns** (a different lesson). Don't collapse into one mega-learnable.
- **Greetings are a family, not a slot:** mint the informal set (`zivjo`, `zdravo`, `adijo`, `lahko_noc`,
  `nasvidenje`) as distinct learnables — different lexemes, each its own high-frequency learnable.
- **Request frames are a family too:** `rad_bi` (exists), `lahko_dobim`, `eno_femacc`/`en_masacc` (exist),
  `prosim` (exists), and `zelim` (formal) all coexist — `zelim` is tagged *formal* so it isn't taught as THE
  everyday request, not removed.
- **Verify with R:** `me_veseli` priority; `hocem` seeding (register-risky); the ti/vi packaging choice
  above; `hej`/`čau` as additional informal greetings.

## Open — tracking against the exam itself
Progress today is measured against the learnables we happen to have. To measure against the **exam**, ingest
the official A1 inventory (centerslo *Sporazumevalni prag / Preživetvena raven* lists + the *izpit na vstopni
ravni* task catalog) as a separate `a1-inventory` reference — the authoritative denominator — so coverage
reads "X of the exam's N expected items covered" with an explicit gap list. The Pareto set is the
highest-priority slice of that inventory. Needs the real source lists (same sourcing as docs/a1-taxonomy.md);
not yet built.
