// Crediting a LIVE session — one grader reading the whole transcript, after the session is over.
//
// The lesson steers the tutor; it does not bound the credit. Every catalog learnable the learner
// produced is credited, in the lesson or not, and the lesson's own targets are counted separately as
// the lesson score (X of Y).
//
// Deciding that a line carries a learnable is language understanding, so it is the grader's reading and
// nothing else's: a word takes whatever form its sentence needs ("kilo krompirja" carries `krompir`), a
// chunk varies the way speech does, a pattern's slot holds anything. The grader is given the catalog and
// how each kind is carried, and it reports every learnable it finds on a learner line.
//
// It reads two accounts of each production, because they fail independently:
//   the learner's line         — the vendor's hearing of them, which is often wrong about Slovene.
//   the tutor's NEXT line      — produced from the AUDIO, so it stays right when the transcript goes wrong.
//
//   SUCCESS — the grader cites the learner line that carries the learnable, that line is Slovene, the
//             form is correct in whatever inflection the sentence needs, the tutor's reply took it up,
//             and the tutor did not recast it. Echoing a phrase the tutor has just modelled still
//             counts: the lessons are heard-first, and "unaided" means NOT RECAST, not "not modelled".
//   ATTEMPT — the grader cites a Slovene learner line that carries it, and the success test fails.
//
// Crediting itself stays where it belongs. The grader emits the same `WitnessResult` envelope tap mode
// emits and `mastery.creditFromEvidence` adjudicates it — so live mode gains credit without the app
// gaining a second crediting path to keep in step.

import { LEARNABLES, type Learnable } from "../learnables";
import type { LearnerModel, LiveTargetReading, TargetEvidence, WitnessResult } from "../types";
import { getE2 } from "../adapters/index";
import * as learner from "../assets/learner";
import * as turnlog from "../assets/turnlog";
import { countsFor, creditFromEvidence, isMastered } from "../mastery";
import * as liveLog from "./log";
import type { LessonScore, LiveSessionLog, LiveTranscript } from "./log";

/** What the grader read for one learnable — the record that makes live credit auditable. */
export interface ChannelReading {
  id: string;
  /** One of the lesson's targets, which is what the lesson score counts. */
  inLesson: boolean;
  /** The tutor's reply to the cited line took the learnable up as understood. */
  uptake: boolean;
  /** Which numbered transcript line the grader read it off. */
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
  lessonScore: LessonScore;
  /** How long the grading call took, for the turn log. */
  gradeMs: number;
  provider: string;
}

/** The learner line a reading points at, by its number in the transcript the grader was given. A number
 *  that is not a learner line is a reading with nothing under it, and it earns nothing. */
function citedLine(transcripts: LiveTranscript[], n: number): string | null {
  const entry = transcripts[n - 1];
  if (!entry || entry.role !== "user") return null;
  return entry.text.trim() || null;
}

/** One learnable's verdict from the grader's reading. Pure, so the rule is tested on plain inputs.
 *
 *  The span the credit rests on is taken FROM the transcript, never from the model: the line the grader
 *  cited, once that line is confirmed to be a Slovene learner line. */
export function readTarget(
  transcripts: LiveTranscript[],
  read: LiveTargetReading,
): { said: string | null; saidLang: string; verdict: "success" | "attempt" | "none" } {
  const cited = citedLine(transcripts, read.saidLine);
  if (!cited || read.saidLang !== "sl") return { said: cited, saidLang: cited ? read.saidLang : "", verdict: "none" };
  const success = read.uptake && read.correct && !read.recast;
  return { said: cited, saidLang: "sl", verdict: success ? "success" : "attempt" };
}

/** X of Y: how many of the lesson's targets the learner produced successfully, and which. */
export function scoreLesson(targets: Learnable[], channels: ChannelReading[]): LessonScore {
  const verdict = new Map(channels.map((c) => [c.id, c.verdict]));
  const ids = targets.map((t) => t.id);
  return {
    total: ids.length,
    succeeded: ids.filter((id) => verdict.get(id) === "success"),
    attempted: ids.filter((id) => verdict.get(id) === "attempt"),
  };
}

/** Read a finished session against the whole catalog. `targets` are the lesson's, and they only decide
 *  the lesson score. Returns null when there is nothing to grade — no learner speech. */
export async function gradeSession(
  transcripts: LiveTranscript[],
  targets: Learnable[],
): Promise<LiveGrade | null> {
  const lines = transcripts.map((t) => ({ role: t.role, text: t.text.trim() })).filter((t) => t.role === "user" && t.text);
  if (!lines.length) return null;

  const e2 = getE2();
  if (!e2.grade) throw new Error(`E2 provider "${e2.name}" cannot grade a live session`);

  const t0 = performance.now();
  const readings = await e2.grade({
    transcript: transcripts.map((t) => ({ role: t.role, text: t.text })),
    catalog: Object.entries(LEARNABLES).map(([id, l]) => ({ id, kind: l.kind, sl: l.sl, gloss: l.gloss })),
  });
  const gradeMs = Math.round(performance.now() - t0);

  const lessonIds = new Set(targets.map((t) => t.id));
  const channels: ChannelReading[] = [];
  const evidence: TargetEvidence[] = [];
  const seen = new Set<string>();

  for (const read of readings) {
    // An id the catalog does not hold, or a second row for one already read, earns nothing.
    if (!LEARNABLES[read.id] || seen.has(read.id)) continue;
    seen.add(read.id);
    const { said, saidLang, verdict } = readTarget(transcripts, read);

    channels.push({
      id: read.id,
      inLesson: lessonIds.has(read.id),
      uptake: read.uptake,
      saidLine: read.saidLine,
      correct: read.correct,
      recast: read.recast,
      said: said ?? "",
      saidLang,
      verdict,
    });

    if (verdict === "none") continue;
    const success = verdict === "success";
    evidence.push({
      id: read.id,
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
      // Deliberately empty. Slovene the catalog does not hold becomes a catalog candidate in free chat,
      // where the transcript is the model's own careful hearing of one clip. A live transcript is the
      // vendor's running hearing of continuous speech, and its mishearings would enter the catalog queue
      // as Slovene words nobody said.
      observed: [],
      role: null,
    },
    channels,
    lessonScore: scoreLesson(targets, channels),
    gradeMs,
    provider: e2.name,
  };
}

/** The evidence a learner model can take. An attempt at a learnable outside the lesson that is already
 *  mastered is dropped: the lesson never asked for it, and an attempt at a mastered item lowers it. */
export function creditable(model: LearnerModel, grade: LiveGrade): WitnessResult {
  const lesson = new Set(grade.channels.filter((c) => c.inLesson).map((c) => c.id));
  return {
    ...grade.evidence,
    targets: grade.evidence.targets.filter(
      (e) => e.correct || lesson.has(e.id) || !isMastered(model.learnables[e.id]),
    ),
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
  // transcript → success or attempt. The allowlist is the whole catalog, because the lesson does not
  // bound the credit. Live mode gains credit, not a second way of granting it.
  const model = learner.load(args.learnerId);
  const credit = creditFromEvidence(model, creditable(model, grade), Object.values(LEARNABLES));
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
      lessonScore: grade.lessonScore,
    },
    creditedCounts: countsFor(saved, credit.progress),
  });

  liveLog.write({ ...log, lessonScore: grade.lessonScore, ...(credit.progress.length ? { credit: credit.progress } : {}) });
}
