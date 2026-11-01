# Flashcards

Each scenario with dialogue lessons has a "Words and Phrases" list: every learnable its lessons teach,
English next to Slovene. From the list, or straight from the scenario's levels screen, the learner runs
a flashcard drill over the same learnables. The Slovene side of a card plays a line the learner already
heard in that scenario's dialogues, served only from the committed audio store. "Nailed it" adds 1 to the
learner's count for that learnable. At 5 the card is memorised, and the list marks it with a check mark.

Flashcard state is the learner's own self-rating. Mastery (A1 Readiness, the tutor's focus set, the live
grader and progressed objectives) comes only from spoken lessons and live sessions, and flashcards leave
it as it is.

## 1. Terms

- **Domain**: a scenario with published dialogues (`getPublishedDialogues(id).length > 0` in
  `server/dialogues.ts`). These are the scenarios on the practice screen with a levels screen, for
  example `sprehod` ("Dog walk") and `bakery`.
- **Domain learnables**: the learnables of the domain's published levels, each listed once, in this
  order: level ascending; within a level, every node's `learnables[]` in the order the nodes are
  authored in the level file, then that level's `introduces[]` ids that are not yet listed. Each id is an
  entry in `server/catalog/learnables.json`.
- **Card**: one domain learnable. A learnable that appears in two domains is one card in each, with one
  shared flashcard state, because the state is kept per learnable.
- **Memorised**: the learnable's `nailed` count is at least `FLASHCARD_THRESHOLD` (5).
- **Due**: a card that is not memorised, or was memorised (`memorisedAt`, §7) more than 30 days ago.

Dog walk has 80 cards. Its first is "can / may" / "Ali lahko ___? / Lahko ___.".

## 2. Words and Phrases row

- The levels screen (`#levels`, opened by `openScenario` in `public/app.js`) of every domain shows one
  row above the level cards, labelled "Words and Phrases", with no subtitle.
- The row carries two chips:

| Chip | Opens |
|---|---|
| "Overview" | the Words and Phrases list (§3) |
| "Flashcards" | card mode (§4) for the domain, with the stored settings (§4.1) |

- The levels screen of a scenario that is not a domain shows no row.

## 3. Words and Phrases list

The list is its own screen, `words` (`screen_viewed`, [events](../events/spec.md#4-event-list)).

- Title: "Words and Phrases".
- Under the title, the "Flashcards" button opens card mode (§4). It stays at the top of the screen while
  the list scrolls.
- One row per card, in domain order (§1). Each row has two columns: English (`en`, §5) and Slovene
  (`sl`, §5).
- A memorised card shows "✓" at the end of its row. The list shows no count, number or date.
- The "✓" has the accessible name "Memorised", on list rows and on cards.
- Rows are read-only. Tapping a row does nothing, and the list plays no audio.
- Back returns to the levels screen.
- The list loads from `GET /api/flashcards` (§8) each time it opens, so the check marks are current after
  card mode.

## 4. Card mode

Card mode is its own screen, `flashcards`. Back returns to the screen that opened it: the levels screen
from the "Flashcards" chip, or the list from the "Flashcards" button. Leaving card mode by any route stops
the clip that is playing.

### 4.1 Controls

Two controls sit above the card and stay on screen:

| Control | Values | Default | Kept |
|---|---|---|---|
| segmented control | "English" / "Slovene": the side each card shows first | English | per device, `localStorage.flashcardsFirstSide` (`en`, `sl`) |
| "Include memorised" switch | on / off | off | per device, `localStorage.flashcardsIncludeMemorised` |

- Changing "Include memorised" starts a new pass at once (§4.4) with the new rule.
- Changing the first side applies from the next card. The card on screen stays as it is.

### 4.2 The card

- One card fills the screen body and shows one side. A tap anywhere on the card turns it to the other
  side, and every later tap turns it back. The controls and chips sit outside the card.
- English side: `en`, large.
- Slovene side: `sl`, large. Under it, smaller, the `note` when the card has one. Under that, the
  example line (§6): its Slovene and its English. A card with no example shows no example line.
- Audio: each time the Slovene side comes into view, the example clip plays from the start (§6.4). This
  happens when a card opens Slovene first and on every turn to Slovene. The clip stops on a turn to
  English, on a rating and on leaving card mode. A card with no example is silent.
- A memorised card shows "✓" in its top corner on both sides (accessible name "Memorised", §3).
- Feedback: the header's "Feedback" link opens the feedback sheet with `screen: "flashcards"`, as on
  the other screens ([feedback](../feedback/spec.md#4-feedback-chip)).

### 4.3 Rating

- "Nailed it" and "Oops" appear after the card's first turn and stay until one is tapped.
- "Nailed it" calls `POST /api/flashcards/rate` with `result: "nailed"` (§8) and shows the next card.
- "Oops" calls the same route with `result: "oops"` and shows the next card. The `nailed` count stays as
  it is.
- Both count the same whichever side the card showed first.
- The next card shows on the tap. A failed rate call is sent once more, then dropped without a message.

### 4.4 Passes

- A pass is one run through a deck built from the cards the screen loaded from `GET /api/flashcards`:
  every due card with "Include memorised" off, every card with it on. The deck is shuffled
  (Fisher–Yates) and each card shows once.
- A card that becomes memorised during a pass is already behind the learner, since each card shows once
  per pass.
- After the last card's rating, the deck is rebuilt with the same rule, using the ratings of the pass
  just ended, and shuffled again. The toast "Shuffled. Going again." shows and the first card of the new
  pass appears. The card that ended a pass is never the first card of the next one, unless the deck holds
  that one card alone.

### 4.5 Empty deck

With "Include memorised" off and no card due, the card area reads "Everything here is memorised." The
screen shows no card and no chips, and the controls stay.

## 5. Card content

| Field | Value |
|---|---|
| `en` | the learnable's `gloss` up to its first " — " |
| `note` | the rest of the `gloss` after that " — ", when there is one |
| `sl` | the learnable's `sl`, verbatim, `___` slots and slash alternatives included |

- Variants show exactly as the catalog authors them, for example "Star / Stara sem / je ___ let /
  mesecev.". The learner's stored gender is not used to pick a form.

## 6. Example lines and audio

The example for a card is a line from the domain's dialogues whose clip is already in the committed
audio store. Flashcards add no audio and never call a speech provider.

### 6.1 Candidates

A node is a candidate example for a card when:
- it is in a published level of the domain whose `audio` is `"ready"`,
- its `learnables[]` holds the card's id, and
- it is synthesized (`isSynthesized` in `server/scripts/dialogue-lib.ts`). A spoken lesson's client
  lines are the learner's to say and have no clip.

A candidate's clip key is `store.audioKey(e3.name, e3.voiceTagFor(profile), node.sl)`, where `e3` is the
server's configured provider (`getE3()` with no argument), `profile` is the dialogue's
`voices[node.speaker]` resolved the way `/api/speak` resolves its `voice` param, and `node.sl` is the
node's base line. This is the key the dialogue's own play button reads.

### 6.2 Choice

Candidates are ranked by these keys in turn, and the first candidate whose clip is on disk
(`store.has(key, "audio")`) is the example:
1. A form match first. A line matches when, for at least one slash alternative of the card's `sl`, every
   word of that alternative appears among the line's words. Words are runs of letters or digits,
   lowercased, with `___` removed.
2. The `client` speaker first.
3. Fewest words in the line.
4. Lowest level, then node order in the level file.

The example is `{ sl, en, voice }`: the node's `sl` and `en`, and the profile from §6.1. The deck, with its
examples, is computed once per domain and held in memory for the life of the process.

Examples in Dog walk: `star_sem_let` → "Star je pet mesecev." / "He's five months old."; `skakati`,
whose forms only appear inflected → "Ne, še mladiček je. Skače.".

### 6.3 No example

A card with no candidate whose clip is on disk has `example: null`. It is listed, shows and rates like
any card, and is silent. In Administrative Unit, `koliko` is one: it is in `introduces[]` of
`upravna-enota-2` and on no node of that domain.

### 6.4 Audio route

`GET /api/flashcards/audio?scenarioId=<id>&id=<learnableId>` serves a card's example clip.

- The server resolves the card's example from its own deck (§6.2) and reads the clip with
  `store.read(key, "audio")`. It reads the disk store only.
- Found: `200`, `Content-Type: audio/mpeg`, with `Range` support, as a `/api/speak` cache hit.
- Unknown domain, a card outside the domain, a card with no example, or no clip on disk: `404` with
  `{ "error": "no clip" }`.
- The route takes `scenarioId` and `id` only. Every other query param is ignored.
- The route writes nothing: no audio file, no `manifest.jsonl` line and no in-memory cache entry.
- Like the other media loads, it is shared across learners and carries no learner headers
  ([tester identity](../tester-identity/spec.md#1-invite-link)).
- The client requests a clip only for a card with an example, and does not preload. An error or `404`
  leaves the card silent: no retry, no message, and the card works as usual.

`/api/speak` and its callers keep their behaviour.

## 7. Flashcard state

The state lives in the learner model, next to mastery:

```ts
// server/types.ts
export interface FlashcardState {
  nailed: number;        // "Nailed it" taps
  memorisedAt?: string;  // ISO; set on every "Nailed it" that leaves nailed >= FLASHCARD_THRESHOLD
  lastRatedAt?: string;  // ISO; set on every rating
}

export interface LearnerModel {
  learnables: Record<string, LearnableMastery>;
  facts: Record<string, string>;
  flashcards?: Record<string, FlashcardState>; // keyed by learnable id
  updatedAt: string;
  lastSeenAt?: string;
}
```

- `server/flashcards.ts` holds `FLASHCARD_THRESHOLD = 5`, its own constant beside mastery's `THRESHOLD`,
  and the pure `rate(model, learnableId, result, now)`, which returns a new model.
- "Nailed it": `nailed += 1`, `lastRatedAt = now`, and `memorisedAt = now` when `nailed >= 5`. Each
  "Nailed it" on a memorised card renews `memorisedAt`, so the card stays out of the due deck for 30
  days from the last one.
- "Oops": `lastRatedAt = now`.
- `memorised` and `due` (§1) are derived on read and never stored.
- A rating changes only `flashcards` (and `updatedAt`). `learnables`, `facts`, A1 Readiness, the tutor's
  focus set, the live grader and progressed objectives read only mastery.
- `shape()` in `server/assets/learner.ts` keeps `flashcards`, so the field survives every save and load in
  the dir, file and memory stores, `touch()` included. It keeps an entry only when `nailed` is a
  non-negative integer, and the two dates only when they are strings.
- The state is per learner and per learnable. In the dir store each learner has their own file. The
  file store holds one model for every id, by design of that store.
- `applyCredit` copies the model it is given, so crediting keeps `flashcards`.

## 8. API

| Route | Input | Returns |
|---|---|---|
| `GET /api/flashcards?scenarioId=` | — | `{ scenarioId, name, cards: [{ id, en, note?, sl, example: { sl, en, voice } \| null, memorised, due }] }` |
| `POST /api/flashcards/rate` | `{ scenarioId, id, result: "nailed" \| "oops" }` | `{ memorised, due }` |
| `GET /api/flashcards/audio?scenarioId=&id=` | — | the clip (§6.4) |

- `GET /api/flashcards` and the rate route resolve the learner with `learnerOf(req)`, like every learner
  route, and so carry the learner headers.
- An unknown `scenarioId` gets `404`. On the rate route, an `id` outside the domain's cards or a
  `result` other than `nailed` or `oops` gets `400`.
- The rate route is `learner.save(id, rate(learner.load(id), cardId, result, now))`.
- Responses carry `memorised` and `due` only. The `nailed` count and the dates stay on the server.

## 9. Events

Each name and prop is in the `server/events.ts` allowlist and in the
[event list](../events/spec.md#4-event-list).

| Event | Fired when | Props |
|---|---|---|
| `screen_viewed` | `showScreen` runs | `screen` includes `words` and `flashcards` |
| `flashcards_started` | card mode opens | `scenarioId`, `from` (`overview`: the "Flashcards" chip; `list`: the "Flashcards" button), `firstSide` (`en`, `sl`), `includeMemorised`, `deckSize` |
| `flashcard_rated` | the rate call for a "Nailed it" or "Oops" tap settles | `scenarioId`, `learnableId`, `result` (`nailed`, `oops`), `firstSide`, `memorised` (from the rate response; `null` when the call failed), `hasAudio` |
| `flashcards_pass_completed` | the last card of a pass is rated | `scenarioId`, `pass` (from 1), `cards` |
| `flashcards_setting_changed` | a control in §4.1 changes | `setting` (`firstSide`, `includeMemorised`), `value` |
| `flashcards_ended` | card mode closes, by Back or any other screen change | `scenarioId`, `rated`, `ms` |

- Turning a card and playing a clip record nothing.
- Readout, on the team readout rows:

```bash
jq -r 'select(.kind == "event" and .name == "flashcard_rated") | [.ts, .learnerId, .props.scenarioId, .props.learnableId, .props.result, .props.firstSide] | @tsv' rows.jsonl
```

## 10. Deletion and privacy

- Flashcard state is learning progress in the learner model
  ([retention](../consent-privacy/spec.md#5-retention)).
- Delete one or all history entries keeps the learner model, flashcard state included
  ([what a delete removes](../learning-history/spec.md#4-what-a-delete-removes)). A drill creates no
  history entry.
- Delete my data and the 12-month sweep remove the learner model, flashcard state included, and the
  learner's event rows, flashcard events included
  ([what is deleted](../data-deletion/spec.md#2-what-is-deleted)).
- Flashcards collect no free text. The privacy page's "Learning progress" covers the state.
- The audio route and the deck hold no learner data.
