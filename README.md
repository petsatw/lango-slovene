# Govori — Slovenian conversation tutor (MVP voice demo)

A mobile-web voice tutor: a beginner expat speaks mixed English+Slovenian, the AI understands it,
replies in **native-quality Slovenian**, and gently corrects by recast. One scenario (café in Ljubljana).

Implements the **Essential Stack** in [docs/MVP-stack.md](docs/MVP-stack.md), Option 1
(modular cascade) with **swappable E2/E3 adapters** so providers can be A/B-tested.

```
Browser PWA  ──/api/turn──▶  Node server  ──▶  E2 (understand+tutor)  ──▶  E3 (Slovenian voice)
 push-to-talk                (holds keys)       e.g. Gemini                e.g. ElevenLabs
```

---

## Quickstart

```bash
npm install
cp example-vars .env          # then edit .env IN AN EDITOR — see docs/SECRETS.md
npm run dev                   # http://localhost:8787
```

Open the URL on your phone (same network) or desktop, **hold** the button, speak, release.

> 🔑 Keys go in `.env` only, never the shell/commits/chat. Read [docs/SECRETS.md](docs/SECRETS.md) first.

---

## Verifying it actually works (the testing philosophy)

This app's heart is the live integration of real speech services, so we **test the seams with real
services, observe the whole pipeline live, and never mock the heart.** No mock-fixture death-march.

| Check | Command | What it proves | Needs |
|---|---|---|---|
| **E2 contract** | `npm run probe:e2` | E2 key + endpoint reachable | E2 key |
| **E3 contract** | `npm run probe:e3` | E3 key works + returns real audio (writes `fixtures/out/e3-probe.mp3` to judge by ear) | E3 key |
| **End-to-end replay** | `npm run replay` | real recorded clips → full pipeline → audio, within latency budget | both keys + clips (see [fixtures/README.md](fixtures/README.md)) |
| **Golden path** | manual | live human speech works on the real device | a phone + the rehearsal script below |
| **Live observability** | built into the UI | shows each stage + latency; reveals *which* link failed | — |

**Golden-path rehearsal (run before any demo, on the actual phone + network):**
1. Hold, say in Slovenian: *"Dober dan."* → tutor greets back.
2. Hold, code-switch: *"Em… ena kava, prosim… can I get it with mleko?"* → tutor understands, recasts the milk phrase.
3. Hold, make a case error on purpose → tutor replies with the corrected form modeled naturally.
4. Confirm: audio plays, latency feels live, overlay shows green stages.

If any step fails, the overlay tells you the failing stage immediately.

---

## Swapping providers (the A/B)
Adapters live in [server/adapters/](server/adapters/). To test another provider:
1. Add a class implementing `E2Adapter` or `E3Adapter` ([server/types.ts](server/types.ts)).
2. Register it in [server/adapters/index.ts](server/adapters/index.ts).
3. Flip `E2_PROVIDER` / `E3_PROVIDER` in `.env`, re-run the probes.

No other code changes — the swap point is one config line. This is how the blind native-speaker
A/B from the stack doc is run.

## Notes
- Model ids (`GEMINI_MODEL`, `ELEVENLABS_MODEL_ID`) and the Slovenian `ELEVENLABS_VOICE_ID` are
  env-configurable — verify them against current provider docs.
- Audio format from the browser varies (Chrome→webm, iOS Safari→mp4). The adapter passes the
  recorded mime through; the E2 probe + replay surface any format incompatibility immediately.
- Native mobile app, streaming playback (R1), and continuous VAD are deliberately deferred — see
  the stack doc.
