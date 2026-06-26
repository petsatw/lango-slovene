# Docs

**Start here**

- [ARCHITECTURE.md](ARCHITECTURE.md) — the keystone: what the system is, what you can do with it, why
  it's shaped this way, and how the parts fit. Everything else hangs off this.
- [ROADMAP.md](ROADMAP.md) — where it's going, from first principles, and the dependency-ordered pieces.

**Reference** (the depth ARCHITECTURE links into)

- [FILE-MAP.md](FILE-MAP.md) — the project layout: every directory, module, script, and command → its file.
- [DATA-MODEL.md](DATA-MODEL.md) — the HTTP API and the concrete data shapes (scenario, session, catalog,
  adapter interfaces).
- [asset-pipeline.md](asset-pipeline.md) — the asset toolkit, the key model, and the render-vs-rekey decision.
- [SECRETS.md](SECRETS.md) — API keys and the key-isolation boundary.
- [server/utils/](../server/utils/README.md) — asset-store maintenance utilities (re-keying, etc.).

**The scenario engine** (how new lessons are made)

- [scenario-authoring.md](scenario-authoring.md) — the rubric every scenario must pass.
- the create-scenario skill ([../.claude/skills/create-scenario/](../.claude/skills/create-scenario/SKILL.md)) — the procedure that authors one.
- [research/](research/) — the expert-panel research the design rests on (preserved as-is).
