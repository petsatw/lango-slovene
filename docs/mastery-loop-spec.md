# Mastery Loop — Feature Spec (MVP)

**Date:** 2026-06-15
**Goal:** One session that leaves a beginner able to *produce* a small, real, usable Slovenian exchange themselves — and feel they can do it for real tomorrow. Mastery = production, not recognition.

## The tutor's role (the scoped actor)
The tutor has exactly two jobs, and the app constrains it to them:
1. **Approachable role-play actor** — plays the scene character (barista, etc.), keeps it alive and immersive, **always in Slovenian**, in **short** turns that leave the student room to talk.
2. **Recast corrector** — when the student is off, it simply says the corrected form back, in character (no lecture, no English grammar talk). The student internally adjusts and chooses to **repeat** or **move on** — knowing a corrected form will resurface naturally before the session ends, because mastery is the goal.

The tutor also **knows what the student is learning** (the session objectives) and gently steers toward them, while allowing a brief conversational tangent before returning.

## Session model
A **scenario** has an ordered list of **micro-objectives**:
```
Objective { id, label (EN, for the UI dot), targetSL (canonical correct phrase), hintEN (internal, never lectured) }
```
Per-session each objective carries **state**: `status: pending → recast → completed`, `attempts`.

Café scenario (active) objectives:
1. `greet` — "Dober dan."
2. `order_coffee` — "Eno kavo, prosim." (accusative; common error: "ena kava")
3. `with_milk` — "Z mlekom, prosim." (instrumental; common error: "z mleko")
4. `pay_leave` — "Koliko stane? … Hvala, nasvidenje."

## The loop (one turn)
```
client sends: student audio (WAV) + conversation history + current SessionState
  → server builds the tutor prompt FROM the session (objectives + their statuses)
  → E2 model returns structured JSON:
        { user_said, reply_sl (short, Slovenian), correction (EN note or ""),
          objective_progress: [ {id, result: "completed" | "attempted"} ],
          focus_objective_id }
  → server applies DETERMINISTIC mastery rules → updated SessionState
  → returns reply text + correction + updated session
  → client renders dots, streams audio (/api/speak), shows takeaway if complete
```

## Mastery rules (deterministic, server-owned — not left to the model's whim)
- model verdict `completed` (student produced the target acceptably) → status `completed`.
- model verdict `attempted` (tried, needed a recast) → status `recast` (must resurface).
- a `recast` objective becomes `completed` only once produced correctly on a later turn (the spiral payoff).
- session `complete` when **all** objectives are `completed`, or a turn cap (14) is hit.

## Tutor turn policy (enforced via the prompt)
- `reply_sl` is **Slovenian only**, **one short sentence** (+ optionally one short question). Never English in the spoken reply.
- **Recast, don't lecture**: model the correct form naturally in `reply_sl`; put the plain-English "what changed" only in `correction` (shown as a subtle UI note, never spoken).
- **Steer** to the first non-completed objective; **re-elicit** any `recast` objective before finishing (interleaving).
- **Brief tangents allowed**, then return to the objective.

## UI
- **Objective dots** (pending ☐ / recast ◐ / completed ☑) — felt progress.
- **Recast note** under the tutor bubble (`↳ eno kavo (not ena kava)`) + the existing ▶ replay.
- **Takeaway card** on completion: "You can now order a coffee in Slovenian" + each completed `targetSL` with a ▶.

## Where it lives (integration)
- **`server/scenarios.ts`** — scenario + objectives data (active café; planned scenarios stubbed).
- **`server/prompt.ts`** — `buildSystemPrompt(scenario, session)` encodes objectives + statuses + turn policy + JSON contract.
- **`server/adapters/gemini.ts`** — structured-output schema extended with `objective_progress` + `focus_objective_id`.
- **`server/orchestrator.ts`** — session-aware `understand()`; applies the deterministic mastery rules.
- **`server/server.ts`** — `/api/turn` takes & returns `SessionState`; `/api/config` exposes objectives + the scenario list.
- **`public/app.js`** — holds `SessionState`, renders dots + takeaway.

Maps to ARCHITECTURE seams #1 (session/objective state), #2 (tutor turn policy), #4 (sequencing).

## Scope
- **MVP (build now):** everything above — text + audio mastery loop, one café scenario.
- **PLANNED (stubbed, not built):** scenario selector / choose-your-own-adventure (Feature 1), visual story panels (Feature 2), latency Level-2 streaming. See ARCHITECTURE.md › Planned features.
