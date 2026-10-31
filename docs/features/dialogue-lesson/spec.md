# Dialogue lesson

A scenario's levels are dialogue lessons. A tap dialogue is a branching conversation the learner clicks
through in an overlay; a spoken lesson is one the app plays on its own full-screen surface
([rehearsal dialogues](../../rehearsal-dialogues.md)). The learner can see how demanding a level is
before opening it, move freely through a tap dialogue, and start either kind of lesson over at any time.
A tap dialogue credits nothing; credit comes from spoken lessons and live sessions.

## 1. Difficulty chip

Each level card on the scenario's levels screen shows a difficulty chip beside the level's task. The
chip follows the level's `levelLabel`, which `lint:a1` computes from the level's band
([difficulty model](../../dialogue-difficulty-model.md#4-levellabel-is-derived-from-the-computed-band)):

| `levelLabel` | Chip |
|---|---|
| `Basic` | Beginner |
| `Intermediate` | Intermediate |
| `Advanced` | Advanced |
| `Above A1` | Advanced |

- A level with any other `levelLabel`, or none, shows Beginner.

## 2. Controls

A tap dialogue has three controls, "↻ Start over", "Back" and "Forward", in one row at the lower left of
the dialogue card. They are on screen from the moment the conversation starts (after the intro, when the
level has one) until the overlay closes, including at the level's end.

### 2.1 Steps

- A step is one choice the learner taps: their line, and the character's reply that follows it.
- The dialogue keeps the steps taken in this walk, in order, and a position in that list.
- Tapping a choice adds a step at the position. Any steps after the position are dropped first, so
  Forward only ever re-walks steps the learner has already taken on the current path.

### 2.2 Back and Forward

- **Back** goes one step back: the conversation shows as it stood before the last step, with that fork's
  choices offered again. Back is disabled when no step has been taken.
- **Forward** re-takes the next step that Back undid: the learner's line and the character's reply
  appear, then the next fork's choices, or the end of the level. Forward is disabled when there is no
  undone step to re-take.
- Both stop any line that is playing. Restored lines appear at once, without playing their audio; each
  line's play button and tap-to-reveal English work as usual.
- Back from the end of the level returns to the last fork.
- Back and Forward record no event, no attempt and no credit.

### 2.3 Start over

- **↻ Start over** stops any line that is playing, clears the conversation and the steps, and plays the
  level again from its first line, as when the level opened. The intro does not play again.
- It records `level_restarted` with the level's `scenarioId` and `level`, and `nodeId`: the character
  line the learner was at ([event list](../events/spec.md#4-event-list)).
- The spoken lesson has its own Start over (§4.1).

### 2.4 Level run

- Start over, Back and Forward keep the level's run going: they neither start nor end it.
- `level_completed` fires once per run, the first time the run reaches the end of the level. Reaching the
  end again after Back, Forward or Start over records nothing more.
- At the end of the level, the choices area shows the "Feedback" button
  ([feedback](../feedback/spec.md#1-points)); starting over is the "↻ Start over" control (§2).

## 3. Scrolling

- While the dialogue overlay is open, the page behind it does not scroll, by touch, wheel or keyboard.
  The page keeps its scroll position and is back where it was when the overlay closes.
- The conversation and the choice list each scroll on their own. A scroll that reaches the top or
  bottom of either stops there and does not carry on to the page behind (`overscroll-behavior: contain`).
- The same holds for a sheet opened over the dialogue, such as the feedback sheet.

## 4. Spoken lesson

A spoken lesson plays on the spoken-lesson screen, which shows no app header. Its run chips sit at the
upper right: 🐢 (say it slower), « (back to the previous line), » (skip to the next line), ↻ (start over)
and ✕ (close the lesson).

### 4.1 Start over

- The ↻ chip has the title and label "Start over". It is available from the lesson's first line through
  the close screen.
- Pressing it stops the line that is playing, leaves the close screen if it is showing, and plays the
  lesson again from its first line, with the « trail starting fresh. The on-ramp does not play again.
- It records `level_restarted` with the lesson's `scenarioId` and `level`, and `nodeId`: the line the
  learner was at.
- The credit and attempts the learner earned before pressing it stay in the learner model. Pressing it
  sends nothing to the server about the learner model; the lines of the new walk count as any walk does.
- The level's run carries on as in §2.4.

## 5. Feedback

The floating "Feedback" chip is on the tap-dialogue overlay and the spoken-lesson screen for the whole
lesson ([feedback chip](../feedback/spec.md#4-feedback-chip)). The sheet opens over the lesson and
closing it returns to the lesson where it was.
