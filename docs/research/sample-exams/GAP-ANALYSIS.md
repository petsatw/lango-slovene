# A1 sample exams vs. the catalog — gap analysis

Source material: the official sample papers in this directory (`A1-ustno_vzorec.pdf` — speaking ·
`Vzorčni-izpit-A1_Poslušanje.pdf` — listening · `Vzorčni-izpit-A1_branje.pdf` — reading ·
`Vzorčni-izpit-A1_Branje-in-pisanje…pdf` — reading + writing · `Lestvica-VSTOP_govorjenje.pdf` — the
speaking scale). Compared against `server/catalog/learnables.json` as of 2026-08-23.

## Headline

**The catalog is a transactional-counter catalog, not an exam catalog.** 40 food/drink items, 24 social
formulas and 39 morphosyntax items cover *ordering something across a counter, in the first person*. The
A1 exam mostly tests something else: **describing, reading signs, and understanding times and dates.**

Three of the four exam papers contain whole tasks with essentially **zero** catalog support.

## Gaps by exam task

| Exam task | Support today | Verdict |
|---|---|---|
| **Speaking 1** — self-presentation (name, country, age, address, my flat, hobbies) | `sem_ime`, `sem_iz`, `star_sem_let`, `zivim_v`, `naslov` | **half** — no countries, no dwelling, no hobbies |
| **Speaking 2** — describe a picture (what / where / how many people / what are they like / what are they doing) | ~none | **not supported at all** |
| **Speaking 3** — situational role-play | strong for café/bakery/restaurant; the two sample pictures are a **party** and a **hotel reception** | **partial** |
| **Listening** — doctor, train, cinema, shop, market, pharmacy; times, prices, weather, opening hours | `ob_uri`, `koliko_je_ura`, `lepo_vreme`, `avtobus_gre` | **thin** |
| **Reading** — floor directory, prohibition sign, opening hours, ads, email, past-tense bio | `knjiznica`, `brezplacen` | **thin** |
| **Writing** (13 pts; A1 threshold 8) | declared out of scope in `a1-map.json` `_modes` | operator's call |

## The load-bearing holes

1. **Numbers stop at ten-and-round.** `enajst`–`devetnajst` and `šestdeset`–`devetdeset` are missing.
   Listening Naloga 3 literally asks 12 vs 21 vs 30 evrov.
2. **No ordinals, no floors.** Reading Naloga 1 turns entirely on `pritličje` / `prvo nadstropje`;
   Listening asks `V 1. / 3. / 8. razred`. Nothing in the catalog.
3. **No days, no months.** Zero. Reading task 1 hangs on `sobota` / `nedelja` / `od ponedeljka do petka`;
   the ads on `februarja`.
4. **No third-person verbs and no descriptive adjectives.** Every verb pattern is first-person (`Jem ___`,
   `Rad bi ___`). *Kaj delajo?* is unanswerable. Likewise no `moški` / `ženska` / `otrok` / `ljudje`, no
   `mlad` / `star` / `vesel` / `lep`.
5. **`To je ___.` is missing** — the most basic A1 sentence there is. So is `Na sliki je / so ___.`
6. **The rubric's own connectors are missing.** TEKOČNOST awards its point for *"osnovni povezovalci (in,
   potem)"*. Neither `in` nor `potem` nor `ampak` is in the catalog.
7. **`rad` + verb is missing.** `rad_bi` exists, but `Rad berem / kuham / hodim v hribe` — the hobby
   structure Speaking 1 asks for — does not.
8. **Health has 2 items.** The speaking rubric names it explicitly: *"Preprosto zna opisati težavo (npr.
   pri zdravniku)"*. No `boli me`, no `zdravnik`, no `tableta`.
9. **Places are missing.** `banka`, `pošta`, `trgovina`, `lekarna`, `kino`, `tržnica`, `hotel`, `postaja`,
   `šola` — the Listening paper's entire setting list.
10. **No past tense.** The Ita Rina text is a past-tense narrative; `bil sem` / `delal sem` / `rodil sem se`
    has no catalog entry.

## What to add — prioritized

### P0 — cheap, high point-yield (~70 items)
- Numbers 11–19, 60/70/80/90; `evro`/`evrov`, `cent`
- Ordinals 1.–12., `pritličje`, `nadstropje`, `razred`
- 7 days, 12 months, `teden`/`mesec`/`leto`/`vikend`, `od ___ do ___`
- Clock: `pol sedmih`, `četrt`, `minuta`, `točno`, `zamuda`
- Connectors: `in`, `potem`, `ampak`, `zato`, `ali` (or)
- `To je ___.`, `Na sliki je / so ___.`, `Tukaj je ___.`

### P1 — unlocks the two unsupported speaking tasks (~55 items)
- People & appearance: `moški`, `ženska`, `otrok`, `fant`, `dekle`, `ljudje`, `oseba`, `družina`; `mlad`,
  `star`, `visok`, `majhen`, `vesel`, `lep`
- 3rd-person action verbs: `dela`, `govori`, `je`, `pije`, `kupuje`, `čaka`, `sedi`, `stoji`, `kuha`,
  `gleda`, `se pogovarjajo`
- Masc. numeral + people: `trije / štirje ljudje`, `dve osebi`
- Places + `v`/`na` + locative pattern (list above), `doma`, `zunaj`, `mesto`, `ulica`
- Dwelling: `stanovanje`, `hiša`, `soba`, `kuhinja`, `kopalnica`, `blok`, `velik`, `majhen`
- Countries + `Sem iz Anglije` / `Sem Anglež/Angležinja`
- Hobbies: `rad` + verb pattern, `hobi`, `šport`, `glasba`, `branje`, `kuhanje`, `sprehod`
- Family: `žena`, `mož`, `otroci`, `sin`, `hči`, `brat`, `sestra`, `poročen sem`

### P2 — rubric-named and reading-paper (~50 items)
- Health/problem: `boli me ___`, `glava`, `trebuh`, `grlo`, `zob`, `slabo mi je`, `vročina`, `prehlad`,
  `zdravnik`, `recept`, `tableta`
- Travel/hotel: `vlak`, `vozovnica`, `peron`, `odhod`, `prihod`, `prtljaga`, `taksi`, `avto`,
  `z avtom / z vlakom` (instrumental-means pattern), `rezervacija`, `ključ`, `za dve noči`
- Sign/ad reading: `odprto`, `zaprto`, `prepovedano`, `vstop`, `izhod`, `pozor`, `informacije`,
  `odpiralni čas`, `popust`, `cena`, `delo`, `iščemo`, `oddamo`, `tečaj`, `prijava`
- Past tense: `bil sem`, `šel sem`, `delal sem`; letter conventions `Lep pozdrav`, `Hvala za ___`,
  `Veselim se`

## What this means for the band model

Three consequences worth carrying into the work in `docs/dialogue-difficulty-model.md §3`:

- **It explains a result we already saw.** Restaurant and bakery levels score as noun-heavy against the
  core because the catalog *is* food-and-counter shaped. That is a property of the inventory, not of
  those lessons.
- **Several P0 items are core, not merely A1-tagged.** `To je ___.`, `Na sliki je / so ___.`, and the
  connectors `in` / `potem` / `ampak` are exactly the Pareto-unlock frames the core is for — and the
  speaking rubric awards a point for the connectors by name. They should be minted `core: true`, not
  parked in the tagged superset.
- **A1 coverage will expand substantially**, which moves every band that is measured against it. Expect to
  re-run and review labels after the catalog pass, not before.

**Sequencing:** this pass should land *before* the per-node tagging of the 15 rehearsal dialogues.
Tagging lines against an inventory that is about to grow by ~175 items means tagging twice, and lines that
currently match nothing may match once the gaps are filled.
