---
name: review-lesson-script
description: Review a lesson's dialogue the way the student meets it — as a conversation. Prints the script with `npm run script:lesson` and hands it to a reader who has only that page, so the verdict is about whether the talking makes sense, not about the app. Use when the user asks how a lesson reads, whether the dialogue lands, whether the script is clear to a beginner, or says "review the script", "how does this lesson read", "evaluate the dialogue".
---

# review-lesson-script — read the lesson as a conversation

A lesson is two people talking. This skill asks the one question that matters about the talking: sitting
in a room with the character, would the student follow what is happening and know what to say?

You run the tool and dispatch the reader. The tool decides what the student hears; the reader decides
whether it works. Keep those apart — the value here comes from the reader knowing nothing but the script.

## 1. Print the script

```bash
npm run script:lesson -- <scenarioId> [--level <n>]              # a shipped lesson
npm run script:lesson -- --from <reconcile-input.json> [--level <n>]   # one still being authored
```

`--from` reads the authoring pipeline's reconcile input, so a lesson can be read while it is still a draft.
That is where `create-dialogue` calls this skill (its stage 4b), and it is the moment a finding is cheapest
to act on. Add `--as <fact>=<value>` to read the conversation as the other learner hears it.

It prints the conversation in order: who speaks, the tone they say it in, the Slovene, what it means,
and — where the lesson asks the student to pick between lines — the options and the sentence that
introduces them. Lines that change with a learner fact are listed under FORKS at the end.

Everything else in the lesson file stays behind the tool. That is the design: a reader holding captions,
timings, emphasis, catalog ids and level metadata reviews the app, and the app is a separate question.

If the header says the lesson branches, the page is one way through a tree — say so in your summary.

## 2. Dispatch the reader

One agent, one call. Paste the script into the prompt so the reader works from the page alone:

> You are sitting in a room with the character, listening. This transcript is everything that is said.
> Slovene is new to you.
>
> Go through it in order. At each line, answer two questions: **do I understand what just happened, and
> do I know what I'm supposed to do?**
>
> Then read the whole thing again as a conversation: does it hold together, does everything asked get
> answered, does everything you say get a response, does it end where it was going.
>
> A question may be answered several lines after it is asked — read to the end, then judge what got
> answered.
>
> State each finding as: here is what I heard, and here is why it confused me.
>
> Return: one line per beat — `clear`, `friction`, or `broken`, plus a sentence. Then the findings across
> the whole conversation, worst first, each naming the beat numbers it concerns.

## 3. Report

Relay the reader's verdict: the per-beat lines, then the findings, worst first. Reference beats by their
number and node id (`14 · n11`) so each finding points at something the author can edit.

Findings are observations about a conversation. Fixing them is authoring, which belongs to
`create-dialogue` — offer it, and leave the lesson files alone.

## What a finding looks like

Real ones, from this lesson, in the register to aim for:

- **14 · n11 — broken.** He asks about tomorrow, then says he is the teacher, then turns it back to me,
  and the line I say is "I'm a student." I answered a question he had stopped asking, and nobody ever
  answered the one about tomorrow.
- **9 · n8 — friction.** I told him he is the teacher and he replied by telling me his name. I do not
  know whether I got it right.
- **3 · n3 — friction.** He asks whether I am a *študent* or a *študentka*, and before I answer he asks
  me something else. Two questions arrive and I am holding both.
- **1 · n1 — clear.** *Živjo* is the first thing I hear and I am never asked to say it, which is a gentle
  way in.

Each one is something heard, and why it confused the person hearing it. A note that cannot be put that
way is about the app, and this review does not cover the app.
