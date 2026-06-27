# Synthesis — Slovene beginner CORE library (8-agent stochastic consensus)

**Date:** 2026-06-26 · **Panel:** N=8, mix (4 opus, 4 sonnet) · **Synthesis:** opus
**Question:** the Pareto 10% of fixed phrases + high-leverage stems that unlocks ~90% of everyday
Slovene for an adult absolute beginner, reusable as a permanent scaffold. This core becomes the shared
cross-session objective catalog (now the [Learnable Subsystem](../../learnable-subsystem.md)).

Ranked, typed item list: [RANKED-PATTERNS.md](RANKED-PATTERNS.md). Full raw outputs: [RAW-AGENT-OUTPUTS.md](RAW-AGENT-OUTPUTS.md).

---

## Consensus

**Repair/meta operators are foundational and high-transfer.** All 8 agents include a repair set. Converged forms: *Ne razumem* (1,2,4,6,7,8), *Kako se reče ___?* (1,2,3,4,5,6,7), a slow-down/repeat operator *Bolj počasi/počasneje prosim* or *Še enkrat prosim* (1,2,3,4,6,8), *Govorite angleško?* (1,2,4,6 — emergency-only per 1,4,6), ambient lubricants *Prosim/Hvala/Oprostite/Ja/Ne* (1,2,6,7,8). Agent 7: meta/repair transfers to ~100% of contexts vs ~1 for scenario chunks.

**The modal+verb stem is a top-tier productive engine.** Agents 2,3,4,5,6,7,8 rank *Moram+inf* and a polite-want construction highly. *Moram* singled out as safest stem (infinitive morphologically inert — 3,4,5).

**Rad/Rada bi + infinitive beats želim/hočem** — 1,2,3,5,6,8. *bi* is person-invariant (3), sounds native (1), and č/ž in hočem/želim break English mouths + ASR (8).

**One gender, chosen once, never toggled.** Agents 3,6,7 — the learner's own form (rad/rada, jedel/jedla) is invariant for that speaker.

**Pro-drop: teach subject-dropping** — *Se učim* not *Jaz se učim* (1,3,7). **Pogovorni over knjižni; vikanje with strangers** — 1,6; use *a* not *ali*.

**Baked-case survival chunks stable across nearly everyone:** *Eno kavo prosim* (1,2,3,5,6,7,8), *Koliko stane* (1,2,3,5,6,7,8), *Kje je ___* (3,5,6,7,8), *Prosim za ___* (1,2). Taught frozen.

**biti+l-participle is the deepest unlock AND the hardest item.** Double-unlocks past+future periphrastically (2,3,4,5,7); single hardest — gender + clitic placement + ASR-cursed (1,3,4,8). Agreement on *what it is*; split is *when*.

**Aspect and dual productive morphology: defer** (5 explicit; 2,4 by omission). **Lahko takes a FINITE verb, not infinitive — the English trap** (1,5: *Lahko plačam?* not *lahko plačati*; Agent 3 must reconcile).

## Genuine disagreements

**(a) biti+l-participle: front vs defer.** Front — 2,3 (frequency/leverage). Defer — 4 (Pienemann: emerges, can't be installed; forcing → fossilization), 8 (acoustically cursed: sem→'sm', jedel→dark-l). **Resolution (not averaging):** Agent 7's schema-compression — *seed it early as a lexicalized set, drill long, don't expect productive generation soon.* Separate seeding (early) from mastery expectation (late).

**(b) Case: teach vs bake.** One productive rule (fem acc -a→-o, Agent 5) vs bake everything (5's own counter + 4,7). **Resolution: bake everything for the CORE** — a half-rule that silently outputs *Imam pes* violates "permanent scaffold." Surface -a→-o only as optional noticing.

**(c) Repair-first vs frequency-first.** Near-unanimous repair-first once Agent 2 concedes it. **Frequency = what to install eventually, not first.**

**(d) Dual.** Defer (1) vs one frozen chunk (5). **Resolution: include *dve ___* as one optional frozen chunk; zero dual morphology.**

**(e) Core size.** **15 is right, but must decompose into ~5-7 genuine schemas + frozen chunks** (Agent 7's durable cold-recall ceiling), not 15 independent paradigms.

**The one judgment call:** seed biti early + tolerate messy ASR/output (8's counter, 2/3 leverage) vs hold it back to prevent fossilization (4). *Decision taken: front it as a `seed` type — see [learnable-subsystem.md](../../learnable-subsystem.md).*

## High-value outliers

- **Agent 6 — *Lahko po slovensko, prosim? Se učim.*** Stops the locals' English-switch that nullifies all practice. Arguably the #1 phrase by lived ROI.
- **Agent 7 — carrier-sentence as retrieval cue** for abstract stems (each ships with a situational trigger, not a translation). Shapes the objective-catalog schema.
- **Agent 8 — pair clitics into stressed units** (*Kje je*, *Rad bi*) or ASR mis-segments.
- **Agent 5 — motion+SUPINE** (*Grem jest*, not *jesti*).
- **Agent 4 — *Prosim, napišite*** to bypass the phonology/ASR bottleneck.
- **Agent 3 — stage modal→rad bi→biti**, each reusing the infinitive slot.

## Recommendation (the panel's grouped library)

**Family A — Meta/Repair (FIRST; ~100% transfer):** Ne razumem · Lahko po slovensko, prosim? Se učim. · Še enkrat / Bolj počasi, prosim · Kako se reče ___? · Kaj je to? / Kaj pomeni ___? · Prosim, napišite · Govorite angleško? (emergency) · Prosim/Hvala/Oprostite/Ja/Ne

**Family B — Productive stems (each reuses the INFINITIVE slot):** Moram + inf → Rad/Rada bi + inf → Lahko + FINITE verb (*Lahko plačam?*) → Grem + SUPINE (*Grem jest*)

**Family C — biti + l-participle (SEED early, master LATE):** Sem bil/bila + seeded *sem šel/šla, sem jedel/jedla, sem rekel/rekla*; *Bom + l-participle* (future) after past is stable

**Family D — Baked-in-case chunks (frozen):** Eno kavo prosim (slottable) · Dve ___ prosim · Koliko stane? · Kje je ___? · Imam/Imate ___? · Prosim za ___

**Staging order:** A (repair) → D (frozen chunks) → B (stems: moram→rad bi→lahko+finite→grem+supine) → C (biti: seed during B, master after).

## Confidence

**Medium-high.** Strong convergence on inventory, repair-first ordering, and rad-bi-over-želim. The one genuine unresolved split was the *timing* of biti+l-participle (resolved here as seed-early/master-late). Hard dependency on the native-speaker verification list (see [RANKED-PATTERNS.md](RANKED-PATTERNS.md)) — several load-bearing items (Lahko+finite, supine forms, clitic placement, slabo vs malo) currently unconfirmed.
