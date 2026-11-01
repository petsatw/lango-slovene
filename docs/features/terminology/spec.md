# Terminology

Each thing in the app has one name, used the same way in specs, docs, skills, issues and code. Learners
see one on-screen label that differs: a domain is labelled "scenario" (§2).

## 1. Terms

| Term | Means | Example |
|---|---|---|
| Domain | The top-level unit of practice: one area of daily life, holding its levels and, where it has one, a live scene. Each domain has one manifest, `server/domains/<domainId>.json`. | `sprehod`, `bakery`, `library` |
| Level | One lesson inside a domain: a tap dialogue or a spoken lesson. A domain's levels are numbered from 1 in ascending difficulty, one file each: `server/dialogues/<domainId>-<level>.json`. | `sprehod-3` |
| Learnable | One item in `server/catalog/learnables.json` (a word, phrase or pattern). Durable mastery is kept per learnable. | `zivjo`, `rad_bi` |
| Objective | An authored micro-goal inside a level or a live scene. It names the learnables it exercises. | "Greet" |
| A1 theme | One of the `thematic` competencies of the A1 coverage map, `server/catalog/a1-map.json` ([A1 taxonomy](../../a1-taxonomy.md)). A domain's levels cover one or more A1 themes. | |
| Surface | A way a domain is played. The manifest's `surfaces` declares them: `dialogue` (its levels) and `live` (its live scene). The same block carries the `a1` flag, which puts the domain on A1 Readiness. | |
| Scene | Two kinds, named in full where the context leaves it open: | |
| — spoken scene | A level whose `advance` is `"audio"`. It plays on the `scene` screen through `POST /api/scene`. | `slavko-intro-1` |
| — live scene | A domain's `live` surface, played with the live tutor and directed by its harness, `server/domains/harness/<file>.md`. A live session in it has the domain id as its `lessonId`. | `sprehod` |

"Domain" in its plain-English senses (a value's domain, a field of knowledge) keeps its ordinary meaning
where the sentence makes that clear.

## 2. Where "scenario" stays

The word "scenario" appears in these places only:

- **Learner copy.** On screen, a domain is labelled "scenario". The strings are:
  - "Practice scenarios" (the Home tile that opens the domain list)
  - "Request a scenario" (the request sheet's title, [feedback](../feedback/spec.md#22-request-a-scenario-sheet))
  - "Request this scenario" (the finder's no-match button)
  - "No scenarios yet." (the empty domain list)
- **Plain English**: a possible situation or case, as in "impossible scenarios", a test scenario or a
  probe's scenario.
- **The turn log's path value** `path: "scenario"`, which marks a turn of the objective turn loop.
- **The asset bundle's name**, `scenario-assets-v2.tgz`.
- **The stored key `scenarioId`**, in stored lines that carry it, read as §4 sets out.
- **Learner-typed text** in probe fixtures, such as a finder query.
- **`docs/research/**`**, which is a dated record and stays as written.

## 3. Names

| Thing | Name |
|---|---|
| Domain manifests | `server/domains/<domainId>.json` |
| Live-scene harnesses | `server/domains/harness/<file>.md` |
| Manifest loader | `server/domains.ts`: type `Domain`, `getDomain`, `DOMAINS` |
| Manifest lint | `npm run lint:domain` |
| Authoring skill | `.claude/skills/create-domain/` |
| Critic agent | `.claude/agents/domain-critic.md`, `name: domain-critic` |
| Authoring rubric | `docs/domain-authoring.md` |
| Restaurant design | `docs/restaurant-domain.md` |
| Finder candidates and their ranking (they are levels) | `LevelCandidate`, `LevelRanking`, `rankLevels` |
| What a handoff into the live tutor carries | `HandoffContext` |
| Client styles and attributes | `.domain-*` classes, `#wrapup-domain`, `data-domain` |
| A domain id in usage text and placeholders | `<domainId>` |

## 4. Wire and stored keys

- Requests, responses, event props, content files and every line the server writes name a domain by
  `domainId`. This covers the `/api/config`, `/api/speak` and `/api/image` query, the `/api/scene` body,
  level and dialogue files, `server/catalog/a1-map.json`, turn logs and the asset manifest.
- Response fields that hold domains are named for them:
  - `GET /api/practice`: `domains[]`
  - `GET /api/match/index`: `domainTokens`
  - `GET /api/a1`: each competency's `domains`
  - `GET /api/history`: each entry's `domain` ([learning history](../learning-history/spec.md#1-sessions))
  - `POST /v1/live/sessions`: `domain` ([live session](../live-session/spec.md#3-progress-result))
- `authoring/dialogues/<domainId>/reconcile-input.json` holds the domain under `domain`.
- A session record (`DATA_DIR/sessions/<runId>.json`, and `GET /api/sessions`) names what it practised
  by `lessonId`: a domain id or `free-chat`.
- A seed clip in the asset manifest names its seed by `seedId`.
- Readers take the domain id from `domainId`, or from `scenarioId` where a stored line has only that key.
  A session record's reader takes `lessonId`, or `scenarioId` where the record has only that key. Stored
  lines stay as written.
