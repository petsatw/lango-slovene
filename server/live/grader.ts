// Crediting a LIVE session — one grader, two evidence channels, after the session is over.
//
// A finished session leaves two accounts of what the learner said, and they fail independently:
//
//   the ASR channel           — the learner's own transcript line, which is the vendor's hearing of
//                               them. Read here deterministically by the matcher (./match.ts).
//   the comprehension channel — the tutor's NEXT line, which was produced from the AUDIO rather than
//                               from that transcript. It stays right when the transcript goes wrong.
//
// The grader — a conservative marker reading the whole transcript — decides success; the matcher is a
// second opinion that is logged, and that can grant an attempt on its own:
//   ATTEMPT — either channel fires. Granted liberally; a beginner who tried is the thing being measured.
//   SUCCESS — the grader cites the learner line that carries the target, that line is Slovene, the form
//             is correct in whatever inflection the sentence needs, the tutor's reply took it up, and the
//             tutor did not recast it. The matcher is not required: it compares text, so "kilo krompirja"
//             never matches "krompir", and a correct production the tutor understood is credit due.
//             Echoing a phrase the tutor has just modelled still counts: the lessons are heard-first,
//             and "unaided" means NOT RECAST, not "not modelled".
//
// Crediting itself stays where it belongs. The grader emits the same `WitnessResult` envelope tap mode
// emits and `mastery.creditFromEvidence` adjudicates it — so live mode gains credit without the app
// gaining a second crediting path to keep in step.

import type { Learnable } from "../learnables";
import type { LiveTargetReading, TargetEvidence, WitnessResult } from "../types";
import { getE2 } from "../adapters/index";
import * as learner from "../assets/learner";
import * as turnlog from "../assets/turnlog";
import { countsFor, creditFromEvidence } from "../mastery";
import { matchTarget, type MatchVia } from "./match";
import * as liveLog from "./log";
import type { LiveSessionLog, LiveTranscript } from "./log";

/** What each channel said about one target — the record that makes live credit auditable, and, kept per
 *  session, the data that says how often the two channels agree. */
export interface ChannelReading {
  id: string;
  /** The learner's own line carried the target. Deterministic, from the transcript, no model involved. */
  asr: boolean;
  /** How it landed, when it did — an exact surface, a recorded mishearing, or edit distance. */
  asrVia: MatchVia | null;
  /** The tutor's reply to the cited line took the target up as understood. The model's judgement. */
  uptake: boolean;
  /** Which numbered transcript line the grader read the target off. 0 when it found none. */
  saidLine: number;
  correct: boolean;
  recast: boolean;
  /** The learner line the credit rests on, verbatim from the transcript. */
  said: string;
  saidLang: string;
  verdict: "success" | "attempt" | "none";
}

export interface LiveGrade {
  /** The envelope the shared firewall adjudicates. */
  evidence: WitnessResult;
  channels: ChannelReading[];
  /** How long the grading call took, for the turn log. */
  gradeMs: number;
  provider: string;
}

/** The learner's own lines, with the transcript numbers the grader sees — the only text the ASR channel
 *  may read, and the numbers that let the two channels be checked against each other. */
function learnerLines(transcripts: LiveTranscript[]): { line: number; text: string }[] {
  return transcripts
    .map((t, i) => ({ line: i + 1, text: t.text.trim(), role: t.role }))
    .filter((t) => t.role === "user" && t.text)
    .map(({ line, text }) => ({ line, text }));
}

/** The line the grader pointed at, by its number in the transcript it was given. A number that is not a
 *  learner line is a reading with nothing under it, and it earns nothing. */
function citedLine(transcripts: LiveTranscript[], n: number): string | null {
  const entry = transcripts[n - 1];
  if (!entry || entry.role !== "user") return null;
  return entry.text.trim() || null;
}

/** One target's verdict from the two channels. Pure, so the rule is tested on plain inputs.
 *
 *  The span the credit rests on is taken FROM the transcript, never from the model: the line the grader
 *  cited, once that line is confirmed to be a learner line, or else the line the matcher fired on. That
 *  keeps the firewall's span check meaningful when the canonical Slovene is nowhere in the text — under
 *  a mishearing, or an inflection ("kilo krompirja" for `krompir`). */
export function readTarget(
  transcripts: LiveTranscript[],
  asrHit: { line: number; text: string } | null,
  read: LiveTargetReading | undefined,
): { said: string | null; saidLang: string; verdict: "success" | "attempt" | "none" } {
  const cited = read ? citedLine(transcripts, read.saidLine) : null;
  // The matcher IS language evidence for a line it fired on — it compared it against known Slovene.
  // Anywhere else the grader's label decides, which is where an English answer has to be caught.
  const citedLang = cited ? (asrHit?.line === read!.saidLine ? "sl" : read!.saidLang ?? "") : "";
  const useCited = !!cited && citedLang === "sl";
  const said = useCited ? cited : (asrHit?.text ?? cited);
  const saidLang = useCited || asrHit ? "sl" : citedLang;

  // Success is about ONE production: the cited line, taken up by the tutor's reply to it. Uptake is read
  // off the reply to that same line, so the tutor's own opening greeting is never evidence the learner
  // greeted it back.
  const success = useCited && read!.uptake === true && read!.correct === true && read!.recast !== true;
  const fired = success || ((!!asrHit || read?.uptake === true) && !!said && saidLang === "sl");
  return { said, saidLang, verdict: !fired ? "none" : success ? "success" : "attempt" };
}

/** Read a finished session against the target set it was opened with. Returns null when there is
 *  nothing to grade — no learner speech, or a lesson that put no targets in play. */
export async function gradeSession(
  transcripts: LiveTranscript[],
  targets: Learnable[],
): Promise<LiveGrade | null> {
  const lines = learnerLines(transcripts);
  if (!lines.length || !targets.length) return null;

  const e2 = getE2();
  if (!e2.grade) throw new Error(`E2 provider "${e2.name}" cannot grade a live session`);

  const t0 = performance.now();
  const readings = await e2.grade({
    transcript: transcripts.map((t) => ({ role: t.role, text: t.text })),
    targets: targets.map((t) => ({ id: t.id, kind: t.kind, sl: t.sl, gloss: t.gloss })),
  });
  const gradeMs = Math.round(performance.now() - t0);

  const byId = new Map<string, LiveTargetReading>(readings.map((r) => [r.id, r]));
  const channels: ChannelReading[] = [];
  const evidence: TargetEvidence[] = [];

  for (const target of targets) {
    const asrHit = lines
      .map((l) => ({ ...l, match: matchTarget(l.text, target) }))
      .find((l) => l.match.matched);
    const read = byId.get(target.id);
    const { said, saidLang, verdict } = readTarget(transcripts, asrHit ?? null, read);

    channels.push({
      id: target.id,
      asr: !!asrHit,
      asrVia: asrHit?.match.via ?? null,
      uptake: read?.uptake === true,
      saidLine: read?.saidLine ?? 0,
      correct: read?.correct === true,
      recast: read?.recast === true,
      said: said ?? "",
      saidLang,
      verdict,
    });

    if (verdict === "none") continue;
    const success = verdict === "success";
    evidence.push({
      id: target.id,
      produced: true,
      said: said!,
      saidLang,
      correct: success,
      confidence: success ? 1 : 0.5,
    });
  }

  return {
    evidence: {
      reply: "",
      replyGloss: "",
      // The learner's lines, one per line, so the firewall's span check runs against exactly the text
      // the grader was shown and nothing else.
      transcriptVerbatim: lines.map((l) => l.text).join("\n"),
      userGloss: "",
      utteranceLang: "sl",
      targets: evidence,
      // Deliberately empty. Off-target Slovene becomes a catalog candidate in free chat, where the
      // transcript is the model's own careful hearing of one clip. A live transcript is the vendor's
      // running hearing of continuous speech, and its mishearings would enter the catalog queue as
      // Slovene words nobody said.
      observed: [],
      role: null,
    },
    channels,
    gradeMs,
    provider: e2.name,
  };
}

/** Grade a session that has just ended and move the learner model with it.
 *
 *  It runs AFTER teardown, on nothing the learner is waiting for: the socket is closed, the transcript
 *  is written, and the only thing still outstanding is the bookkeeping. Best-effort by the same
 *  discipline the rest of the live path keeps — a grade that fails leaves the session log exactly as it
 *  was written and costs the learner nothing. */
export async function creditSession(args: {
  learnerId: string;
  /** The instructions the tutor actually ran on — logged so a verdict can be read against the prompt
   *  that produced the conversation. */
  instructions: string;
  targets: Learnable[];
  log: LiveSessionLog;
}): Promise<void> {
  const { log, targets } = args;
  const grade = await gradeSession(log.transcripts, targets);
  if (!grade) return;

  // The same firewall the tap mode runs on: allowlist → produced → Slovene → the span is in the
  // transcript → success or attempt. Live mode gains credit, not a second way of granting it.
  const model = learner.load(args.learnerId);
  const credit = creditFromEvidence(model, grade.evidence, targets);
  const saved = credit.progress.length ? learner.save(args.learnerId, credit.model) : credit.model;

  turnlog.record({
    path: "live",
    retain: log.retain,
    provider: grade.provider,
    model: process.env.GEMINI_MODEL,
    e2Ms: grade.gradeMs,
    systemPrompt: args.instructions,
    history: log.transcripts.map((t) => ({ role: t.role, text: t.text })),
    output: {
      userVerbatim: grade.evidence.transcriptVerbatim,
      userSaid: "",
      tutorReply: "",
      correction: "",
      learnableProgress: credit.progress,
      objectiveProgress: [],
      focusObjectiveId: "",
    },
    live: {
      sessionId: log.sessionId,
      lessonId: log.lessonId,
      liveProvider: log.provider,
      channels: grade.channels,
    },
    creditedCounts: countsFor(saved, credit.progress),
  });

  if (credit.progress.length) liveLog.write({ ...log, credit: credit.progress });
}
