# Atomic experience map — the first five minutes

The [consensus script](SUMMARY.md) decomposed into 171 atomic beats. **One beat = one thing the user
perceives, does, realizes, or feels.** Simultaneous beats are listed separately under the same timestamp
rather than merged.

This is a **user-experience** map. It deliberately says nothing about implementation, and it was written
without regard to what the app can currently do. What it implies for the build is in the handoff, not here.

**Channels** — **VIS** visual · **AUD** audio · **HAP** haptic · **ACT** user action · **COG** realization ·
**AFF** feeling · **ABS** a deliberate absence the user experiences as an event.

> **Setting note.** The beats below are written in the café frame the panel produced.
> [DESIGN-CRITIQUE.md](DESIGN-CRITIQUE.md) supersedes that setting with a **first-meeting** frame. The
> beat *structure* — timings, channels, absences, stall handlers, branch handling — transfers unchanged;
> the setting, the character's motive, and the specific utterances do not.

---

## Segment A — 0:00–0:03 · The frame

| # | t | ch | Beat |
|---|---|---|---|
| 1 | 0:00.0 | ACT | User taps the app icon. |
| 2 | 0:00.0 | ABS | No splash screen. No logo. No brand animation. Screen goes black instantly. |
| 3 | 0:00.0 | ABS | No login, account, profile, language picker, goal-setting, placement quiz, notification permission ask, or onboarding carousel. |
| 4 | 0:00.2 | AUD | Silence. No startup sting, no music. |
| 5 | 0:00.5 | VIS | One line of white text fades up over ~400 ms, centered, large: **"Ljubljana."** |
| 6 | 0:01.2 | VIS | Second line fades in beneath: **"Don't read anything — just listen."** |
| 7 | 0:02.0 | VIS | Third line, smaller and dimmer: **"If you forget something, that's on us."** |
| 8 | 0:02.0 | ABS | No Skip button. A skip affordance here would invite the user to feel they are already behind. |
| 9 | 0:02.4 | COG | ~11 words read. A place, an instruction to be passive, and a promise that failure won't be theirs. |
| 10 | 0:02.8 | AFF | Disorientation resolving into curiosity — *something is about to happen to me* rather than *something is being demanded of me*. |
| 11 | 0:03.0 | VIS | Text fades out. |

## Segment B — 0:03–0:11 · First contact

| # | t | ch | Beat |
|---|---|---|---|
| 12 | 0:03.0 | VIS | The scene fills the screen edge to edge, portrait, no letterboxing. Warm light, late morning. |
| 13 | 0:03.0 | VIS | A character is present, looking directly out at the user. |
| 14 | 0:03.0 | AUD | Room tone arrives in the *same frame* as the image. Ambience, not music. |
| 15 | 0:03.0 | ABS | Zero UI chrome. No back arrow, menu, title bar, app name, progress dots, timer, or settings gear. |
| 16 | 0:03.4 | COG | The setting is understood with no words spent on it: a place, a person, and they are looking at *me*. |
| 17 | 0:04.0 | AUD | They speak — natural speed, warm, unhurried, mixed above the room tone. |
| 18 | 0:04.0 | VIS | They are animate while speaking. A person, not a plate. |
| 19 | 0:05.6 | ABS | Nothing appears. No caption, no translation, no button, no prompt. |
| 20 | 0:05.6 | AFF | The engineered micro-discomfort: *someone spoke to me and I don't know what they said.* |
| 21 | 0:06.0 | COG | Partial comprehension arrives unaided — prosody alone marks a greeting and a question. |
| 22 | 0:07.0 | VIS | They hold. No repeat, no fidget, no fade. Waiting is their posture, and the wait reads as attentive rather than empty. |
| 23 | 0:08.0 | VIS | A single Slovene caption fades in, low on screen. |
| 24 | 0:08.0 | ABS | No English. No phonetic respelling. No parenthetical gloss. |
| 25 | 0:08.2 | COG | Sound → text mapped *retroactively*. Heard before seen, so the text confirms a memory instead of teaching a spelling. |
| 26 | 0:09.0 | AUD | The line re-speaks, slower, split with an audible gap; the stressed syllable carries visibly more weight. |
| 27 | 0:09.0 | VIS | The caption chunks in sync, and the stressed syllable brightens exactly as it is spoken. |
| 28 | 0:10.5 | COG | The user now knows precisely what sound they would have to make. They have not yet been asked to make it. |
| 29 | 0:10.6 | AFF | Anticipation without dread: the answer is on screen before the question is put. |

## Segment C — 0:11–0:16 · The button (the highest-risk five seconds in the product)

| # | t | ch | Beat |
|---|---|---|---|
| 30 | 0:11.0 | VIS | A large circular button rises into the lower third, centered on the thumb arc. The only interactive object on screen. |
| 31 | 0:11.0 | VIS | Not a bare mic glyph — it carries words: **"Hold and say it."** |
| 32 | 0:11.2 | VIS | The Slovene caption *stays*. It does not vanish when the button appears; the target is visible while producing it. |
| 33 | 0:11.5 | VIS | One small grey line beneath: **"Nobody hears this but you."** |
| 34 | 0:11.6 | AFF | The actual barrier — an adult's fear of their mouth failing — is named and defused before it is felt. |
| 35 | 0:12.0 | VIS | The OS microphone permission dialog appears *on top*, with that rationale already legible behind it. |
| 36 | 0:12.1 | COG | The user is permitting a concrete visible act, not an abstract app capability. |
| 37 | 0:13.5 | ACT | User taps Allow. |
| 38 | 0:13.6 | VIS | Dialog dismisses. Nothing else on screen changed. |
| 39 | 0:13.6 | ABS | No confirmation toast, no "Great!", no "now let's begin". The scene simply continues. |
| 40 | 0:14.0 | VIS | The button breathes: a slow ~1 Hz scale pulse. Not a colour flash, arrow, or bouncing tooltip. |
| 41 | 0:14.0 | AUD | Room tone continues. They are still there, still waiting. The silence is populated. |
| 42 | 0:14.5 | AFF | The decision moment. Everything downstream depends on this thumb. |
| 43 | 0:15.5 | VIS | **Stall handler 1** — the caption pulses once, gently. No nagging copy. |
| 44 | 0:18.0 | AUD | **Stall handler 2** — the character says it themselves again, slower. Modelling, not prompting. Never "are you still there?" |
| 45 | 0:22.0 | VIS | **Stall handler 3** — the button label softens to **"Whisper it if you like."** The bar lowers; it never disappears. |

## Segment D — 0:16–0:24 · First production and the 30-second win

| # | t | ch | Beat |
|---|---|---|---|
| 46 | 0:16.0 | ACT | User presses and holds. |
| 47 | 0:16.0 | HAP | A single light tap on press-down. The body confirms that listening started. |
| 48 | 0:16.0 | VIS | The button expands slightly and *holds* the expanded state for as long as it is held. |
| 49 | 0:16.0 | ABS | No waveform, level meter, countdown ring, or "listening…" label. Nothing readable as being measured. |
| 50 | 0:16.0 | AUD | Room tone ducks ~6 dB. The world quiets to listen to them. |
| 51 | 0:16.6 | ACT | User speaks the target. Quietly, badly, probably. |
| 52 | 0:16.6 | ABS | No live transcription. Nothing on screen responds to the *content* of what is being said. |
| 53 | 0:18.0 | ACT | User releases. |
| 54 | 0:18.0 | HAP | A second light tap. The gesture is closed by the user's own hand — the mic never decides when they are done. |
| 55 | 0:18.05 | AUD | A cached backchannel (**"Mhm"**) in the character's voice fires instantly — sooner than any processing could have finished. Perceived latency: zero. |
| 56 | 0:18.05 | VIS | They nod, once, small. |
| 57 | 0:18.6 | AUD | ~0.6 s of the user's **own** recording plays back, low. |
| 58 | 0:18.6 | AFF | The strangest second in the run: *I have never heard my own voice speak Slovene.* |
| 59 | 0:19.5 | ABS | No score, percentage, checkmark, "Correct!", or red anything. **No transcript of what was heard.** |
| 60 | 0:20.0 | AUD | They reply, in character, in Slovene, warmly. |
| 61 | 0:20.0 | AFF | **THE WIN, at second 20.** They did not switch to English. They did not grade me. A Slovenian answered me. |
| 62 | 0:22.0 | COG | The exchange is *continuing*, not concluding. There was no "lesson 1 complete". |
| 63 | 0:22.0 | VIS | Room tone returns to full; their posture shifts to expectant. |

## Segment E — 0:24–0:40 · The second utterance

| # | t | ch | Beat |
|---|---|---|---|
| 64 | 0:24.0 | VIS | A new Slovene caption appears above the button. |
| 65 | 0:24.6 | VIS | *After* it — not with it — a small dim gloss. The first English of the run, four words. |
| 66 | 0:24.8 | VIS | A small ▶ sits on the caption itself. |
| 67 | 0:25.0 | AUD | Without being tapped, the line plays once at natural speed. |
| 68 | 0:26.5 | AUD | It plays a second time, chunked, with real gaps. |
| 69 | 0:26.5 | VIS | The chunks light in sequence with the audio. |
| 70 | 0:28.0 | COG | Heard twice, visible, glossed. They have not been quizzed on anything. |
| 71 | 0:28.0 | ACT | *(optional)* User may tap ▶ any number of times. No counter, no cost, no penalty, no "hint used". |
| 72 | 0:30.0 | ACT | User holds and speaks the target. |
| 73 | 0:30.0 | HAP/VIS/AUD | The same press → expand → duck → release → haptic stack as beats 46–54. Already familiar; learned once, 14 seconds ago. |
| 74 | 0:33.0 | ACT | Many users say it a second time *unprompted* — no failure state to escape and no clock running, so re-attempting costs nothing and feels like their own idea. |
| 75 | 0:34.0 | AUD | The character answers. |
| 76 | 0:34.2 | AUD | A physical consequence sounds. Foley, not a UI sound. |
| 77 | 0:34.2 | VIS | The scene visibly changes. **The image changed because of something they said.** |
| 78 | 0:34.5 | AFF | The diegetic reward — this beat is what replaces the progress bar. |
| 79 | 0:36.0 | COG | *"I did a real thing."* Not *"I completed exercise 2."* |

## Segment F — 0:40–0:55 · The choice (agency, placed after the win)

| # | t | ch | Beat |
|---|---|---|---|
| 80 | 0:40.0 | AUD | The character asks a follow-up. |
| 81 | 0:40.0 | VIS | Slovene caption appears. |
| 82 | 0:40.0 | ABS | **No English gloss this time.** The gloss budget tightens as competence grows, without announcement. |
| 83 | 0:41.0 | VIS | Two options appear *beside* the button, left and right, visibly smaller than it. |
| 84 | 0:41.0 | VIS | The hold-to-talk button stays central and stays the largest object. The options are satellites, never replacements. |
| 85 | 0:42.0 | COG | These read as *things I could say*, not as buttons that answer for me. |
| 86 | 0:43.0 | ACT | User taps one. |
| 87 | 0:43.1 | AUD | It plays aloud. |
| 88 | 0:43.1 | VIS | The tapped line rises and becomes the active caption above the mic. **The turn does not advance.** |
| 89 | 0:44.0 | COG | The single most important learned rule of the product, discovered in one tap and never explained: **tapping previews, speaking advances.** |
| 90 | 0:46.0 | ACT | User holds and speaks it — third production. |
| 91 | 0:48.0 | AUD | The character responds and the exchange moves on. |
| 92 | 0:48.0 | ABS | Nothing anywhere counts to three. |

## Segment G — 0:55–1:12 · The repair (the peak beat)

| # | t | ch | Beat |
|---|---|---|---|
| 93 | 0:55.0 | AUD | The character speaks faster than anything so far, at genuine native pace. |
| 94 | 0:55.0 | ABS | No caption. Nothing appears. |
| 95 | 0:57.0 | AFF | Real, engineered incomprehension — the first time the user is stuck. |
| 96 | 0:57.2 | COG | Crucially, they are stuck in a way that is plainly *the situation's* fault. Nothing implies they failed. |
| 97 | 0:58.5 | VIS | One short line appears, quietly, above the button: **Ne razumem.** |
| 98 | 0:58.5 | ABS | No English. No label. No explanation of what this phrase is or why it appeared. |
| 99 | 0:59.0 | AUD | It plays once. |
| 100 | 1:00.0 | COG | The user *infers* the meaning from where it appeared and when. Nobody taught it — the situation taught it. |
| 101 | 1:02.0 | ACT | User holds and says **"Ne razumem."** — fourth production. |
| 102 | 1:03.5 | AUD | The character reacts humanly, then audibly slows and simplifies. |
| 103 | 1:03.5 | VIS | A visual carries the meaning the audio could not. |
| 104 | 1:04.0 | AFF | **THE PEAK OF THE RUN.** They changed another person's behaviour with a Slovene sentence. Not a scripted consequence — a social one. |
| 105 | 1:06.0 | COG | The durable takeaway, worth more than the phrase itself: *I cannot get stranded. There is a move for being lost.* |
| 106 | 1:08.0 | ACT | The exchange resolves. |

## Segment H — 1:12–1:50 · The cut into live (invisible)

| # | t | ch | Beat |
|---|---|---|---|
| 107 | 1:12.0 | ABS | **Nothing changes.** No transition, loading, new screen, "Now try it for real →", or button labelled *AI Tutor*. Same scene, same character, same room tone, same button. |
| 108 | 1:12.0 | COG | The user does not know anything changed. The design's most valuable property: **there is no threshold to cross into the scary part.** |
| 109 | 1:14.0 | AUD | The character asks something genuinely responsive for the first time. |
| 110 | 1:14.0 | ABS | No caption, no gloss, no option chips. The scaffolding is gone. |
| 111 | 1:15.0 | COG | The user does not register a removal — they register that they *understood*. |
| 112 | 1:16.0 | COG | Cold retrieval: an owned phrase must come from memory, ~45 s after last spoken, with nothing on screen. |
| 113 | 1:18.0 | ACT | User holds and produces — possibly mangled, possibly with an English word in it. |
| 114 | 1:20.0 | — | **Branch A · clean:** the character proceeds in character, with no acknowledgement of correctness. |
| 115 | 1:20.0 | — | **Branch B · mangled:** one recast, phrased as a question, in character. Not flagged as an error, not marked, not counted. The user simply says it again. **One recast maximum, ever.** |
| 116 | 1:20.0 | — | **Branch C · silence >6 s:** narrowed to a spoken binary. No timeout screen, no "are you still there", never stranded. |
| 117 | 1:25.0 | — | **Branch D · English:** absorbed and answered *in Slovene* as if it had been Slovene. No mode switch, no correction, no "please try in Slovene". |
| 118 | 1:26.0 | AFF | Branch D is the trust signal that beats every UI polish: *they never abandon me and never punish me.* |
| 119 | 1:30.0 | ACT | A second free turn. The user is improvising with three owned chunks and is unaware they have left any script. |
| 120 | 1:44.0 | AUD | The character closes. |
| 121 | 1:46.0 | ACT | The user says it back unprompted — because it is a goodbye and humans return goodbyes. Fifth production, entirely self-initiated. |
| 122 | 1:46.0 | ABS | Nothing on screen acknowledges that a fifth thing happened. |

## Segment I — 1:50–2:00 · The close

| # | t | ch | Beat |
|---|---|---|---|
| 123 | 1:50.0 | VIS | The scene dims and desaturates but does not disappear. The character stays visible, softened, still there. |
| 124 | 1:50.0 | AUD | Room tone drops to a whisper. |
| 125 | 1:51.0 | VIS | Four cards slide in **in the order the user said them**, not in curriculum order. |
| 126 | 1:51.0 | ABS | No English on the cards. |
| 127 | 1:52.0 | COG | The absence of English *is* the payoff: they read four Slovene lines and understand all four. |
| 128 | 1:52.5 | ACT | User taps one. |
| 129 | 1:52.6 | AUD | It plays **their own recording** — not the native model. |
| 130 | 1:53.0 | AFF | Evidence, not a promise. A phrase list is a claim; a recording of your own voice is proof. |
| 131 | 1:55.0 | VIS | One line above the cards states what they just did. It states an **event**. It does not praise. |
| 132 | 1:56.0 | ABS | No score, accuracy, "3 of 4", XP, streak, "Day 1", A1 label, share sheet, rating prompt, email capture, or push-notification ask. |
| 133 | 1:57.0 | AUD | One last line, **spoken not written**, pointing at a real-world act tomorrow. Gloss appears after. |
| 134 | 1:58.0 | VIS | One small affordance. Nothing else. No modal, no demanded next step. |
| 135 | 1:58.0 | AFF | The open loop. The user is carrying an instruction into their real day. |
| 136 | 2:00.0 | ABS | If they close the app here, the run ended correctly and nothing chases them. |

## Segment J — 2:00–3:00 · The variation (same win, real pressure)

| # | t | ch | Beat |
|---|---|---|---|
| 137 | 2:00 | ACT | User taps the single affordance. |
| 138 | 2:01 | VIS | Same scene, same character, same light. No recap, no "welcome back", no summary of last time. |
| 139 | 2:03 | AUD | They greet the user *differently* — recognition. The world remembers them. |
| 140 | 2:03 | ABS | No caption for the greeting. The user owns it now, and the app silently acts as if they do. |
| 141 | 2:08 | ACT | The known utterance is attempted fully cold — no caption, no gloss, no ▶. **First entirely unaided production.** |
| 142 | 2:12 | AUD | **The complication:** the memorised line no longer works in this situation. |
| 143 | 2:14 | AFF | The first genuine problem, landing only after the base case has been won twice. |
| 144 | 2:18 | AUD | The character offers a way out — one new noun, delivered into a frame the user already owns. |
| 145 | 2:24 | ACT | The user produces their first **composed** utterance. They swapped a slot in a frame nobody told them was a frame. |
| 146 | 2:24 | AFF | **The most important cognitive event of the first five minutes.** It stops being mimicry. They generated Slovene. |
| 147 | 2:30 | ABS | Nothing marks this as a milestone. No badge, no "new skill unlocked". The only acknowledgement is that it worked. |

## Segment K — 3:00–4:00 · The widening (where immersion actually takes hold)

| # | t | ch | Beat |
|---|---|---|---|
| 148 | 3:02 | AUD | A second voice enters the scene. Fast, real Slovene the user is *not* expected to understand. |
| 149 | 3:02 | ABS | No caption for it. It is texture, not content. |
| 150 | 3:05 | AFF | The room got bigger. They are standing in a place, not sitting in an exercise. |
| 151 | 3:10 | AUD | The character asks something adjacent and personal. |
| 152 | 3:10 | ABS | No phrase offered. No chip. No gloss. No suggestion. |
| 153 | 3:14 | AFF | Productive difficulty — a wall they *want* to get over, arriving three minutes after their first win rather than at second 15. |
| 154 | 3:18 | ACT | They try in English. |
| 155 | 3:20 | AUD | It is absorbed without a flicker: English in, Slovene out, and they are handed a word they now own. |
| 156 | 3:22 | COG | The rule now confirmed three ways: *English never breaks the world, and never costs me anything.* |
| 157 | 3:30 | ACT | They repeat the new word back, unprompted, testing it in their mouth. Nobody asked them to. |
| 158 | 3:30 | AFF | Voluntary practice — the first behaviour in the run that no affordance requested. |
| 159 | 3:45 | COG | They have not seen a menu, score, level, or screen boundary since second 3. |

## Segment L — 4:00–5:00 · Their first real choice

| # | t | ch | Beat |
|---|---|---|---|
| 160 | 4:05 | AUD | The exchange resolves; the character closes warmly. |
| 161 | 4:10 | VIS | The app's own surface appears for the very first time — **not** a home screen of tiles. The scene dims and the view pulls back to a **street**. |
| 162 | 4:12 | VIS | Destinations are rendered as *places* on that street, with images. |
| 163 | 4:12 | COG | Curriculum is presented as **geography, not levels**. They choose somewhere to go, not a difficulty to attempt. |
| 164 | 4:18 | VIS | The replay strip is now 8–10 cards across both visits, still in the order spoken, still in their own voice. |
| 165 | 4:20 | VIS | One card looks different — the composed one carries a tiny note: **"you made this one up."** |
| 166 | 4:20 | AFF | The only "progress" statement in five minutes, and it names a **capability** rather than a quantity. |
| 167 | 4:30 | VIS | One place glows softly, captioned in Slovene with no gloss. |
| 168 | 4:35 | COG | They can guess what the next scene will demand, and they already know the frame it will use. |
| 169 | 4:40 | ACT | They tap a place — or they close the app holding the spoken instruction from beat 133. |
| 170 | 4:40 | ABS | Still no score, streak, XP, A1 screen, daily goal, notification ask, or account. Five minutes in, the app has never once measured them. |
| 171 | 4:40 | COG | The street is visibly **finite** — a countable set of places, some lit. This is the A1 map, rendered as somewhere to go. |

---

## What is doing the immersing, by moment

**At 0:30** — one thing: *they answered me and didn't switch to English.* Nothing else has landed yet.

**At 2:00** — three things: the world changes because of my voice; my own recording is proof I did it;
there is a phrase that rescues me when I am lost.

**At 5:00** — five things, and these are what actually hold a user:

1. I have never seen a menu or a screen boundary.
2. I invented a sentence nobody taught me.
3. English never breaks the world and never costs me.
4. There is Slovene around me I am not required to understand, so the place is bigger than the task.
5. The next thing is a **place I could walk to**, not a level I have to unlock.

## The gap this map does not cover

The beats above specify **structure**. The 200 ms *feel* of beats 46–57 — the press, the duck, the
haptics, the cached backchannel — is a craft layer the panel had no seat for and could not supply. That
is the axis on which mass-market apps win, and it remains unspecified.
