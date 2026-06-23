*Govori — an AI language tutor to help learn everyday Slovene.*

# What AI unlocks for Slovene language learners

https://github.com/user-attachments/assets/2ae91746-9553-4109-9ce3-30f39edf2b73

A voice tutor that talks *with* you in real time practice sessions, and an engine that can build new dynamic audio-visual lessons for the topics you need to practice most. 

### However you say it, this tutor handles it — and keeps you learning.
Mixed language, terrible grammar, bad pronunciation — it doesn't matter. It gets what you mean and
responds in Slovene, keeping you natively immersed, gently modeling corrections, infinitely patient.

### Everyday Slovene, focused on what you need to learn most right now.
No fixed script. The tutor steers each session toward what'll help you most, keeping you focused with helpful hints and repeats in a natural flow.

### Rehearse, listen, repeat, remix
The butcher, the baker, the candlestick maker. When you need something specific — a landlord
call, a hardware-store clerk, an immigration officer, nailing the case right the first time — the
tutor builds that scenario for you. Whatever it is, you can create it with a single sentence.

---

**Building with AI in Ljubljana, for Ljubljana.**
This is more than a language app, it is the starting point for immersive, generative language-learning platform, built and
shared in the open.

---

## How it works

The app owns the teaching, not the model. Each scenario is a set of small objectives; the server —
not the model — tracks what you've said and rebuilds the prompt every turn, keeping the model on a
short leash: short turns, simple Slovene, corrections by recast, you doing most of the talking.
Scenarios are generated and quality-checked, not hand-written. Every provider is a swappable adapter.

```
Browser PWA  ──/api/turn──▶  Node server  ──▶  understand + tutor  ──▶  Slovenian voice
 push-to-talk                (owns the rules)     (e.g. Gemini)           (e.g. ElevenLabs)
```

## Quick start

**Setup (once):**

```bash
npm install
cp example-vars .env          # add your keys in an editor — see docs/SECRETS.md
```

> 🔑 Keys go in `.env` only — never the shell, commits, or chat.

Then pick a path:

**1 · Try the three ready-made scenarios** — café, bakery, butcher

```bash
npm run fetch:assets          # download the prebuilt scene images + audio (free)
npm run dev                   # http://localhost:8787 — pick a scenario, hold to speak
```

The scenes and flashcards come from the downloaded bundle (no image-generation key needed); the
conversation runs live through your understand + voice keys.

**2 · Check your wiring first** — a few cents, confirms your keys are connected

```bash
npm run probe:e2   # understand + tutor reachable
npm run probe:e3   # voice returns real audio
npm run replay     # one recorded clip → full pipeline → audio
```

More detail in *Verifying it actually works*, below.

**3 · Generate your own scenario** — any situation, in one sentence

Run the **create-scenario** skill in Claude Code (describe a situation; it authors and self-checks
the scenario), then materialize its assets:

```bash
npm run build:assets -- <scenario-id>   # one-time; bills the speech + image providers
```

It auto-appears in the picker. → [how the engine works](docs/ARCHITECTURE.md)

## Project structure

| Path | What it does |
|---|---|
| `public/` | the push-to-talk PWA |
| `server/orchestrator.ts` · `prompt.ts` | a turn: understand, apply the mastery rules, rebuild the prompt |
| `server/adapters/` | swappable providers — understand (E2), voice (E3), image (E4) |
| `server/scenarios/*.json` | the scenarios, as data |
| `.claude/skills/create-scenario/` | the engine that authors new scenarios |

Full map: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Design choices

- **The app owns the pedagogy, not the model.** Deterministic `pending → recast → completed` rules
  live in the server, so teaching quality doesn't ride on the model behaving.
- **Every provider is an adapter.** Swap the understanding model, the voice, or the image generator
  with one `.env` line — the same seam that lets the engine target another language.
- **Scenarios are data, generated then gated.** Author → deterministic lint → independent critic →
  ship, so content scales without quality collapse.

## Docs

- [docs/README.md](docs/README.md) — the docs map.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how it's built, and the files that matter.
- [docs/ROADMAP.md](docs/ROADMAP.md) — where it's going, and the pieces to get there.
- [AGENTS.md](AGENTS.md) — conventions for agents (and people) working in the repo.

Common seams: add a scenario (`server/scenarios/*.json`, via the engine) · swap a provider
(`server/types.ts` + `server/adapters/index.ts` + `.env`) · verify against real services
(`npm run probe:e2` / `probe:e3` / `replay`).

## License

Not chosen yet — see [docs/ROADMAP.md](docs/ROADMAP.md). Until one is added, default copyright
applies; ask first.
