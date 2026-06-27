# Core pattern library — ranked by leverage (8-agent consensus, 2026-06-26)

The comprehensive set of items the expert panel proposed for the Slovene beginner CORE, deduped across
all 8 agents and **ranked by linguistic leverage** — generative power (how much language it unlocks) ×
ubiquity (how often it's needed). Each item is **typed** per the subsystem model
([learnable-subsystem.md](../../learnable-subsystem.md)).

Full synthesis: [SYNTHESIS.md](SYNTHESIS.md). All 8 raw agent outputs: [RAW-AGENT-OUTPUTS.md](RAW-AGENT-OUTPUTS.md).

**Type legend** — `seed` · `stem` · `chunk` are the three *pattern* types; `vocab` is the
*vocabulary* unit (a word or fixed phrase). See the subsystem doc for what each means and how each is
taught/scored.

> **Leverage rank ≠ teaching order.** This list ranks by raw leverage *in the language*. The panel's
> *teaching* order is repair-first (Family A) → frozen chunks → stems → seed; the highest-leverage item
> (`biti`) is taught with the most scaffolding, not first. See the synthesis "Staging order".

| # | Slovene | Gloss | Type | Why high-leverage | Agents |
|---|---|---|---|---|---|
| 1 | **sem / bom + -l** (`sem jedel` / `bom jedel`) | I did / I will (do) X | **seed** | Past **and** future for almost any verb from one auxiliary paradigm — the single deepest structural unlock. Hardest (gender agreement, clitic, ASR) → seeded early, mastered late. | 1,2,3,4,5,7,8 |
| 2 | **Moram + INF** (`Moram plačati`) | I must / have to ___ | **stem** | Obligation + any dictionary verb; the *safest* stem (infinitive is morphologically inert). | 2,3,4,5,6,7 |
| 3 | **Rad / Rada bi + INF** (`Rada bi kavo`) | I'd like to ___ | **stem** | Polite request engine for shops/café; `bi` is person-invariant; own-gender form fixed once. | 1,2,3,5,6,8 |
| 4 | **Lahko + FINITE** (`Lahko plačam?`) | May / can I ___ | **stem** | Permission/ability; **the finite-not-infinitive trap** English speakers must absorb. | 1,2,3,5,8 |
| 5 | **Želim / Hočem + INF** | I want to ___ | **stem** | Want + any verb (rad bi preferred for politeness + ASR; č/ž break English mouths). | 2,3,5 |
| 6 | **Grem + SUPINE** (`Grem jest`) | I'm going to (do) ___ | **stem** | Intention/motion + any verb; supine (`jest`) not infinitive (`jesti`). | 3,5,6 |
| 7 | **Kako se reče ___?** | How do you say ___? | **stem** | Generates vocabulary on demand — the query itself is the generation effect; self-feeding input. | 1,2,3,4,5,6,7 |
| 8 | **Ne razumem** | I don't understand | **chunk** | The universal repair opener; reached for ~20×/day; keeps the conversation alive. | 1,2,4,6,7,8 |
| 9 | **Lahko po slovensko, prosim? Se učim.** | Can we do Slovene? I'm learning. | **chunk** | The anti-English-switch move — buys the right to keep practising; arguably #1 by lived ROI. | 6 |
| 10 | **Še enkrat, prosim** / **A lahko ponovite?** | Again, please / can you repeat? | **chunk** | Core repair; `a` (not `ali`) is the spoken register. | 1,2,3,4,6,8 |
| 11 | **Bolj počasi, prosim** / **Lahko počasneje?** | Slower, please | **chunk** | Locals speak full speed even to beginners; keeps input comprehensible. | 1,2,3,4,6 |
| 12 | **Kje je ___?** | Where is ___? | **stem** | Navigation/location across every place; case mostly masked at the surface. | 3,5,6,7,8 |
| 13 | **Eno kavo, prosim** (slot: `eno pivo` / `en čaj`) | One ___, please | **chunk** | The ordering workhorse; accusative baked in — produces correct case without knowing case. | 1,2,3,5,6,7,8 |
| 14 | **Koliko stane?** | How much is it? | **chunk** | Every transaction; fully frozen, zero morphology exposed. | 1,2,3,5,6,7,8 |
| 15 | **Imam / Imate ___?** | I have / do you have ___? | **stem** | Possession/availability; high-frequency in shops/clinics. | 4,5,6 |
| 16 | **Kaj je to?** / **Kaj pomeni ___?** | What is this? / What does ___ mean? | **chunk / stem** | Identify an unknown object or word; decodes the environment. | 1,3,4,5,6 |
| 17 | **Prosim za ___** | ___, please / I'll have ___ | **stem** | Request frame; partially dodges case via the `za` chunk. | 1,2 |
| 18 | **Govorite angleško?** | Do you speak English? | **chunk** | Emergency exit; prevents total communicative collapse (signals defeat — last resort). | 1,2,4,6 |
| 19 | **Prosim / Hvala / Oprostite** | Please / thank you / excuse me–sorry | **vocab** | Ambient social lubricant; disproportionate goodwill payoff; `Oprostite` doubles as "excuse me" to a stranger. | 1,2,3,4,5,6,8 |
| 20 | **Ja / Ne** (+ `ne` negation, `no`/`aha` backchannel) | Yes / no | **vocab** | Highest-frequency discourse tokens in spoken Slovene; gate every exchange. | 2,8 |
| 21 | **Dve ___** (`Dve kavi`) | Two ___ | **chunk** | The dual, frozen — count to two daily without learning dual morphology. | 5 (1 defers) |
| 22 | **Se učim** / **Slabo govorim slovensko** | I'm learning / I speak Slovene badly | **chunk** | Sets the "new to the language" context; lowers the bar, keeps doors open. | 1,6 |
| 23 | **Prosim, napišite** | Please write it down | **chunk** | Bypasses the phonology/listening bottleneck entirely. | 4 |
| 24 | **Numbers 1–10** | — | **vocab** | Quantity for any order/price/time; one tight set. | 7 |
| 25 | **Račun prosim · Za s sabo · Imam termin pri zdravniku · Žal mi je, moja slovenščina ni dobra · Ne vem** | bill please · to-go · I have an appointment · sorry, my Slovene isn't good · I don't know | **chunk** | Scenario-bound survival fixed-phrases; compose-live fails, memorize whole. | 5,6 |

## Verification flags (native must confirm before any of these are canonical)

Load-bearing forms the panel flagged as unconfirmed or contradictory:

- **`Lahko` + finite vs. infinitive** — confirm `Lahko plačam?` correct / `Lahko plačati?` wrong. *Highest priority — a direct inter-agent contradiction (#4 vs. Agent 3's listing).*
- **Supine after motion** — `Grem jest / spat / kupit`, not `jesti / spati / kupiti` (#6).
- **`sem`/`bom` + l-participle** — participle forms and clitic placement (Wackernagel/2nd position) in a real beginner utterance (#1).
- **Repair register** — `Še enkrat, prosim` vs. `A lahko ponovite?` vs. `Ponovite prosim`; confirm `a` not `ali` (#10).
- **"I speak Slovene badly"** — `Slabo govorim slovensko` vs. `Malo govorim slovensko`; confirm + gender-neutrality (#22).
- **Acc-baked chunks** — `Eno kavo / eno pivo / en čaj` article+case agreement per noun gender (#13); dual `Dve kavi` (#21).
- **Pro-drop** — `Se učim` standing alone is natural (#22).
- **vikanje defaults** — `Govorite`, `Ponovite` are the safe formal default with strangers.

The route to confirm: the `slovenian-author` → `scenario-critic` gate, run on this list (not freehanded).
