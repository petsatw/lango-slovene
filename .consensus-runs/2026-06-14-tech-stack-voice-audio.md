# Stochastic Consensus — Voice/Audio Tech Stack
Date: 2026-06-14 (UTC)
N=8 persona agents (sonnet) + 1 synthesis agent (opus)

## Problem
LIVE DEMO (then product) of an AI Slovenian conversation tutor for expats. Beginner speaks MIXED English+Slovenian audio (code-switching, wrong case endings); AI must understand it and respond in NATIVE-equivalent Slovenian with gentle inline correction.
Hard constraints: (1) LLM natively understands audio sent directly — NO transcribe-to-one-language-first (breaks on code-switching); (2) then EITHER LLM emits audio directly (S2S) OR emits TEXT → dedicated native-Slovenian TTS; (3) output must sound NATIVE-SPEAKER EQUIVALENT. Slovenian lower-resource (6 cases, dual, pitch accent).
Axes: (A) lowest cost w/ native quality; (B) best immersion/mastery; (C) wild alternative.

Personas: real-time S2S architect, low-resource (Slovenian) speech specialist, cost optimizer, latency/UX engineer, code-switching ML researcher, lean demo shipper, immersion/mastery pedagogy lens, contrarian wild-card.

---

## Agent 1 — Real-time S2S architect
Rec: Gemini 2.0 Flash Live (native audio I/O) + Azure Neural TTS "Petra" as output polish. Gemini Live processes code-switched EN+SL in one pass at low latency; OpenAI Realtime ~3-5x more per audio token. Gemini's own Slovenian out "passable not native." Confidence: medium. Counter: OpenAI Realtime GPT-4o safer/lower-variance for a demo; if Gemini drops a code-switched utterance in front of a stakeholder the demo dies.

## Agent 2 — Low-resource Slovenian speech specialist
Rec: GPT-4o Audio (Realtime) input + Azure sl-SI-PetraNeural output (hybrid on output side only). Whisper-first collapses on intrasentential switching. Azure Petra ONLY voice trustworthy for native-equiv Slovenian (vowel length + pitch accent, Ljubljana base); OpenAI built-in TTS + ElevenLabs multilingual flatten prosody to "Central European average" natives flag. OpenAI S2S Slovenian "intelligible but prosodically foreign" = failure for pronunciation learning. Hybrid adds ~150-300ms but kills the gap. Confidence: HIGH. Counter: Gemini may have closed the gap; won't bet native quality on un-A/B-tested model now.

## Agent 3 — Cost/efficiency optimizer
Rec: Gemini 2.0 Flash (audio-in, text-out) → Google Cloud TTS Slovenian (WaveNet/Neural2). Gemini Flash audio-in ~$0.70/M vs GPT-4o ~$100/M via Realtime — 2 orders cheaper. Text out ~$0.15/M vs GPT-4o Realtime audio out ~$200/M (~$0.01-0.015/sec). Google TTS sl-SI ~$16/M chars. Total ~$0.01-0.03/conv-min vs ~$0.15-0.30/min for OpenAI S2S; thousands/month at 1000 DAU. Confidence: HIGH. Counter: OpenAI Realtime = zero latency seam; hybrid TTS handoff 200-400ms can feel unnatural. Wild: Gemini audio-in + self-hosted Coqui/VITS Slovenian on $0.10/hr spot GPU.

## Agent 4 — Latency & conversational-UX engineer
Rec: GPT-4o Realtime (S2S, WebRTC) + Azure Petra as correction-replay track. TTFA <500ms; for the DEMO accented Slovenian is "acceptable noise" — natives tolerate accent more than dead air. Confidence: HIGH. Counter: GPT-4o Slovenian NOT native-equiv; ONE mispronounced word destroys credibility faster than 400ms lag; hybrid GPT-4o-in + Azure Petra streaming sentence-by-sentence (~700-900ms TTFA) wins IF audience judges pronunciation. (A) GPT-4o-in→Azure Petra streaming; (B) GPT-4o Realtime S2S; (C) Gemini Live + Google TTS.

## Agent 5 — Code-switching ML researcher
Rec: GPT-4o Audio input → GPT-4o text → Azure PetraNeural. Raw-waveform end-to-end so code-switched EN+SL reaches attention intact; owner's instinct correct. No production ASR handles intra-sentential EN+SL; Whisper force-decodes dominant language, mangling Slovenian suffixes. Claims GPT-4o stronger low-resource Slavic than Gemini (Gemini weighted EN/ES/Mandarin). Azure Petra only production native-equiv voice; ElevenLabs "no Slovenian model"; Google sl-SI "robotic on longer utterances." Confidence: HIGH. Counter: GPT-4o Slovenian undertested; confidence-gated hybrid segmenter (ASR on high-confidence monolingual spans, raw audio for ambiguous) could beat pure audio-in on longer clean utterances — blanket ASR rejection may overcorrect.

## Agent 6 — Lean demo shipper
Rec: GPT-4o Realtime (audio-in/out) + ElevenLabs Slovenian "Matej" as hotswap fallback. Only production API matching native-audio + code-switching; OpenAI browser WebRTC quickstart (clone openai-realtime-console, ~10 min). S2S Slovenian "acceptable for a demo"; if thin, intercept text → ElevenLabs stream via Web Audio, one afternoon. Time to first live conversation: 4-6 hrs. Confidence: HIGH. Counter: Gemini Live cheaper, maybe less accented, but browser quickstart less mature; a demo that almost works but took longer is worse than one working today.

## Agent 7 — Immersion & mastery pedagogy lens
Rec: GPT-4o audio input → text → Azure Neural TTS (Petra/Rok). Native pronunciation non-negotiable: auditory cortex calibrated by every syllable; accented AI speech encodes WRONG motor patterns. Correction must be SPOKEN RECAST not text overlay (overlay splits attention/breaks immersion); tutor re-uses corrected form naturally — how recasts work in SLA. Azure best; ElevenLabs hit-or-miss; Google lags. Confidence: HIGH. Counter: S2S sub-300ms turn-taking rhythm is itself pedagogical; text→TTS 600-900ms signals "tool not person."

## Agent 8 — Contrarian wild-card
Rec: Voice-clone a consenting native Slovenian speaker; pipe LLM text through clone. "Native-equiv" unsolvable with current Slovenian TTS (pitch accent + dual mangled). Afternoon + paid native + ElevenLabs Instant Clone / XTTS-v2 on ~30 min audio = permanent scalable human-sounding asset + MOAT. Code-switching constraint OVER-ENGINEERED for beginners: predictable fragments + <2ms fastText word-boundary language-ID + segment-wise Slovenian Whisper = zero hallucination. DEMO: pre-generate 60-80 likely utterances from clone, index clips, LLM picks intent → play clip = zero latency/zero TTS failure/perfect pronunciation; Wizard-of-Oz rest. Confidence: HIGH. Counter: clone = permanent legal/consent liability; quality degrades on edge phonemes; clip library caps expressiveness — novel sentences break it by week 2.

---

## SYNTHESIS (opus)

### Consensus
- Audio must reach the LLM directly; ASR-first is the wrong default (1,2,3,4,5,6,7). Owner's instinct validated.
- Native-equiv Slovenian output requires a dedicated TTS, not the LLM's own speech — both GPT-4o Realtime and Gemini Live emit prosodically foreign Slovenian (1,2,3,5,7; 4 conditionally).
- Azure Neural TTS "Petra" (sl-SI-PetraNeural) is the standout Slovenian voice (1,2,4,5,7). Google sl-SI a tier below; ElevenLabs contested.
- The hybrid cascade (audio-in LLM → text → Azure Petra) is the modal recommendation (1,2,4,5,7).
- Feasibility is not the risk; TTS/prosody quality is (3,6).

### Genuine disagreements
(a) S2S vs hybrid-TTS — resolved by WHO judges the demo. Native stakeholders + pronunciation product → hybrid wins. (4 concedes hybrid wins if audience judges pronunciation.)
(b) GPT-4o Realtime vs Gemini Live for understanding — untested empirical claim both ways (5 says GPT-4o stronger Slavic; 3 says Gemini), both HIGH confidence, neither benchmarked. Cost favors Gemini; maturity favors GPT-4o for demo-this-week. Judgment call pending data.
(c) "No transcribe-first" — correct for demo + as default; mildly overcorrecting as permanent dogma (5-counter, 8's segmenter point legit for later). Beginners produce the MOST ambiguous spans, exactly where ASR fails. Keep the constraint.

### High-value outliers
- Agent 8: voice clone as permanent quality MOAT (escapes Slovenian-TTS ceiling).
- Agent 8: pre-generated clip library + intent-label + Wizard-of-Oz = de-risked demo.
- Agent 7: spoken recast not text overlay for correction (reshapes correction UX).
- Agent 3: self-hosted Coqui/VITS on spot GPU = scale-cost backstop.
- Agent 5: confidence-gated hybrid ASR/audio segmenter.

### Recommendation
1. DEMO this week: GPT-4o Realtime in AUDIO-IN / TEXT-OUT mode (openai-realtime-console quickstart) → stream sentence-by-sentence to Azure sl-SI-PetraNeural via Web Audio. Correction as spoken recast, not text overlay. GPT-4o over Gemini to de-risk. Accept ~700-900ms TTFA. Keep Agent 8's clip library + WoZ as break-glass fallback.
2. PRODUCT: re-evaluate Gemini 2.0 Flash (audio-in, text-out) for ~100x input-cost reduction, GPT-4o as fallback. STAY hybrid TTS not S2S (prosody gap is the value prop). Azure Petra at launch; consented native voice clone as differentiating asset once consent ironclad, Azure as permanent fallback. Self-hosted VITS as scale-cost backstop.
3. TEST before committing: blind native-speaker A/B on output Slovenian (GPT-4o S2S vs Azure Petra vs Gemini) for pitch-accent/vowel-length/dual, AND GPT-4o vs Gemini comprehension of code-switched input. Resolves disagreements (a) and (b).
4. Voice clone: defer to product, off the critical path for this week; adopt with a TTS fallback baked in from day one.

Cost: Demo (GPT-4o Realtime audio-in + Azure Petra) ≈ low cents/min. Product (Gemini Flash audio-in + Azure Petra) ≈ $0.01-0.03/min, ~10x cheaper than full GPT-4o S2S (~$0.15-0.30/min). Input model is the cost driver; TTS comparatively cheap (~$16/M chars).

### Confidence
Medium-high. Strong convergence on architecture + Azure Petra + no-transcribe-first. The two live disagreements reduce to the same untested empirical question (relative Slovenian quality) → the A/B test is the gating action; confidence → high once it runs.
