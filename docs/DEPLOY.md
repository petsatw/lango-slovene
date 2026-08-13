# Deploying — shipping and serving audio

This picks up where [authoring-pipeline.md](authoring-pipeline.md) §G ends. Authoring produces finished
content; `build:dialogue-assets` synthesizes the clips into the local store. This doc covers the two things
that stand between "clips exist locally" and "a learner hears them on a deployed URL": **packaging the bytes
into the deploy**, and **configuring the serving host so cached clips are found**.

The target deploy is Railway (git-based: it builds a branch's checkout). The same contract holds for any
host that serves the repo.

---

## The three audio paths (they have different homes)

A scenario's sound comes from three independent mechanisms. Ship logic differs for each.

| Path | Where the bytes live | How it's served | How it ships |
|---|---|---|---|
| **Dialogue lines** | `assets/audio/<key>.mp3`, content-addressed | `GET /api/speak` recomputes the key, reads from disk | `assets/` is gitignored → **force-commit** (below) |
| **Intro narration** | `public/intros/<file>.mp3`, static file | `<audio src="/intros/…">` direct | already git-tracked under `public/` — commit normally |
| **Live TTS (miss)** | synthesized on demand, then cached | `/api/speak` on a cache miss → provider call | needs the E3 **API key**; off in the pregenerated posture |

The store key is `sha256(provider | voiceTag | text)` ([server/assets/store.ts:48](../server/assets/store.ts#L48)),
where `voiceTag = ${voiceId}:${modelId}` ([server/adapters/elevenlabs.ts](../server/adapters/elevenlabs.ts)).
A clip generated at build time serves as a cache **hit** only when the serving host recomputes the *same* key
— which means the same provider, model id, voice ids, and text.

---

## Serve-time env contract

Serving cached audio and generating new audio are two separate contracts:

- **Serving a cached clip is a pure disk read** ([server/server.ts:300](../server/server.ts#L300)) — it needs the
  voice/model config to reproduce the key, but **no API key**.
- **A cache miss calls the provider** ([server/server.ts:318](../server/server.ts#L318)) — that needs
  `ELEVENLABS_API_KEY`. With no key, a miss returns `502` and bills nothing (`requireKey()` throws).

So a pregenerated deploy runs with the **voice/model env set and the API key absent**: every authored line
plays free from disk; any un-generated text 502s harmlessly instead of spending.

### Required env for cached hits

```
E3_PROVIDER=elevenlabs
ELEVENLABS_MODEL_ID=eleven_v3
ELEVENLABS_VOICE_ID=fSzEIez35vDdOs4DQwVh              # female-speaker
ELEVENLABS_VOICE_ID_MALE=Jcyy5bkqt86ud0xdZhfW        # male-speaker
ELEVENLABS_VOICE_ID_SHOP_ASSISTANT=MMDUS1hxcZnX8i9ZdqNf  # shop-assistant
```

These voice ids are **identifiers, not secrets** — they belong in deploy config. They must equal the values
used when the clips were built; the model id must match too (default `eleven_v3`). The profile → env-var
*names* are also tabled in [rehearsal-dialogues.md](rehearsal-dialogues.md); the concrete values above are the
source of truth.

**Deriving the mapping for a new profile or scenario:** the store's `manifest.jsonl` records the voice-*id
string*, not the profile name, and a shared phrase (e.g. `Dober dan`) is spoken by more than one profile — so
map per-scenario through the dialogue's `voices` block, then confirm with recipe A before trusting it.

### Other deploy env

- `ASSET_DIR` — where the store reads/writes ([server/assets/store.ts:27](../server/assets/store.ts#L27));
  defaults to the repo's `assets/`. Leave it unset so the serving host uses the committed clips in the
  checkout. If you point it at a mounted volume, that volume must contain the clips — an empty volume makes
  every line miss.
- `PORT` — Railway injects it; the server honors it ([server/server.ts:422](../server/server.ts#L422)). No action.
- `OPERATOR_TOOLS` — leave **unset** in prod. It gates the session/transcript endpoints; default-closed keeps
  learner transcripts unreadable on a public URL. Set `=1` only in local dev to use the Replays view.
- `TURNLOG` — optional `=0` to disable the per-turn diagnostic log on the serving host.
- Provider **API keys** (`ELEVENLABS_API_KEY`, `GEMINI_API_KEY`) — omit for a pregenerated alpha. Add a key
  only when you intend that provider to be metered live; pair it with a provider-side spend cap
  ([SECRETS.md](SECRETS.md) §6), because `/api/speak`, `/api/turn`, and `/api/converse` are unauthenticated.

---

## Shipping dialogue audio (the force-commit step)

`assets/` is gitignored ([.gitignore](../.gitignore)), so `build:dialogue-assets` output does **not** travel with
a git deploy on its own. After generating a scenario's clips, add them explicitly:

```bash
git add -f assets/audio          # content-addressed dialogue clips
git commit -m "chore(assets): ship <scenario> audio"
```

Commit `assets/audio` only. Keep `assets/sessions/`, `assets/turnlog/`, `assets/learner.json` out — they hold
learner PII and have no place in the deploy. Images stay out too (scene backgrounds that the app uses live under
`public/backgrounds/` and ship there).

A spoken intro is a separate file: place its mp3 at `public/intros/<name>.mp3` and reference it as
`intro.audio` in the dialogue JSON. Being under `public/`, it commits and ships normally.

---

## Verifying

### Recipe A — local hit test (bills nothing)

Run the server with the voice/model env set and the **API key unset**, so a miss can only 502:

```bash
ELEVENLABS_API_KEY= GEMINI_API_KEY= E3_PROVIDER=elevenlabs ELEVENLABS_MODEL_ID=eleven_v3 \
ELEVENLABS_VOICE_ID=fSzEIez35vDdOs4DQwVh ELEVENLABS_VOICE_ID_MALE=Jcyy5bkqt86ud0xdZhfW \
ELEVENLABS_VOICE_ID_SHOP_ASSISTANT=MMDUS1hxcZnX8i9ZdqNf TURNLOG=0 PORT=8797 \
./node_modules/.bin/tsx server/server.ts &

curl -s -o /dev/null -D - "http://localhost:8797/api/speak?text=<sl>&scenarioId=<id>&voice=<profile>" \
  | grep -i x-audio-cache          # expect: X-Audio-Cache: hit
```

Pull a real line for `<sl>`:

```bash
node -e 'const d=require("./server/dialogues/restaurant-1.json");const n=[d.root,...Object.values(d.nodes||{})].find(x=>x&&x.speaker==="npc"&&x.sl);console.log(n.sl)'
```

### Recipe B — live probe against the deployed URL

```bash
curl -s -o /dev/null -D - "$BASE/api/speak?text=<sl>&scenarioId=<id>&voice=female-speaker" \
  | grep -i "x-audio-cache\|^HTTP"
```

### Confirm the audio shipped on the branch (git-level, no server)

```bash
git ls-tree -r --name-only <branch> | grep -c '^assets/audio/.*\.mp3$'
```

---

## When dialogue audio is silent

Check cheapest-first; the packaging check is a git fact and needs no running server.

1. **Is the audio committed on the deployed branch?** `git ls-tree … | grep -c '^assets/audio/'`.
2. **Is the deploy on that commit, and is `ASSET_DIR` reading the checkout** (not an empty mounted volume)?
3. **Are the voice/model env vars set and matching the build?** Recipe A with the same values isolates this.

A useful signal: intro narration plays from `public/intros/` regardless of the store or env, so "intro plays,
dialogue doesn't" points at packaging (1–2) or the voice env (3), never at the intro path.
