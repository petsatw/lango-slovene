*Govori — an AI language tutor to help learn everyday Slovene.*

# What AI unlocks for Slovene language learners

[▶ Watch the demo](media/demo.mp4)

A voice tutor that talks *with* you in real, everyday Ljubljana Slovene, and an engine that builds
you a new scene to practice whenever you need one.

### However you say it, this tutor handles it — and keeps you learning.
Mixed language, terrible grammar, bad pronunciation — it doesn't matter. It gets what you mean and
responds in real Slovene, like an insanely patient local.

### Everyday Slovene, focused on what you need to learn most right now.
No fixed script. The tutor steers each session toward what'll help you most, keeping you focused with helpful hints and repeats in a natural flow.

### Rehearse, listen, repeat — endlessly.
The butcher, the baker, the candlestick maker. When you need something specific — a landlord
call, a hardware-store clerk, an immigration officer, nailing the case right the first time — the
tutor builds that scenario for you. Whatever it is, you can create it with a single sentence.

---

**Building with AI in Ljubljana, for Ljubljana.**
Not just another language app — an immersive, generative language-learning platform, built and
shared in the open.

---

## Under the hood

The value isn't "an AI that talks to you" — that's the commodity that fails learners. The app owns
the teaching and keeps the model on a short leash: short tutor turns, simple Slovene, corrections by
recast, and you doing most of the talking.

- **The teaching is structured, not improvised.** Each scenario is a set of small objectives; the
  server — not the model — tracks what you've actually said and steers the next turn.
  → [mastery loop](docs/mastery-loop-spec.md)
- **Scenarios are generated, then checked — not hand-written.** Each one is authored in native
  Ljubljana Slovene, passed through a deterministic linter, and signed off by a *separate* AI critic
  before it ships. The repo ships the authoring agents themselves
  ([.claude/skills/create-scenario/](.claude/skills/create-scenario/SKILL.md)).
  → [the engine](docs/scenario-engine-contract.md)
- **Provider-agnostic by design.** Speech and language run through swappable adapters, so providers
  can be A/B-tested. → [architecture](docs/ARCHITECTURE.md)

Ships with three scenarios today (café, bakery, butcher); new ones are generated on demand.

```
Browser PWA  ──/api/turn──▶  Node server  ──▶  understand + tutor  ──▶  Slovenian voice
 push-to-talk                (owns the rules)     (e.g. Gemini)           (e.g. ElevenLabs)
```

## Quickstart

```bash
npm install
cp example-vars .env          # then edit .env in an editor — see docs/SECRETS.md
npm run dev                   # http://localhost:8787
```

Open the URL on your phone (same network) or desktop, **hold** the button, speak, release.

> 🔑 Keys go in `.env` only — never the shell, commits, or chat. Read [docs/SECRETS.md](docs/SECRETS.md) first.

## Verifying it actually works

This app's heart is the live integration of real speech services, so we **test the seams with real
services, observe the whole pipeline live, and never mock the heart.**

| Check | Command | What it proves | Needs |
|---|---|---|---|
| **E2 contract** | `npm run probe:e2` | understand+tutor key + endpoint reachable | E2 key |
| **E3 contract** | `npm run probe:e3` | voice key works + returns real audio (writes `fixtures/out/e3-probe.mp3` to judge by ear) | E3 key |
| **End-to-end replay** | `npm run replay` | real recorded clips → full pipeline → audio, within latency budget | both keys + clips (see [fixtures/README.md](fixtures/README.md)) |
| **Golden path** | manual | live human speech works on the real device | a phone + the script below |
| **Live observability** | built into the UI | shows each stage + latency; reveals *which* link failed | — |

**Golden-path rehearsal (run before any demo, on the actual phone + network):**
1. Hold, say in Slovenian: *"Dober dan."* → tutor greets back.
2. Hold, code-switch: *"Em… ena kava, prosim… can I get it with mleko?"* → tutor understands, recasts the milk phrase.
3. Hold, make a case error on purpose → tutor replies with the corrected form modeled naturally.
4. Confirm: audio plays, latency feels live, overlay shows green stages.

If any step fails, the overlay tells you the failing stage immediately.

## Swapping providers

Adapters live in [server/adapters/](server/adapters/). To test another provider: add a class
implementing `E2Adapter` or `E3Adapter` ([server/types.ts](server/types.ts)), register it in
[server/adapters/index.ts](server/adapters/index.ts), flip `E2_PROVIDER` / `E3_PROVIDER` in `.env`,
and re-run the probes. The swap point is one config line — this is how the blind native-speaker A/B
is run.

## Notes
- Model ids (`GEMINI_MODEL`, `ELEVENLABS_MODEL_ID`) and the Slovenian `ELEVENLABS_VOICE_ID` are
  env-configurable — verify them against current provider docs.
- Audio format from the browser varies (Chrome→webm, iOS Safari→mp4). The adapter passes the
  recorded mime through; the E2 probe + replay surface any format incompatibility immediately.
- Native mobile app, streaming playback, and continuous voice detection are deliberately deferred.
</content>
</invoke>
