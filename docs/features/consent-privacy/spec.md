# Consent and privacy

The learner sees what happens to their voice and words before every tutor session, and chooses per
session whether it is saved and whether it can be used to improve Vadi. Their conversations are their
learning history, and they control it from Settings.

## 1. Tutor start screen

- The start screen opens on every tutor entry and before every live session. Its Start session button
  begins the session.
- It shows this copy verbatim:

  > Voice is streamed live to Google (Gemini) or xAI (Grok) so the tutor can hear and answer. Vadi never
  > stores audio.
  >
  > Each conversation is saved as text in the learning history and can be deleted at any time in
  > Settings.
  >
  > Information shared in a session is the responsibility of the person sharing it and is subject to
  > Google's and xAI's terms and privacy policies.

- Below the copy there are two boxes, using this copy:
  - ☐ Don't save this session (the transcript is deleted when the session ends)
  - ☐ This session can be used to improve Vadi (optional; unavailable when "Don't save" is selected)
- Both boxes start unticked each time the screen opens. Each choice covers that one session.
- The first box is the per-session switch ([no-save session](../no-save-session/spec.md#1-switch)).
- The second box is the improvement consent for that session (§2).
- Ticking "Don't save this session" unticks the improve box and disables it. Unticking "Don't save"
  enables it again, unticked.
- Below the boxes sit the "Start session" button and a "Privacy policy" link that opens `/privacy`
  (§4).

## 2. Improvement consent

- The learner gives it per session, with the improve box on the tutor start screen (§1). The live
  session create body carries `improve: true` when the box is ticked, and the session log records
  `improve: true`.
- At the end of a saved session with `improve: true`, the server writes a pseudonymised copy to
  `DATA_DIR/improve/<sessionId>.json`: `{ learnerId, sessionId, createdAt, transcripts }`. Each
  transcript line passes through `stripPersonal` (§6) first.
- Copies are deleted after 90 days ([sweeps](../data-deletion/spec.md#3-sweeps)). They are also deleted
  when the learner deletes the session or deletes their data, or withdraws consent.
- Withdrawing: Settings has a "Stop using my sessions to improve Vadi" button. It calls
  `DELETE /api/me/improve`, which deletes all of the learner's improvement copies.

## 3. Settings

The Settings screen, opened from the app header, shows:
- the learner's code ([tester identity](../tester-identity/spec.md#6-code-in-settings))
- the "Stop using my sessions to improve Vadi" button (§2)
- a link to the Learning history screen ([learning history](../learning-history/spec.md#3-screen))
- the "Delete my data" button ([data deletion](../data-deletion/spec.md#1-delete-my-data))
- a "Privacy policy" link to `/privacy`

## 4. Privacy page

- `GET /privacy` returns `public/privacy.html` with status 200. That file is the Vadi privacy policy,
  v1.0, effective 27 October 2026, served as-is (one self-contained HTML file).
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
| Improvement copies | 90 days, or until the learner withdraws consent |
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
