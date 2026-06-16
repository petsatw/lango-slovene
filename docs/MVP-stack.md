# MVP Stack — Functional Requirements (Provider-Agnostic)

**Project:** AI-assisted Slovenian language tutor for expats living in Slovenia
**Scope:** Live voice demo — one scenario (café / *upravna enota*), beginner speaks mixed English+Slovenian, AI responds in native-equivalent Slovenian with inline correction.
**Date:** 2026-06-14

This document defines the stack as a set of atomic functional capabilities, deliberately stripped of vendor names so each role can be mapped to a provider later (and verified against the current market). Derived from the stochastic-consensus run in [.consensus-runs/2026-06-14-tech-stack-voice-audio.md](../.consensus-runs/2026-06-14-tech-stack-voice-audio.md).

---

## The bar for the MVP

The MVP is the **simplest atomic feature set that is immediately compelling and useful** — the test is: *do they beg to keep using it?* Every capability is judged against two filters:

1. **Function** — does the demo work end-to-end without it?
2. **Wow** — does it create the experience that drives repeat use?

- **Essential / non-negotiable** = required to pass *both* filters. Remove it and the demo either breaks or stops being compelling.
- **Recommended** = passes the wow filter (meaningfully improves repeat-use) but the demo still functions without it.
- **Optimization / scaling** = improves cost, scale, or long-term quality but does nothing for the first-impression wow — defer it.

---

# Part 1 — The Essential Stack (non-negotiable)

This is the simplest stack that produces a compelling demo. **If you built only these five, you'd have something people beg to keep using.**

### E1. Voice input (push-to-talk capture)
- **Requirement:** Let the learner *speak* — mixed-language, hesitant, mid-word — and deliver the turn as a clip.
- **Why non-negotiable:** Voice is the entire thesis. Text is the problem translation apps already solved; the wow is speaking and being understood. Push-to-talk gives deterministic turn boundaries with zero risk of cutting a beginner off.

### E2. Code-switch-native understanding + in-character tutoring *(the linchpin)*
- **Requirement:** A single native-audio multimodal model that interprets English+Slovenian *in the same utterance* (robust to wrong cases and fragments) **and** reasons in character — staying in scenario, generating a correct Slovenian reply.
- **Why non-negotiable:** This *is* the magic moment — "I spoke broken mixed Slovenian and it understood me." Understanding and reasoning are fused into one model (one hop, no seam); they are not separable parts.
- *Subsumes the former "dialogue reasoning" element — it is the same model, not a distinct component.*

### E3. Native-quality Slovenian speech output
- **Requirement:** Convert the reply text to **native-speaker-equivalent** Slovenian audio — correct pitch accent, vowel length, dual forms.
- **Why non-negotiable:** This is a pronunciation/immersion product. A robotic or foreign-accented voice both destroys credibility with native-speaker testers and actively teaches the learner's ear the wrong sounds. The output must come from a dedicated native-quality voice, **not** the understanding model's own speech (its Slovenian is prosodically foreign).

### E4. The tutor prompt (scenario + safe vocabulary + spoken-recast correction)
- **Requirement:** A structured system prompt that holds one scenario, keeps the model inside a high-frequency/formulaic vocabulary zone where its Slovenian is reliable, and delivers corrections as **spoken recasts** — the tutor naturally re-uses the corrected form in its reply.
- **Why non-negotiable:** The correction is what makes this a *tutor* and not a chatbot — the product's reason to exist. Constraining the vocabulary is what stops the model from embarrassing itself with wrong Slovenian. Both are essential, and both are nearly free because they live entirely in the prompt.
- *Subsumes the former "scenario definition," "correction delivery," and "output-correctness guardrail" elements — they are all facets of one prompt.*

### E5. A thin app that runs the loop and is reachable
- **Requirement:** A minimal surface that orchestrates the turn loop (capture → understand → speak → play) and is accessible via a link.
- **Why non-negotiable:** Some sequencing glue and some interface must exist. A browser app with a shareable link is the lightest form **and** doubles as the momentum hook — drop the link in the WhatsApp group.

### Essential data flow
```
[E1] speak (push-to-talk)
   → [E2] native-audio model: understand mixed EN+SL + reason in character → Slovenian text
        (+ spoken-recast correction & scenario/vocab guardrail from [E4] prompt)
            → [E3] native-quality Slovenian TTS → audio
   [E5] thin app runs the loop and is reachable by link
```

---

# Part 2 — The Full Recommended Stack (essentials + recommended)

The complete stack for the demo: the five essentials above, **plus** the recommended additions below. Each recommended item is justified against the wow filter — it earns its place by increasing the chance they beg to keep using it, even though the demo functions without it.

| # | Capability | Status |
|---|---|---|
| E1 | Voice input (push-to-talk) | **Essential** |
| E2 | Code-switch understanding + tutoring (one model) | **Essential** |
| E3 | Native-quality Slovenian TTS | **Essential** |
| E4 | Tutor prompt (scenario + vocab guardrail + recast correction) | **Essential** |
| E5 | Thin app (turn loop + reachable surface) | **Essential** |
| R1 | Streaming / chunked playback (latency hiding) | **Recommended** |

### R1. Streaming / chunked playback (latency hiding)
- **Requirement:** Play the reply sentence-by-sentence as it synthesizes, instead of waiting for the whole utterance.
- **Why only recommended (not essential):** The demo functions without it — synthesize-then-play works, just with a longer pause before the tutor speaks.
- **Why it clears the bar (justifies "recommended"):** Turn latency is the single biggest driver of whether a voice exchange feels *alive* versus *clunky*. Shaving the dead air from the understand→speak seam materially increases the "I want to keep talking to this" feeling. It is cheap to add and high-leverage on the wow filter, so it's a strong recommend — build it the moment the essentials work.

> On review, R1 is the **only** capability that is both non-essential to function and clearly bar-clearing for the MVP. Everything else collapsed into the essentials, or was demoted (Part 3) or deferred (Part 4).

---

# Part 3 — Reviewed and demoted (did NOT clear the MVP bar)

Candidates that look like reasonable "recommended" additions but fail the *do-they-beg-to-keep-using-it?* test, and so are pushed to scaling rather than the MVP:

### Continuous streaming capture + automatic voice-activity detection (VAD)
- **Why it looks recommended:** Removes the push-to-talk button; more natural, hands-free turn-taking.
- **Why it fails the bar:** Automatic endpointing **cuts hesitant beginners off mid-thought** — exactly our target user, who pauses to assemble a sentence. That frustration actively reduces repeat use. Push-to-talk (E1) is simpler *and* better UX for this audience. Net negative for the MVP. → *Moved to Optimizations & Scaling.*

### Live text caption / overlay of corrections during the turn
- **Why it looks recommended:** Show the learner their mistake in writing as it happens.
- **Why it fails the bar:** In a live *audio* exchange, a text overlay splits attention and breaks immersion. The spoken recast (E4) carries the correction without the cost. (A text transcript belongs to a *separate review mode*, not the live loop.) → *Out of MVP; revisit as a review feature.*

---

# Part 4 — Optimizations & Scaling (post-MVP)

These improve cost, scale, or long-term quality but add nothing to the first-impression wow. Deferred deliberately.

- **Cost-optimized understanding model.** For the demo, use the most mature/validated native-audio model even at higher per-minute cost — reliability beats unit economics this week. At product scale, re-evaluate a cheaper native-audio model (potentially ~100× lower input cost); its Slovenian advantage is currently unbenchmarked, so this is gated on the A/B test below. *(This was the former "selection criterion" element — it is a scaling decision, not a runtime component.)*
- **Confidence-gated hybrid ASR/audio segmenter.** Route clean monolingual spans to cheap ASR and only ambiguous spans to the full audio model. A real cost play later; unnecessary now (and beginners produce the most ambiguous spans, where it helps least).
- **Continuous streaming + VAD turn-taking.** The hands-free product experience — once endpointing can be tuned not to cut off slow speakers.
- **Voice clone of a consenting native speaker.** Strongest long-term quality and a genuine moat, but carries consent/withdrawal legal liability and edge-phoneme degradation. Adopt only with the dedicated TTS retained as a permanent fallback.
- **Self-hosted open TTS.** Near-zero marginal voice cost; a scale-cost backstop if per-character TTS pricing bites. Demo-grade quality + ops burden today.
- **Separate dedicated reasoning model.** Only if a different model proves materially better at Slovenian pedagogy than the understanding model — adds a hop for an unproven gain.
- **Post-generation grammar validation / native-authored response seeding.** Stronger correctness guarantee once scenarios broaden beyond the safe formulaic vocabulary zone.
- **Fine-tuning or a RAG scenario library.** Needed when many scenarios demand consistency; overkill for one.
- **Native mobile app.** Better long-term home; slower to ship and no frictionless share link, so not for the first demo.

---

## Cross-cutting action that de-risks the whole stack
The choice of understanding model (E2) and the confirmation that a dedicated voice (E3) truly beats the model's own speech both rest on the *same* unmeasured fact: **relative Slovenian quality.** Before locking vendors, run a **blind native-speaker A/B** on (a) comprehension of code-switched input and (b) output naturalness. That single test resolves the open questions in Part 4's cost-optimization item.

## Notes
- Exact providers and pricing are intentionally omitted and must be verified against the current market before build (model availability and real-time pricing move fast).
- "Deferred" items are explicit product-phase roadmap candidates, not rejected ideas.
- Compelling-ness also depends on product features documented elsewhere (e.g. the end-of-session screenshot cheat-sheet) that sit above the stack and are out of scope here.


Current Landscape: 

**Here’s a clear, realistic cost comparison** for **15 minutes of back-and-forth conversation** (60% student audio input, 40% tutor output) using the top providers capable of E2 (native-audio multimodal understanding + reasoning) and E3 (dedicated native-quality Slovenian TTS).

### Key Assumptions (Transparent & Conservative)
- **Total session**: 15 minutes wall-clock time (push-to-talk, with natural pauses/thinking time typical for beginners).
- **Student input (E2)**: **9 minutes** of actual spoken audio (60%). This is the audio sent to the multimodal model. Hesitant/mixed beginner speech is accounted for in duration.
- **Tutor output (E3)**: **6 minutes** of tutor speech. This drives the text volume sent to TTS.
  - Realistic speaking rate for clear tutor speech: ~140 words/minute.
  - ~5.5 characters per word (Slovenian + English mix + punctuation) → **~770 characters per minute** of speech.
  - Total tutor text: **~4,620 characters**.
- **E2 billing**: Primarily on audio input duration/tokens. I used industry-standard ~25 tokens per second of audio (confirmed across Google and similar multimodal models in 2026 data) where needed for token-based pricing. Real usage may vary ±20%.
- **E3 billing**: Strictly on characters of generated text.
- **Pricing**: Mid-2026 rates from official sources (OpenAI, Google, Alibaba/Qwen, ElevenLabs, Azure). Includes typical tiers (e.g., Flash variants). Free quotas, caching, and volume discounts can lower this further (noted below). No app hosting costs (negligible at demo scale).
- **Important**: These are **E2 + E3 only**. We assume dedicated TTS (per original stack recommendation) rather than full speech-to-speech realtime output from E2.

### Cost Comparison Table (USD per 15-min session)

| E2 Provider (Audio Understanding) | E3 Provider (Slovenian TTS) | Est. E2 Cost (9 min audio) | Est. E3 Cost (~4,620 chars) | **Total Est. Cost** | Key Notes |
|-----------------------------------|-----------------------------|----------------------------|-----------------------------|---------------------|-----------|
| **OpenAI GPT-Realtime-2** | ElevenLabs (Flash v2.5 / v3) | **$0.40 – 0.50** | **$0.23 – 0.30** | **$0.65 – 0.80** | Highest quality realtime surface. Audio input is the expensive part ($32/1M tokens). Strong but priciest overall. |
| **Google Gemini 3 Flash** (recommended) | ElevenLabs (Flash v2.5 / v3) | **$0.01 – 0.02** | **$0.23 – 0.30** | **$0.25 – 0.32** | Excellent balance. Very low E2 cost. Top-tier understanding + best Slovenian naturalness. |
| **Google Gemini 3 Flash** | Google Chirp 3 HD | **$0.01 – 0.02** | **$0.13 – 0.15** | **$0.14 – 0.17** | Strong cost/quality. Good compliance (EU regions). Slightly lower E3 naturalness than ElevenLabs. |
| **Qwen3-Omni-Flash / Qwen3.5-Omni-Flash** | ElevenLabs (Flash v2.5 / v3) | **$0.03 – 0.05** | **$0.23 – 0.30** | **$0.26 – 0.35** | Very competitive E2 (strong benchmarks, explicit multilingual support). Much cheaper than OpenAI. Open-weights path available. |
| **Qwen3-Omni-Flash / Qwen3.5-Omni-Flash** | Azure Neural TTS | **$0.03 – 0.05** | **$0.07 – 0.08** | **$0.10 – 0.13** | **Lowest overall cost**. Solid for scale. Verify Slovenian prosody/dual forms in blind test. |
| **Qwen3-Omni-Flash / Qwen3.5-Omni-Flash** | Google Chirp 3 HD | **$0.03 – 0.05** | **$0.13 – 0.15** | **$0.16 – 0.20** | Great cheap combo with good compliance. |

### Summary Insights
- **Cheapest capable combo**: **Qwen3-Omni-Flash + Azure Neural** → **~$0.10–0.13** per session. Excellent for high-volume scaling (Part 4 of the stack).
- **Best quality + reasonable cost (recommended for MVP demo)**: **Google Gemini 3 Flash + ElevenLabs** → **~$0.25–0.32** per session. Delivers the highest “wow” factor (understanding + native Slovenian prosody/credibility with native testers) while keeping E2 costs almost negligible.
- **Premium realtime experience**: OpenAI GPT-Realtime-2 + ElevenLabs is noticeably more expensive (~2–3× the recommended combo) mainly due to audio input token pricing.
- **All options are very affordable for a demo**. Even the most expensive combo is under $1 per 15-minute session. At 100 sessions/month you’re still only looking at tens of dollars.

### Important Caveats & Variables That Can Change Costs
- **Tokenization rates**: I used ~25 tokens/sec (Google standard). Actual rates vary (Qwen sometimes lists 7–12.5 tokens/sec for audio). This mostly affects OpenAI and Qwen numbers.
- **Free tiers / caching**: Gemini and Qwen often have generous first 1M tokens free. OpenAI has cheap cached input tokens ($0.40/M). Real first sessions can be near-zero cost.
- **Actual usage**: Hesitant beginners + push-to-talk means real spoken audio time is often lower than 9 minutes. Shorter tutor turns = less TTS cost.
- **Regional / compliance pricing**: EU data residency (important for GDPR) may slightly affect Google/Azure rates or require specific endpoints.
- **Volume discounts & committed use**: At even moderate scale (hundreds of minutes), all providers drop significantly.
- **Slovenian-specific performance**: Qwen and Gemini show strong multilingual results; OpenAI is excellent in realtime. **Run the blind native A/B test** (as previously recommended) on code-switched comprehension and output naturalness before locking — this is the real tiebreaker, not just raw price.

**Bottom line for your MVP**:  
Go with **Google Gemini 3 Flash (E2) + ElevenLabs (E3)** for the demo. It gives you the best combination of capabilities, low per-session cost (~$0.25–0.30), and maximum credibility with Slovenian natives. The E2 cost is so low it’s almost irrelevant; the quality delta on E3 (ElevenLabs) is worth the small premium for the first validation phase.

**Grok Voice API (xAI) is a strong, viable contender** — not cost-prohibitive at all, and quite capable for many use cases. It fits differently from the modular E2 + E3 approach we've been discussing.

### What Grok Voice Actually Is (as of June 2026)
xAI launched a public **Voice Agent API** (realtime speech-to-speech over WebSocket) around May 2026. The flagship model is `grok-voice-think-fast-1.0` (or `grok-voice-latest`).

Key characteristics:
- **Native speech-to-speech** (audio in → reasons in the audio domain → audio out in one model). This is more like OpenAI's GPT-Realtime-2 than a pure "understanding model + separate TTS".
- Powered by Grok 4.3-class reasoning with tool calling, web search, and system instructions (you can prompt it to stay in character as a Slovenian tutor).
- Low latency: Sub-second time-to-first-audio (<1s claimed, often ~0.78s in tests). Supports full-duplex in some configurations.
- Voices: 5 expressive preset voices + custom voice cloning (from ~1-2 minute sample).
- Multilingual: Supports 25+ languages for STT and 28+ for TTS, with claims of native-level proficiency and good handling of nuances/dialects.
- Slovenian support: Not explicitly called out in the top marketing (unlike some Gemini/Qwen mentions), but it falls under the "dozens of languages" umbrella. Real performance on low-resource code-switching (hesitant English + Slovenian beginner speech) would need testing.

It also has separate standalone **TTS** ($4.20–$15 per 1M characters — very cheap) and **STT** endpoints if you want a more modular approach.

### Cost for Your Exact 15-Minute Scenario
Grok Voice uses **simple flat-rate pricing**: **$0.05 per minute** of active conversation time ($3.00 per hour).

For a 15-minute back-and-forth session:
- **Total cost: $0.75**

This covers **everything** — audio input processing, reasoning/tutoring, and native audio output. No separate E2 token math or E3 character counting.

**Comparison to previous options** (same 15-min assumptions):

| Approach | Est. Total Cost (15 min) | Notes |
|----------|---------------------------|-------|
| **Grok Voice Agent API** (full S2S) | **$0.75** | Flat rate, simplest billing |
| OpenAI GPT-Realtime-2 + ElevenLabs | $0.65 – 0.80 | Similar ballpark |
| Gemini 3 Flash + ElevenLabs | $0.25 – 0.32 | Significantly cheaper |
| Gemini 3 Flash + Google Chirp 3 HD | $0.14 – 0.17 | Cheapest high-quality combo |
| Qwen3-Omni-Flash + Azure Neural | $0.10 – 0.13 | Lowest cost option |

Grok is **not expensive** — it's in the middle of the pack and dramatically cheaper than running high-end ElevenLabs TTS at scale. The flat per-minute rate is developer-friendly (no surprise token spikes).

### How It Fits Your MVP Stack
**Pros for your Slovenian tutor**:
- Extremely easy integration (one WebSocket connection for the whole loop).
- Excellent latency and conversational feel (great for R1 streaming/chunked playback goals).
- Strong reasoning + tool use (you can give it the tutor prompt + scenario instructions).
- Very competitive price + low friction for rapid prototyping.
- Voice cloning could be interesting long-term (though consent/legal notes from the original stack still apply).

**Cons / Caveats for this specific project**:
- It is a **combined E2 + E3** solution. The original stack document specifically called for a **dedicated native-quality Slovenian TTS** (E3) because "the understanding model's own speech is prosodically foreign." Grok Voice may have the same limitation unless their voices happen to be exceptionally good at Slovenian pitch accent, dual forms, and čšž sounds.
- Slovenian performance is less explicitly proven in public benchmarks compared to Gemini or Qwen. It should handle major languages well, but low-resource code-switching with hesitant beginners is the exact risk area.
- Less granular control than separate Gemini (understanding) + ElevenLabs (TTS).

### Recommendation
**Grok Voice is worth testing seriously**, especially if you value:
- Simplicity and speed to a working demo.
- Low, predictable cost.
- Sub-second latency.

**Best path forward**:
1. Include **Grok Voice** in the blind native-speaker A/B test alongside:
   - Gemini 3 Flash (E2) + ElevenLabs (E3)
   - Qwen3-Omni-Flash (E2) + ElevenLabs or Google Chirp (E3)
2. Test specifically on **code-switched beginner Slovenian input comprehension** and **output naturalness/prosody**.

If Grok Voice performs well on Slovenian naturalness in that test, it becomes one of the strongest overall options because of its price, latency, and simplicity. If the output sounds noticeably less native than ElevenLabs, then the modular approach (Gemini or Qwen for E2 + ElevenLabs for E3) remains better for your "pronunciation/immersion product" goals.