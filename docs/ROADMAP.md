# Roadmap — where this is going

**The goal:** immersive, genuinely effective language learning that scales to any situation, any
learner, and any language — and that anyone can run and extend.

This doc is the map. Present state is in [ARCHITECTURE.md](ARCHITECTURE.md); here is the future state
and, from first principles, the pieces required to get there.

## The future state, plainly

- A learner says what they need to handle in Slovene — or the tutor suggests it — and gets an
  immersive scene to practice, on demand.
- The tutor **remembers them**: what they've mastered, what's still shaky, and brings it back at the
  right moment across sessions.
- The tutor **leads**: it notices what the learner cares about and takes them deeper or wider, instead
  of running a fixed script.
- It isn't only Slovene, and it isn't only ours: the engine is language-agnostic, and any builder can
  take it and run.

## First principles — what effective learning at scale requires

Effective acquisition needs: real, comprehensible practice in situations the learner actually faces;
the learner doing most of the talking and being corrected naturally; coverage of whatever they need;
memory over time so things harden; a tutor that adapts and leads; and the whole thing cheap enough to
run and open enough to spread. Each requirement maps to one piece below.

## The pieces

**Built**

1. **Real-situation practice that understands broken speech.** Hold-to-talk, mixed English/Slovene
   in, native Slovene out, corrections by recast. *(the turn loop)*
2. **The app owns the teaching.** Deterministic mastery rules in the server, prompt rebuilt from
   state each turn. *(single-session)*
3. **On-demand, quality-gated scenario generation.** Author → deterministic lint → independent
   critic → ship. *(runs today as an agent skill)*

**To build — in dependency order**

4. **Memory across sessions** *(unlocks 5).* A persistent learner model with an
   `attempted → completed → mastered` lifecycle: an objective reaches *mastered* only on repeated
   correct production, as the *same* objective recurs in different scenarios over time. Requires a
   **shared objective catalog** — common objectives (greet, ask-to-repeat, …) defined once and
   referenced by id across scenarios, so a correct production anywhere counts. This is also where
   **enforced uptake** lives — the highest-value mechanic from the research: an objective completes
   only via a *later, unaided (cold)* reproduction, never an in-session echo. It is deliberately out
   of the single-session MVP, where forcing it would just create a repetitive doom loop; it only works
   once the same objective can resurface across days and contexts.
5. **A tutor that leads, not just reacts.** An orchestration layer over the learner model that chooses
   what scenario/objective comes next from the learner's goals and history, schedules when things
   resurface, and lets the tutor go deeper or broader. This is the "tutor-as-agent" step — and its
   learner-facing surface: a selector of what to practice next and a "completed" review view, fed by
   the learner model.
6. **Content that scales without consistency collapse** *(unlocks multi-scenario depth and new
   languages).* ✅ **Largely shipped** (the asset-engine refactor): a shared **catalog** (objects,
   characters, composed **concepts**, voices) where everything is referenced by id; per-asset canonical
   renders composed on demand into a per-image labelled montage; identity-consistent characters +
   identity metadata; and a render-vs-rekey toolkit with **decision-gated** propagation (see
   [asset-pipeline.md](asset-pipeline.md)). *Remaining:* finish the three scene tableaux; an optional
   dependency-aware "what would re-rendering this invalidate" view.
7. **An engine anyone can run — any agent, any language.** The authoring procedure (rubric + gates +
   scripts) made tool-neutral, so it runs with Claude, Gemini, Codex, or a careful human — not only
   the Claude skill — plus a language/voice config seam so Slovene is the first target, not a
   hard-coded assumption.
8. **Sustainability.** Generated assets cost money to make. Serve them free now (a downloadable
   bundle), optionally as a paid bundle later, so generation cost can be recouped. *(started:
   `npm run fetch:assets`)*

## The critical path

Memory (4) is the keystone — it turns single sessions into real acquisition and is the precondition
for a tutor that leads (5). The asset refactor (6) is what lets content and languages scale without
breaking. Tool-neutrality (7) is what turns "my project" into "your engine." Everything else composes
around those three.
