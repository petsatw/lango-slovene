# Secrets & API Key Handling

How to stage provider API keys for the demo so they **never** leak into (a) the repository, (b) the shipped app, or (c) your working environment (shell history, LLM chats, bash commands).

This project talks to two paid providers via swappable adapters:
- **E2** (audio understanding + tutoring) — e.g. Google Gemini
- **E3** (Slovenian TTS) — e.g. ElevenLabs
- optional **E2/E3 alt** — e.g. Grok / OpenAI for A/B testing

Each needs an API key. Here is exactly how to handle them.

---

## TL;DR
1. Copy `example-vars` → `.env`.
2. Paste your keys into `.env` **using a text editor, not the terminal**.
3. Confirm `.env` is git-ignored (it already is — see below).
4. Run the app / probes. The Node server reads keys from `.env`; the browser never sees them.

---

## 1. Where keys live: a git-ignored `.env`

All keys go in a single local file, `.env`, at the project root. It is **never committed**.

`.gitignore` already contains:
```
.env
.env.*
!example-vars
```
So `.env` (and any `.env.local` etc.) are ignored, while the safe template `example-vars` is tracked.

> ⚠️ **Order matters if this isn't a git repo yet.** Create/verify `.gitignore` *before* you run `git init` and before your first `git add`. If you ever `git add` before ignoring `.env`, the key is in your git history even if you delete the file later — and must be rotated.

`.env` looks like this (real values, kept local):
```
E2_PROVIDER=gemini
E3_PROVIDER=elevenlabs

GEMINI_API_KEY=your-real-key-here
GEMINI_MODEL=gemini-2.5-flash        # verify exact model id against current docs

ELEVENLABS_API_KEY=your-real-key-here
ELEVENLABS_VOICE_ID=your-slovenian-voice-id
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

## 2. How to put keys IN `.env` without leaking them

**Do:**
- Open `.env` in a text editor (VS Code, etc.) and paste the value there. Editors don't record a shell history.

**Do NOT:**
- ❌ `export GEMINI_API_KEY=sk-...` in your terminal — it lands in `~/.zsh_history`.
- ❌ `echo "GEMINI_API_KEY=sk-..." >> .env` — same problem, the key is now in shell history.
- ❌ `curl -H "x-goog-api-key: sk-..."` — key in history *and* possibly in process listings.
- ❌ `cat .env`, `echo $GEMINI_API_KEY`, `env | grep KEY` — prints the secret to a terminal that may be logged, screen-shared, or scrolled back.

If you must touch keys from the shell, prefer a one-shot that doesn't persist (e.g. piping from a password manager CLI directly into the file), but the text-editor route is simplest and safest.

## 3. How the app USES keys (and why they can't leak into the app)

```
Browser (PWA)  ──HTTP──▶  Node server (reads .env)  ──HTTPS──▶  Gemini / ElevenLabs
   │                          │
   │  only ever calls our     │  keys live ONLY in this process's
   │  own /api/* endpoints     │  memory; never sent downstream to the browser
```

- The Node server reads keys from `process.env` **once at startup** (via `dotenv`).
- Adapters attach keys as request headers to the provider, server-side only.
- The browser bundle contains **no keys** — it only knows how to call `/api/turn` on our own origin.
- Therefore: viewing page source, the network tab (browser→our server), or the JS bundle never reveals a key. The only key-bearing traffic is server→provider, which the user's device never sees.

**Never** add a key to any file under `public/` or anything sent to the client. There is no `VITE_`/`PUBLIC_`-prefixed key here on purpose — those conventions inline secrets into the browser bundle.

## 4. Hygiene in OUR working environment (incl. LLM chats)

- **Refer to keys by name, never value**, in this chat or any AI coding tool. Say "the Gemini key," never the string.
- The assistant (Claude) will **not** echo, cat, or pass key values in Bash, and will not request the values. If you ever see a tool about to print `.env`, stop it.
- Don't paste `.env` contents into a chat to "show the config" — paste `example-vars` instead.
- Keep `.env` out of screen-shares and recordings.

## 5. If a key is ever exposed (shell history, chat, commit, screenshot)
Treat it as **burned**:
1. Rotate/revoke it in the provider console immediately.
2. Generate a fresh key, update `.env` (in the editor).
3. If it hit a git commit: rotating is mandatory — scrubbing history is not enough.

## 6. Provider-side hardening (do this when you create the keys)
- Use **scoped/restricted** keys where the provider supports it (e.g. restrict by API, referrer, or IP).
- Set a **spend cap / budget alert** — a leaked key with a $20 cap is a nuisance, not a disaster.
- Create **separate keys per environment** (one for local dev now, a different one for any hosted demo) so you can revoke one without breaking the other.

## 7. Verifying you're clean (safe commands — none print secrets)
- `git status` — `.env` must **not** appear as tracked or staged.
- `git check-ignore .env` — should print `.env` (confirms it's ignored).
- `npm run probe:e2` / `npm run probe:e3` — confirm the server can *read* the keys and reach the providers, **without** ever printing the key (probes log only provider name + success/latency).

> These checks tell you the key is staged correctly by observing *behavior*, never by displaying the secret.
