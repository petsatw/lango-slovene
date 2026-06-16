# Stochastic Consensus — Slovenian App MVP Trilemma
Date: 2026-06-14 (UTC)
N=8 persona agents (sonnet) + 1 synthesis agent (opus)

## Problem
AI-assisted Slovenian language-learning app for EXPATS LIVING IN SLOVENIA. Trilemma: maximize (1) effective/immersive beginner acquisition, (2) highest appeal/excitement to expats, (3) minimal feature set delivering highest bang-for-buck on (1) in the style most appealing to (2). Goal: identify the single highest-leverage MVP vertical slice to build first to revive team momentum.

Personas: SLA acquisition scientist, expat-in-Slovenia ethnographer, consumer product/growth designer, lean-MVP indie hacker, AI/LLM systems architect, Slovenian linguist/culture specialist, behavioral/motivation designer, contrarian skeptic.

---

## Agent 1 — SLA Acquisition Scientist
**Recommendation:** AI conversation chat-tutor, 5-6 hyper-specific expat survival scenarios (grocery, doctor, government office, landlord, café, neighbor) with real-time inline correction + replay of corrected form.
**Reasoning:** Comprehensible input + pushed output in meaningful context = strongest acquisition driver. Core pain = "I freeze at the counter." Minimal build: chat UI + per-scenario system prompt + inline correction. SRS/flashcards downstream (beginners lack enough encounters to space).
**Confidence:** High.
**Counterargument:** Strong-form Krashen — pushed output premature for true beginners; massive listening input may be right first intervention; chat may feel punishing if too hard session one.

## Agent 2 — Expat-in-Slovenia Ethnographer
**Recommendation:** "Survival Slovenian Decoder" — real-time AI coach around exact dreaded moments: upravna enota, zdravstveni dom receptionist, landlord urgent call, cashier loyalty-card. Named, specific.
**Reasoning:** Emotional wound = shame/helplessness at recurring humiliating moments. Bureaucratic vertical uniquely defensible + uniquely Slovenian — Duolingo won't build it; both moat and marketing hook. MVP = single screen: pick scenario, speak/type, feedback on grammar/vocab/register.
**Confidence:** High.
**Counterargument:** Expats needing bureaucratic Slovenian are time-poor/anxiety-prone; may use Google Translate for the real appointment and only practice lighter café/market scenarios; shame-avoidance suppresses usage of hardest scenarios.

## Agent 3 — Consumer Product / Growth Designer
**Recommendation:** "Survival Scenario Chat" — single screen, pick context, live dialogue with inline corrections + "what did that mean?" tap, ends with 3-phrase cheat sheet they can screenshot and use that same day. Scenario picker IS onboarding.
**Reasoning:** Screenshot cheat-sheet = virality hook (expats share survival wins in FB/WhatsApp). Every other brainstorm feature is a retention feature needing an existing motivated user; this creates that user.
**Confidence:** High.
**Counterargument:** Pronunciation is the real wall; text-only builds false confidence; Whisper pronunciation coach might be the feature that converts a real-world interaction into a win.

## Agent 4 — Lean MVP Indie Hacker
**Recommendation:** "Overheard in Slovenia" — single screen, paste/type something actually heard or needed, get instant breakdown: meaning, how to respond, corrected version. No curriculum/levels/gamification.
**Reasoning:** Zero cold-start (users already have daily inputs). Thinnest slice: one field, one Claude call, structured response. Weekend build. Shareable: "I pasted the letter from the upravna enota and it told me what to do."
**Confidence:** High.
**Counterargument:** One-trick lookup tool, not a learning app; no systematic competence; may retain the anxious tourist not the committed learner.

## Agent 5 — AI/LLM Systems Architect
**Recommendation:** AI Conversation Tutor with Live Inline Corrections — text chat, Claude in-character, every error corrected inline + brief grammar explanation.
**Reasoning:** Structural moat Duolingo can't close (infinite adaptive generation vs finite content tree). Slovenian morphology learned through corrective feedback in context. LLM reliability acceptable IF constrained to survival scenarios w/ ~200-word vocab ceiling. Do NOT attempt pronunciation coaching in MVP — Whisper + Slovenian pitch accent unreliable; v2. Shippable 2-3 days, zero content authoring.
**Confidence:** High.
**Counterargument:** Contextual flashcards harvesting words user encountered that day may have higher emotional resonance.

## Agent 6 — Slovenian Linguist / Culture Specialist
**Recommendation:** AI chat-tutor with inline corrections, anchored in administrative/bureaucratic encounter (residence registration, bank, uradnik) — dreaded most, practiced least, highest gain.
**Reasoning:** Bureaucratic Slovenian formulaic/repetitive ("Prosim, ali bi mi lahko...", "Potrebujem potrdilo za...") so narrow vocab has outsized return; learners feel genuinely competent fast. Buildable in days.
**Confidence:** High.
**Counterargument:** Bureaucratic framing may feel joyless; warmer café/market may drive more delight/word-of-mouth. Rebuttal: frame as empowerment ("finally understand what they're saying"), not simulation of the stressful event.

## Agent 7 — Behavioral / Motivation Designer
**Recommendation:** AI chat-tutor framed as "Survive Slovenia" — scenario-driven, every session a real situation faced this week. Loop: speak/type, inline corrections, finish, unlock next. No gamification gimmicks.
**Reasoning:** Drop-off killer is IRRELEVANCE. Identity shift through small wins not streaks: succeed in app then do it for real, self-concept changes. Chat-tutor is trunk; pronunciation/drills/dialect are branches.
**Confidence:** High.
**Counterargument:** Pronunciation gap so severe that text-only builds false competence; voice-first w/ Whisper might be higher-leverage (addresses going blank when speaking).

## Agent 8 — Contrarian Skeptic
**Recommendation:** Do NOT build the app yet — run a paid workshop first.
**Reasoning:** Every brainstorm feature already exists (Duolingo/ChatGPT/Anki/Pimsleur); "Slovenian-flavored" is a wrapper not a moat. The trilemma is a distraction — real unknown is whether expats pay/return/refer. Momentum problem psychological not technical. 2-hr in-person workshop, 10 expats, €15/head, weekend, answers the real question. Bureaucratic Slovenian only genuinely underserved need.
**Confidence:** High.
**Counterargument (self):** Workshop is a local maximum, caps TAM, no scalable asset; a viral demo clip validates demand faster + free; contrarian instinct can become procrastination dressed as rigor.

---

## SYNTHESIS (opus)

### Consensus
7 of 8 agents (all but the skeptic) converged on: an AI conversation chat-tutor anchored in real expat survival/bureaucratic scenarios with inline correction. Shared points:
- Scenario-driven, not curriculum-driven (1,2,3,6,7).
- Bureaucratic/administrative vertical is the defensible moat (2,5,6, and even skeptic 8).
- Inline corrective feedback in context is the acquisition mechanism for Slovenian morphology (1,5,6,7).
- Real enemy is irrelevance/illusion; real wound is shame (1,2,7).
- Defer SRS/flashcards/gamification (1,5,3,7).
- Buildable in days, minimal content authoring (1,4,5,6).

### Genuine disagreements
1. **Text-first vs voice/pronunciation-first.** Text-first wins (Agent 5's phoneme-alignment reliability objection is concrete; voice raised only as a hedge). v2 question.
2. **Simulate the dreaded event vs decode/empower around it.** Empowerment framing wins (Agent 6; reinforced by Agent 2's shame-avoidance self-counter).
3. **Build now vs validate-first (skeptic).** Genuine judgment call, but skeptic self-concedes a viral demo clip validates faster and free.

### High-value outliers
- Agent 3: screenshot 3-phrase cheat-sheet = best growth mechanic, near-zero cost.
- Agent 4: "paste what you heard" = zero cold-start entry mode + best demo clip.
- Agent 8: the trilemma may be the wrong problem; real unknown is demand; "building feels like progress" trap.
- Agent 5: moat = infinite adaptive generation vs finite content tree (durable competitive story).
- Agent 6: bureaucratic Slovenian formulaic → narrow vocab, outsized return, feel competent fast.

### Recommendation
Build ONE thing: single-screen AI conversation chat-tutor for ONE bureaucratic/survival scenario — the upravna enota residence/registration encounter — text-based, inline correction, empowerment framing.
- Claude plays the uradnik in character, ~200-word vocab ceiling, formulaic register.
- Every typed attempt → inline correction + one-line English explanation of the case/ending fix.
- "What did that mean?" tap.
- Session ends with 3-phrase screenshot cheat-sheet (growth hook, day one).
- Fold in "paste what you heard" as secondary entry mode if cheap.

OUT of MVP: pronunciation/voice grading (v2), SRS/flashcards/levels/streaks/gamification, multiple scenarios beyond first one or two, authored curriculum.

Style: empowerment + comprehension, NOT stress simulation. "Finally understand what they're saying — and walk in knowing what to say."

De-risk skeptic cheaply, in parallel same weekend: (1) builder ships single-scenario slice; (2) post one demo clip into 2-3 Ljubljana expat FB/WhatsApp groups, measure asks/shares/"I'd pay." Answers demand question free, faster than a workshop, and produces a scalable asset.

### Confidence
High — 7/8 independent convergence on core mechanic + bureaucratic vertical; lone dissenter's concern cheaply addressable in parallel; remaining splits are v2 questions not MVP blockers.
