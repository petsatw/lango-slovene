# Consent and privacy

The learner sees what happens to their voice and words before every tutor session, and chooses per
session whether it is saved and whether it can be used to improve Vadi. Their conversations are their
learning history, and they control it from Settings.

## 1. Tutor start screen

- The start screen opens on every tutor entry and before every live session. Its Start button begins
  the session.
- It shows this copy verbatim:

  > Your voice goes live to Google or xAI so the tutor can answer. Audio is never stored.
  >
  > Conversations are saved to your history, unless you choose "Don't save this session" to opt out.
  > Delete conversations anytime in Settings.
  >
  > What you share is covered by Google's and xAI's privacy policies.

- In that copy, "Google's" links to https://policies.google.com/privacy and "xAI's privacy policies"
  links to https://x.ai/legal/privacy-policy. Both open in a new tab.
- Below the copy there are two boxes, using this copy:
  - ☐ Don't save this session
  - ☐ Use this session to improve Vadi
- Both boxes are optional and start unticked each time the screen opens. Each choice covers that one
  session. Start works with neither box ticked: the session is saved to the learning history and is
  not used to improve Vadi.
- The first box is the per-session switch ([no-save session](../no-save-session/spec.md#1-switch)).
- The second box is the improvement consent for that session (§2).
- The two boxes exclude each other. Ticking either one unticks and disables the other. Unticking it
  enables the other again, unticked.
- Below the boxes sit the "Start" button and a "Privacy policy" link that opens `/privacy`
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

## 7. Team access

- The team reads the event log, feedback text included, and a summary of each saved live session
  through the [team readout](../team-readout/spec.md), a read-only endpoint behind the `TEAM_READ_KEY`
  key.
- A session summary holds the lesson, provider, start and end, how the session ended and the
  progressed objectives. It holds no transcript.
- A no-save session has no summary. Its live events stay in the event log, as for every session.
- Rows carry the `learnerId` and whether the learner came in on a tester code, never the code itself.
  A learner's rows leave the readout when their data is deleted (§5).
