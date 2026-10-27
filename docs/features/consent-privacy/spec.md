# Consent and privacy

The learner sees what happens to their voice and words before every tutor session, and chooses per
session whether it is saved. Their conversations are their learning history, and they control it from
Settings. Helping to improve Vadi is a separate choice, off until they switch it on.

## 1. Tutor start screen

- The start screen opens on every tutor entry and before every live session. Its Start button begins
  the session.
- It shows this copy verbatim:

  > Your voice is sent live to Google (Gemini) or xAI (Grok) so the tutor can hear and answer you. Vadi
  > never stores your audio. Each conversation is saved as text in your learning history, so you can
  > look back on past sessions and see how you've improved. You can delete any session, or all of them,
  > in Settings. Please don't share sensitive personal details, like health, finances, or full addresses.

- Below the copy there are two boxes, using this copy:
  - ☐ Don't save this session (the transcript is deleted when the session ends)
  - ☐ Also let Vadi use my saved conversations to improve the tutor (optional, off by default)
- The first box is the per-session switch ([no-save session](../no-save-session/spec.md#1-switch)). It
  appears before every live session.
- The second box shows and sets the improvement opt-in (§2).
- A "Privacy policy" link opens `/privacy` (§4).
- The client keeps the last position of both boxes in `localStorage` (`noSave`, `improve`), and the
  boxes start at those positions.

## 2. Improvement opt-in

- The opt-in starts off. The learner switches it on or off on the tutor start screen or in Settings
  (§3). The server holds it on the learner model as `improve: { on, at }`, set with
  `PUT /api/me/improve` and the body `{ on }`.
- While it is on, the end of each saved session writes a pseudonymised copy to
  `DATA_DIR/improve/<sessionId>.json`: `{ learnerId, sessionId, createdAt, transcripts }`. Each transcript
  line passes through `stripPersonal` (§6) first.
- Copies are deleted after 90 days ([sweeps](../data-deletion/spec.md#3-sweeps)). They are also deleted
  when the learner switches the opt-in off, deletes the session, or deletes their data.
- No-save sessions produce no copy.

## 3. Settings

The Settings screen, opened from the app header, shows:
- the learner's code ([tester identity](../tester-identity/spec.md#6-code-in-settings))
- the improvement opt-in toggle (§2)
- a link to the Learning history screen ([learning history](../learning-history/spec.md#3-screen))
- the "Delete my data" button ([data deletion](../data-deletion/spec.md#1-delete-my-data))
- a "Privacy policy" link to `/privacy`

## 4. Privacy page

- `GET /privacy` returns `public/privacy.html` with status 200. That file is the Vadi privacy policy,
  in the wording Chris approves.
- Every screen that names data use (the tutor start screen and Settings) links to `/privacy`.
- Vadi is for people aged 18 or over. `/privacy` states this.
- When a policy change affects what happens to voice or conversations, the tutor start screen shows the
  new terms before the next session. It already shows its copy before every session.

## 5. Retention

| Data | Kept |
|---|---|
| Learning progress and gender | until 12 months after last use, or until Delete my data |
| Learning history: live logs, session records, turn-log rows, translations of session lines | until 12 months after last use, or until the learner deletes the session or all sessions |
| No-save session: live log, turn-log row, translations | deleted at session end, right after scoring, whatever the scoring outcome |
| Improvement copies | 90 days, or until the opt-in goes off |
| Audio, both live and tap-to-speak | streamed and processed in memory, never written to disk |
| Tutor speech for conversational replies | played, never written to the audio store |
| New phrases (`catalog-candidates.jsonl`) | 12 months, with personal context removed and no code or learnerId |
| Usage events and feedback | until 12 months after last use, or until Delete my data |
| Server and hosting logs | 30 days, set on the host |

[docs/retention.md](../../retention.md) maps each stored field to these rules.

## 6. Audio, tutor speech and new phrases

- **Audio.** Microphone audio for the live tutor streams through the server to the provider. A
  tap-to-speak clip is held in memory for its request. The turn log records text only.
- **Tutor speech.** The two client call sites that speak conversational replies call
  `/api/speak?cache=0`. With `cache=0` the server streams the synthesized audio and writes nothing to
  the audio store or `manifest.jsonl`. The audio store holds authored lesson audio only.
- **Translations.** A translation of a live-session line is cached with that session, in
  `DATA_DIR/live/<sessionId>.gloss.json`. `gloss-cache.json` holds catalog lines only.
- **New phrases.** `stripPersonal(text)` in `server/assets/pseudonymise.ts` replaces:
  - a capitalised word inside a sentence that is absent from the course catalog, with
    `[name]`
  - a run of digits, with `[number]`
  - an email address, with `[email]`

  A candidate phrase that `stripPersonal` changes is skipped. Candidate rows hold `surface`, `gloss` and
  `at` only.

## Open

- The policy's effective date, shown on `/privacy`.
