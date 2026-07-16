// 「바른말 수호 5단계」 학습 로드맵 — 순수 파생/유틸.
// 기존 스토어 데이터(engagement, dict, weekly-survey, roster)만 읽어 단계 완료를
// 추론한다. 신규 스키마 변경 없이 안전 확장 가능하도록 설계.

import type { DictEntry, StudentRecord } from "./literacy-types";
import type { StudentEngagement } from "@/stores/engagement";
import { loadMyAnswer, isoWeekKey } from "./weekly-survey";

export type StageKey = "discover" | "dissect" | "empathize" | "rewrite" | "practice";

export type StageMeta = {
  key: StageKey;
  order: number;
  icon: string;
  title: string;
  short: string;
  desc: string;
  hint: string; // 학생용 안내
  oneLiner: string; // 로드맵 카드에 항상 노출되는 한 줄 안내(문구 통일)
  color: string; // tailwind bg tone
  tabHint: "analyze" | "chat" | "assist" | "quiz" | "dict";
};

export const STAGES: StageMeta[] = [
  {
    key: "discover",
    order: 1,
    icon: "🔎",
    title: "발견하기",
    short: "발견",
    desc: "대화·댓글·게임 채팅 속 문제가 될 수 있는 표현을 스스로 찾아봐요.",
    hint: "밈 분석기나 우리말 사전에서 낯선 말을 하나 골라볼까요?",
    oneLiner: "궁금한 표현을 찾아보아요.",
    color: "bg-sky-100 text-sky-900 border-sky-300",
    tabHint: "analyze",
  },
  {
    key: "dissect",
    order: 2,
    icon: "📖",
    title: "파헤치기",
    short: "파헤치기",
    desc: "표현의 뜻·유래·숨은 비하 요소를 확인해요. 좋은 말/나쁜 말이 아니라 맥락을 살펴요.",
    hint: "새 낱말을 사전에 등록하거나, 사전 카드를 자세히 열어봐요.",
    oneLiner: "뜻과 생겨난 배경을 살펴보아요.",
    color: "bg-indigo-100 text-indigo-900 border-indigo-300",
    tabHint: "dict",
  },
  {
    key: "empathize",
    order: 3,
    icon: "💗",
    title: "공감하기",
    short: "공감",
    desc: "그 말을 들은 사람의 마음과 관계에 미치는 영향을 생각해요.",
    hint: "친구의 사전 등록이나 성찰 글에 공감(👍💡👏)을 3개 이상 남겨봐요.",
    oneLiner: "이 말을 들은 사람의 기분을 생각해 보아요.",
    color: "bg-rose-100 text-rose-900 border-rose-300",
    tabHint: "assist",
  },
  {
    key: "rewrite",
    order: 4,
    icon: "✏️",
    title: "바꾸기",
    short: "바꾸기",
    desc: "상처를 줄 수 있는 표현을 존중하고 정확한 표현으로 바꿔봐요.",
    hint: "성찰 저널에 오늘 바꾼 표현과 그 이유를 한 문장 적어봐요.",
    oneLiner: "더 존중하는 표현으로 바꾸어 보아요.",
    color: "bg-amber-100 text-amber-900 border-amber-300",
    tabHint: "chat",
  },
  {
    key: "practice",
    order: 5,
    icon: "🌱",
    title: "실천하기",
    short: "실천",
    desc: "교실·가정·온라인에서 바른 표현을 실제로 사용하고, 짧은 성찰을 남겨요.",
    hint: "이번 주 성찰 설문에 응답하거나, 실천 미션을 체크해요.",
    oneLiner: "오늘 배운 표현을 생활에서 실천해 보아요.",
    color: "bg-emerald-100 text-emerald-900 border-emerald-300",
    tabHint: "quiz",
  },
];

export type StageStatus = {
  key: StageKey;
  done: boolean;
  progress: number; // 0..1
  detail: string; // 사람에게 보여줄 진행 상태 한 줄
};

export type RoadmapProgress = {
  stages: StageStatus[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  currentIndex: number; // 다음 도전 단계
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * 학생 한 명의 5단계 진행 상태를 파생한다. 순수 함수 — 훅 아님.
 * 기존 데이터(engagement / dict / weekly-survey / practiceLogs)만 사용.
 */
export function deriveRoadmap(input: {
  studentId: string;
  classCode: string;
  engagement?: StudentEngagement;
  dict: DictEntry[];
}): RoadmapProgress {
  const { studentId, classCode, engagement, dict } = input;
  const eng = engagement;
  const proposedByMe = dict.filter((d) => d.suggested_by === studentId);
  const approvedByMe = proposedByMe.filter((d) => d.status === "approved").length;
  const likesGiven = eng?.likesGivenCount ?? 0;
  const journals = eng?.journals?.length ?? 0;
  const streak = eng?.streak ?? 0;
  const practiceLogs = eng?.practiceLogs?.length ?? 0;

  // 주간 설문 응답 여부 (이번 주 기준)
  let surveyThisWeek = false;
  try {
    const ans = loadMyAnswer(classCode, studentId);
    surveyThisWeek = !!ans && ans.weekKey === isoWeekKey();
  } catch {
    /* storage/parse 실패 무시 */
  }

  // 1) 발견하기 — 사전 열람/제안 or 로그인만으로도 시작. 첫 제안 있으면 100%.
  const discoverProg = proposedByMe.length > 0 ? 1 : likesGiven > 0 || journals > 0 ? 0.5 : 0;
  // 2) 파헤치기 — 사전 신규 제안 1건 이상
  const dissectProg = clamp01(proposedByMe.length / 1);
  // 3) 공감하기 — 다른 친구 글/사전에 공감 3개 이상
  const empathizeProg = clamp01(likesGiven / 3);
  // 4) 바꾸기 — 성찰 저널 1편 이상 (본인이 표현을 다시 쓰는 활동)
  const rewriteProg = clamp01(journals / 1);
  // 5) 실천하기 — 주간 설문 응답 또는 실천 로그 1건 이상 또는 3일 연속 저널
  const practiceProg =
    surveyThisWeek || practiceLogs > 0 || streak >= 3 ? 1 : Math.min(0.5, streak / 3);

  const stages: StageStatus[] = [
    {
      key: "discover",
      progress: discoverProg,
      done: discoverProg >= 1,
      detail:
        proposedByMe.length > 0
          ? `사전에 ${proposedByMe.length}개 제안했어요`
          : "사전에서 낯선 말을 하나 살펴봐요",
    },
    {
      key: "dissect",
      progress: dissectProg,
      done: dissectProg >= 1,
      detail:
        approvedByMe > 0
          ? `내가 등록한 낱말 ${proposedByMe.length}개 (승인 ${approvedByMe}개)`
          : proposedByMe.length > 0
            ? `내가 등록한 낱말 ${proposedByMe.length}개 · 승인 대기`
            : "새 낱말을 사전에 등록하며 뜻·유래를 살펴봐요",
    },
    {
      key: "empathize",
      progress: empathizeProg,
      done: empathizeProg >= 1,
      detail: `친구 글에 남긴 공감 ${likesGiven}개 / 3`,
    },
    {
      key: "rewrite",
      progress: rewriteProg,
      done: rewriteProg >= 1,
      detail: journals > 0 ? `성찰 저널 ${journals}편` : "성찰 저널에 오늘의 한 문장을 남겨봐요",
    },
    {
      key: "practice",
      progress: practiceProg,
      done: practiceProg >= 1,
      detail: surveyThisWeek
        ? "이번 주 성찰 설문에 응답했어요"
        : practiceLogs > 0
          ? `실천 체크 ${practiceLogs}회 · 연속 저널 ${streak}일`
          : `연속 저널 ${streak}일 · 실천 체크로도 완료돼요`,
    },
  ];

  const completedCount = stages.filter((s) => s.done).length;
  const totalCount = stages.length;
  const currentIndex = stages.findIndex((s) => !s.done);
  return {
    stages,
    completedCount,
    totalCount,
    allDone: completedCount === totalCount,
    currentIndex: currentIndex < 0 ? totalCount - 1 : currentIndex,
  };
}

export function getStage(key: StageKey): StageMeta {
  return STAGES.find((s) => s.key === key)!;
}

/** 학급 단위 5단계별 완료율 집계 — 교사 대시보드에서 사용. */
export function aggregateRoadmap(input: {
  students: StudentRecord[];
  classCode?: string;
  byStudent: Record<string, StudentEngagement>;
  dict: DictEntry[];
}) {
  const { students, classCode, byStudent, dict } = input;
  const scope = classCode ? students.filter((s) => s.classCode === classCode) : students;
  const perStage: Record<StageKey, { done: number; sum: number }> = {
    discover: { done: 0, sum: 0 },
    dissect: { done: 0, sum: 0 },
    empathize: { done: 0, sum: 0 },
    rewrite: { done: 0, sum: 0 },
    practice: { done: 0, sum: 0 },
  };
  const perStudent = scope.map((s) => {
    const rm = deriveRoadmap({
      studentId: s.id,
      classCode: s.classCode,
      engagement: byStudent[s.id],
      dict,
    });
    for (const st of rm.stages) {
      perStage[st.key].sum += st.progress;
      if (st.done) perStage[st.key].done += 1;
    }
    return { student: s, roadmap: rm };
  });
  const totalStudents = perStudent.length || 1;
  const summary = (Object.keys(perStage) as StageKey[]).map((k) => ({
    key: k,
    stage: getStage(k),
    doneCount: perStage[k].done,
    doneRate: perStage[k].done / totalStudents,
    avgProgress: perStage[k].sum / totalStudents,
  }));
  const activeCount = perStudent.filter((p) => p.roadmap.completedCount > 0).length;
  const finishedCount = perStudent.filter((p) => p.roadmap.allDone).length;
  return {
    perStudent,
    perStageSummary: summary,
    totalStudents: perStudent.length,
    activeCount,
    finishedCount,
  };
}
