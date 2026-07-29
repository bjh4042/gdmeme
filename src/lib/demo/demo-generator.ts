// 연구 시연용 데이터 생성기 v1.0.
// - 결정론적(고정 시드): 같은 날 다시 생성하면 항상 같은 결과.
// - 모든 수치는 생성된 레코드에서 실제로 계산한다(가짜 통계 금지).
// - 미래 날짜 기록은 만들지 않는다.

import { getAllEntries, type LanguageEntry } from "@/data/language";
import { getAllScenarios, type LanguageScenario } from "@/data/language-scenarios";
import { computeTotal, gradeOf, type DictEntry, type StudentRecord } from "@/lib/literacy-types";
import { DEFAULT_DICT_CURRICULUM_CODES } from "@/lib/curriculum-standards";
import { derivedUnlocked, type BadgeStats } from "@/lib/badges";
import { EMPTY_ENGAGEMENT, type StudentEngagement } from "@/stores/engagement";
import { pickBadge, type PracticeState } from "@/lib/practice-storage";
import type { StageKey } from "@/lib/roadmap";
import { DEMO_FOCUS_ITEMS, DEMO_PROFILE_SPECS, type DemoFocusItem } from "./demo-focus";
import {
  DEMO_CLASS_CODE,
  DEMO_LABEL,
  DEMO_NAMESPACE,
  DEMO_VERSION,
  type DemoActivityRecord,
  type DemoAssistantTurn,
  type DemoChallengeDay,
  type DemoChallengeRecord,
  type DemoDataset,
  type DemoStudentProfile,
} from "./demo-types";

const STAGE_ORDER: StageKey[] = ["discover", "dissect", "empathize", "rewrite", "practice"];

const STAGE_LABEL: Record<StageKey, string> = {
  discover: "발견하기",
  dissect: "파헤치기",
  empathize: "공감하기",
  rewrite: "고쳐쓰기",
  practice: "실천하기",
};

/** 결정론적 난수 (mulberry32). */
function makeRng(seedText: string) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i++) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 오늘 기준 daysAgo 일 전 hh시 mm분. 미래 시각은 생성하지 않는다. */
function pastAt(daysAgo: number, hour: number, minute: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - Math.max(0, daysAgo));
  d.setHours(hour, minute, 0, 0);
  const now = new Date();
  return d.getTime() > now.getTime() ? now : d;
}

const RISK_EVAL: Record<string, [number, number, number, number, number]> = {
  // [aggression, bullying, discrimination, violence, grammar_destruction]
  NONE: [1, 1, 1, 1, 1],
  LOW: [2, 1, 1, 1, 2],
  MEDIUM: [4, 3, 2, 2, 3],
  HIGH: [5, 5, 4, 4, 3],
};

function evaluationFor(entry: LanguageEntry) {
  const [aggression, bullying, discrimination, violence, grammar_destruction] =
    RISK_EVAL[entry.riskLevel] ?? RISK_EVAL.NONE;
  return { aggression, bullying, discrimination, violence, grammar_destruction };
}

type Packs = {
  languageById: Map<string, LanguageEntry>;
  scenarioById: Map<string, LanguageScenario>;
};

function loadPacks(): Packs {
  const languageById = new Map(getAllEntries().map((e) => [e.id, e]));
  const scenarioById = new Map(getAllScenarios().map((s) => [s.id, s]));
  return { languageById, scenarioById };
}

function focusByKey(): Map<string, DemoFocusItem> {
  return new Map(DEMO_FOCUS_ITEMS.map((f) => [f.key, f]));
}

const CHALLENGE_MISSIONS = [
  "오늘 친구에게 먼저 인사하기",
  "화날 때 3초 멈추고 말하기",
  "고맙다는 말 한 번 하기",
  "댓글 쓰기 전에 다시 읽기",
  "비속어 대신 감정 낱말 쓰기",
  "친구 이야기 끝까지 듣기",
  "오늘 배운 대체 표현 한 번 쓰기",
];

const STRATEGIES = [
  "perspective_shift",
  "forced_choice",
  "evidence_request",
  "emotion_labeling",
  "reframe_together",
  "small_step_commit",
];

function buildActivities(
  studentId: string,
  spec: (typeof DEMO_PROFILE_SPECS)[number],
  items: DemoFocusItem[],
  packs: Packs,
): DemoActivityRecord[] {
  const rng = makeRng(`${DEMO_NAMESPACE}:act:${studentId}`);
  const stages = STAGE_ORDER.slice(0, spec.stagesDone);
  const out: DemoActivityRecord[] = [];
  let seq = 0;

  items.forEach((item, itemIdx) => {
    const entry = packs.languageById.get(item.languageId);
    stages.forEach((stage, stageIdx) => {
      const daysAgo = Math.max(0, 12 - itemIdx * 2 - stageIdx);
      const at = pastAt(daysAgo, 9 + ((itemIdx + stageIdx) % 7), (stageIdx * 13) % 60);
      const improving = spec.trend === "improving";
      const declining = spec.trend === "declining";
      const retries = declining ? 1 + Math.floor(rng() * 2) : improving && stageIdx > 1 ? 0 : Math.floor(rng() * 2);
      const hintLevel = Math.min(4, Math.max(0, retries + (spec.persona === "shy" ? 1 : 0))) as 0 | 1 | 2 | 3 | 4;
      const judged: DemoActivityRecord["judged"] =
        stage === "empathize" || stage === "practice"
          ? "open"
          : retries === 0
            ? "correct"
            : retries === 1
              ? "partial"
              : "incorrect";
      const misconception =
        item.misconception && (stageIdx <= 1 || spec.persona === "defensive")
          ? item.misconception
          : undefined;
      const stageResult: DemoActivityRecord["stageResult"] = misconception
        ? "stay"
        : judged === "incorrect"
          ? "repeat"
          : "advance";

      out.push({
        id: `${studentId}-act-${++seq}`,
        studentId,
        stage,
        at: at.toISOString(),
        durationSec: 90 + Math.floor(rng() * 240),
        languageId: item.languageId,
        term: entry?.term,
        category: entry?.category,
        scenarioId: item.scenarioId,
        online: item.online,
        situation: item.situation,
        studentInput:
          stage === "discover"
            ? item.studentInput
            : stage === "dissect"
              ? `${entry?.term ?? item.languageId}의 뜻이 뭔지 찾아봤어요.`
              : stage === "empathize"
                ? `이 말을 들은 친구는 ${entry?.emotionImpact?.[0] ?? "속상"}했을 것 같아요.`
                : stage === "rewrite"
                  ? item.alternative
                  : item.reflection,
        chosenAnswer: stage === "rewrite" ? item.alternative : undefined,
        judged,
        hintLevel,
        retries,
        alternative: stage === "rewrite" ? item.alternative : undefined,
        reflection: stage === "practice" ? item.reflection : undefined,
        completed: stage !== "practice" ? true : spec.stagesDone === 5,
        stageResult,
        eklu: {
          intent:
            stage === "discover" ? "expressEmotion" : stage === "rewrite" ? "requestAlternative" : "askMeaning",
          emotion: item.online ? (declining ? "anger" : "frustration") : "sadness",
          intensity: Number((declining ? 0.7 + rng() * 0.2 : 0.3 + rng() * 0.3).toFixed(2)),
          confidence: Number((0.6 + rng() * 0.3).toFixed(2)),
          misconception,
          defensiveResponse: spec.persona === "defensive" && stageIdx <= 1,
          clarificationNeeded: hintLevel >= 2,
          repeatedError: retries >= 2,
        },
      });
    });
  });

  return out.sort((a, b) => a.at.localeCompare(b.at));
}

function buildChallenge(
  studentId: string,
  spec: (typeof DEMO_PROFILE_SPECS)[number],
  goal: string,
  promise: string,
): DemoChallengeRecord {
  const start = startOfToday();
  start.setDate(start.getDate() - 6);
  const stopAfter = spec.challengeStopAfter ?? 7;
  const days: DemoChallengeDay[] = [];
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const withinStop = i < stopAfter;
    const isDone = withinStop && done < spec.challengeDone;
    if (isDone) done++;
    days.push({
      date: isoDate(d),
      dayIndex: i + 1,
      mission: CHALLENGE_MISSIONS[i],
      done: isDone,
      note: isDone ? "실천 완료" : undefined,
    });
  }

  let currentStreak = 0;
  let longestStreak = 0;
  for (const d of days) {
    if (d.done) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const status: DemoChallengeRecord["status"] =
    done === 7
      ? "completed"
      : done === 0
        ? "not_started"
        : spec.challengeStopAfter
          ? days[6].done
            ? "recovered"
            : "stopped"
          : "in_progress";

  return {
    studentId,
    startDate: days[0].date,
    goal,
    promise,
    status,
    days,
    doneCount: done,
    currentStreak,
    longestStreak,
    completedAt: done === 7 ? new Date(`${days[6].date}T18:00:00`).toISOString() : undefined,
  };
}

function buildAssistantTurns(
  studentId: string,
  spec: (typeof DEMO_PROFILE_SPECS)[number],
  items: DemoFocusItem[],
  packs: Packs,
): DemoAssistantTurn[] {
  const rng = makeRng(`${DEMO_NAMESPACE}:asst:${studentId}`);
  const out: DemoAssistantTurn[] = [];
  for (let i = 0; i < spec.assistantTurns; i++) {
    const item = items[i % items.length];
    const entry = packs.languageById.get(item.languageId);
    const scenario = packs.scenarioById.get(item.scenarioId);
    const hintLevel = Math.min(4, (spec.persona === "shy" ? 2 : 1) + (i % 2)) as 0 | 1 | 2 | 3 | 4;
    const resolved = spec.trend !== "declining" || i < spec.assistantTurns - 1;
    const question =
      scenario?.recommendedQuestions?.[0] ?? entry?.reflectionQuestions?.[0] ?? "그때 마음이 어땠어?";
    out.push({
      id: `${studentId}-asst-${i + 1}`,
      studentId,
      at: pastAt(10 - i, 15 + (i % 4), (i * 17) % 60).toISOString(),
      languageId: item.languageId,
      scenarioId: item.scenarioId,
      topic: item.situation,
      studentInput: item.studentInput,
      intent: i === 0 ? "askMeaning" : "requestAlternative",
      emotion: item.online ? "frustration" : "sadness",
      misconception: item.misconception,
      clarificationNeeded: hintLevel >= 2,
      hintLevel,
      strategy: pick(rng, STRATEGIES),
      assistantResponse: `그런 일이 있었구나, 많이 ${item.online ? "답답" : "속상"}했겠다. ${question}`,
      studentFollowUp: resolved ? `그럼 "${item.alternative}"라고 말해볼래요.` : undefined,
      alternativeAdopted: resolved ? item.alternative : undefined,
      resolved,
    });
  }
  return out;
}

function masteryFrom(activities: DemoActivityRecord[]): number {
  if (!activities.length) return 0;
  const scored = activities.map((a) =>
    a.judged === "correct" ? 100 : a.judged === "partial" ? 65 : a.judged === "open" ? 80 : 35,
  );
  const penalty = activities.filter((a) => a.eklu.misconception).length * 3;
  const avg = scored.reduce((s, v) => s + v, 0) / scored.length;
  return Math.max(0, Math.min(100, Math.round(avg - penalty)));
}

export function generateDemoDataset(): DemoDataset {
  const packs = loadPacks();
  const focus = focusByKey();
  const now = new Date().toISOString();

  const profiles: DemoStudentProfile[] = [];
  const students: StudentRecord[] = [];
  const engagement: Record<string, StudentEngagement> = {};
  const practice: Record<string, PracticeState> = {};
  const dict: DictEntry[] = [];
  const activities: DemoActivityRecord[] = [];
  const challenges: DemoChallengeRecord[] = [];
  const assistant: DemoAssistantTurn[] = [];

  let dictId = 900001;
  let classXp = 0;

  for (const spec of DEMO_PROFILE_SPECS) {
    const studentId = `${DEMO_CLASS_CODE}_${spec.number}`;
    const displayName = `학생${spec.number}`;
    const items = spec.focus.map((k) => focus.get(k)).filter(Boolean) as DemoFocusItem[];
    const rng = makeRng(`${DEMO_NAMESPACE}:stu:${studentId}`);

    const acts = buildActivities(studentId, spec, items, packs);
    activities.push(...acts);

    const asst = buildAssistantTurns(studentId, spec, items, packs);
    assistant.push(...asst);

    // 사전 등재: 학생이 다룬 표현 중 앞 2개를 실제 카드로 등록.
    const myDict: DictEntry[] = [];
    for (const item of items.slice(0, 2)) {
      const entry = packs.languageById.get(item.languageId);
      if (!entry) continue;
      const scenario = packs.scenarioById.get(item.scenarioId);
      const evaluations = evaluationFor(entry);
      const total = computeTotal(evaluations);
      myDict.push({
        id: dictId++,
        word: `${entry.term} (${displayName})`,
        student_definition: entry.meaning,
        suggested_by: studentId,
        source: item.online ? "온라인 대화·댓글" : "교실 대화",
        evaluations,
        total_harmful_score: total,
        status: spec.participation === "low" ? "pending" : "approved",
        grade: gradeOf(total).label,
        alternatives: entry.betterExpressions.slice(0, 3),
        curriculum_code: DEFAULT_DICT_CURRICULUM_CODES[0],
        curriculum_codes: [...DEFAULT_DICT_CURRICULUM_CODES],
        timestamp: now.slice(0, 19).replace("T", " "),
        vote_count: 1 + Math.floor(rng() * 6),
        context_note: scenario?.context ?? item.situation,
        listener_effect: entry.emotionImpact?.[0] ?? "마음이 상할 수 있어요",
      });
    }
    dict.push(...myDict);

    const approvedWords = myDict.filter((d) => d.status === "approved").length;

    // 7일 챌린지 · 실천 계획
    const goalItem = items[items.length - 1] ?? DEMO_FOCUS_ITEMS[0];
    const goal = `${goalItem.situation}에서 고운 말로 바꿔 말하겠습니다.`;
    const promise = goalItem.alternative;
    const challenge = buildChallenge(studentId, spec, goal, promise);
    challenges.push(challenge);
    practice[studentId] = {
      plan: {
        goal,
        promise,
        missions: challenge.days.map((d) => d.mission),
        badge: pickBadge(goal, promise),
        updatedAt: now,
      },
      challenge: { startDate: challenge.startDate, days: challenge.days.map((d) => d.done) },
      completedAt: challenge.completedAt,
    };

    // 참여도: 실제 생성된 레코드에서만 집계.
    const reflections = acts.filter((a) => a.reflection);
    const journals = reflections.map((a) => ({
      date: a.at.slice(0, 10),
      text: a.reflection as string,
    }));
    const likesGiven = acts.filter((a) => a.stage === "empathize").length * 2;
    const xp =
      acts.length * 5 + approvedWords * 20 + challenge.doneCount * 10 + asst.length * 3;
    classXp += xp;

    const stats: BadgeStats = {
      approvedWords,
      totalXP: xp,
      votedCount: likesGiven,
      journalStreak: challenge.longestStreak,
    };

    engagement[studentId] = {
      ...EMPTY_ENGAGEMENT,
      likesGivenCount: likesGiven,
      likesReceivedCount: myDict.reduce((s, d) => s + (d.vote_count ?? 0), 0),
      journals,
      streak: challenge.currentStreak,
      lastJournalDate: journals.length ? journals[journals.length - 1].date : undefined,
      unlockedBadges: derivedUnlocked(stats),
      roleplayCleared: spec.stagesDone >= 4 ? ["new-friend", "slang-master"] : [],
      practiceLogs: challenge.days
        .filter((d) => d.done)
        .map((d) => ({ date: d.date, note: d.mission })),
    };

    students.push({
      id: studentId,
      classCode: DEMO_CLASS_CODE,
      number: spec.number,
      name: displayName,
      xp,
      joinedAt: pastAt(20, 9, 0).toISOString(),
      lastActiveAt: acts.length ? acts[acts.length - 1].at : now,
    });

    profiles.push({
      studentId,
      number: spec.number,
      displayName,
      persona: spec.persona,
      trend: spec.trend,
      mastery: masteryFrom(acts),
      participation: spec.participation,
      highestStage: STAGE_ORDER[spec.stagesDone - 1],
      focusCategories: Array.from(
        new Set(items.map((i) => packs.languageById.get(i.languageId)?.category).filter(Boolean)),
      ) as string[],
      note: spec.note,
    });
  }

  return {
    namespace: DEMO_NAMESPACE,
    version: DEMO_VERSION,
    label: DEMO_LABEL,
    generatedAt: now,
    classCode: DEMO_CLASS_CODE,
    profiles,
    students,
    engagement,
    dict,
    practice,
    activities,
    challenges,
    assistant,
    classXp,
  };
}

export { STAGE_ORDER, STAGE_LABEL };