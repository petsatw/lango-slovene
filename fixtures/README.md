# Audio fixtures for the replay harness

These are **real recorded beginner utterances** fed through the **real** pipeline by `npm run replay`.
They are NOT mocks — they're reproducible real inputs so we can verify end-to-end without a human
talking on every run. (Audio files are git-ignored; voices stay local unless cleared.)

## How to record
Put short clips in `fixtures/audio/` in a **Gemini-supported** format: `.wav .mp3 .ogg .flac .aac .aiff`.
⚠️ Gemini does **not** accept `.webm` / `.mp4` / `.m4a` — and most phone voice-memo apps export `.m4a`.
Convert first, e.g. on macOS:
```bash
afconvert -f WAVE -d LEI16@16000 input.m4a fixtures/audio/02-cafe-codeswitch.wav
```
(The live app handles this automatically — it re-encodes mic audio to 16 kHz mono WAV before sending.)

## Suggested 5 clips (cover the real range)
1. `01-clean-greeting` — *"Dober dan."* (clean, easy baseline)
2. `02-cafe-codeswitch` — *"Em… ena kava, prosim… can I get it with mleko?"* (the messy code-switch — the key test)
3. `03-case-error` — an order with a deliberately wrong case ending (tests recast correction)
4. `04-all-english` — *"Sorry, how do I say 'I would like a tea'?"* (learner falls back to English entirely)
5. `05-hesitant` — long pauses, half-words, restarts (tests robustness to real beginner speech)

## Run
```bash
npm run replay
```
For each clip it prints what the tutor *heard*, its Slovenian reply, the correction note, and
per-stage latency, and writes the spoken reply to `fixtures/out/<name>.mp3` so you can listen.
