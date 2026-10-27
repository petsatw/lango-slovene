# Consent and privacy

The learner says yes or no to usage events once, before anything is recorded. They agree to the voice
tutor when they first enter it. They can read and change both answers from any screen.

## 1. Consent record

- One record per browser, `localStorage.consent`:
  `{ version, events, voice, retain, at }`. `events`, `voice` and `retain` are booleans, and `at` is an
  ISO timestamp.
- `CONSENT_VERSION` is an integer in `public/app.js`. It goes up by one whenever the wording of a card
  or of `/privacy` changes.
- A card is shown when the record has no answer for it, or when `record.version` differs from
  `CONSENT_VERSION`. Otherwise the stored answer applies.
- The client sends `x-events: 1` once `events` is true, and `x-retain: 0` while `retain` is false. The
  live session create body carries both flags.

## 2. Events opt-in

- A short card opens on app open before any event is recorded (see the
  [events spec](../events/spec.md#3-delivery)).
- **Yes** sets `events: true`, and the client starts sending events. **No** sets `events: false`, and the
  client records no events.
- Required content points:
  - The app records which screens and steps the learner uses, tied to their tester code.
  - Events hold no typed or spoken text.
  - How long events are kept and when they are deleted (§5).
  - A link to `/privacy`.

## 3. Tutor card

- The card opens on the first entry to the tutor, and again whenever the version changes.
- It has a required box: the learner's voice is recorded and sent to a third-party AI provider. Continue
  stays disabled until this box is ticked, and the tick sets `voice: true`. Closing the card returns to
  the previous screen.
- It has an optional "improve the app" box, ticked by default, which sets `retain`.
- Required content points:
  - The voice is sent to a third-party AI provider for the conversation.
  - The retention for each answer (§5): unticked means transcripts are erased within four hours and the
    voice is never stored; ticked means transcripts and voice are kept until the end of the alpha test,
    then deleted.
  - Learning progress (which phrases the learner knows) is kept either way.
  - A link to `/privacy`.

## 4. Privacy & data

- A "Privacy & data" link sits in the app header on every screen. It opens a sheet that shows the current
  `events` and `retain` answers. Each answer can be changed there, and the sheet links to `/privacy`.
- A change updates the record and its `at`.
- `GET /privacy` serves `public/privacy.html` with status 200.
- Required content points for `/privacy`:
  - What is collected, by data type: usage events, feedback text, transcripts, voice recordings and
    learning progress.
  - Which data goes to third-party AI providers.
  - Retention for each type (§5).
  - That the tester code identifies the learner, and anyone with the invite link acts as that learner.
  - How to change the answers (Privacy & data).
  - Who to contact.

## 5. Retention

| Data | Kept | Deleted |
|---|---|---|
| Usage events (no free text) | until G4 | at G4 |
| Feedback text, at most 1000 characters | until G4 | at G4 |
| Transcripts and session text, `retain` false | until the sweep | within `RETENTION_TTL_MIN` (240 min) |
| Voice recordings, `retain` false | never written | — |
| Transcripts and voice, `retain` true | until G4 | at G4 |
| Learning progress (learnable counts) | kept | — |

- The sweep in `server/assets/retention.ts` handles the `retain: false` rows. [docs/retention.md](../../retention.md)
  lists the fields it covers.
- At G4 the operator deletes the events, the feedback and the retained transcripts and voice under
  `DATA_DIR`.
- The card and `/privacy` state this table in learner terms. "G4" reads as "the end of the alpha test".
