// 주간 언어생활 성찰 설문 — 학급별 localStorage 격리 저장.
// 월/금 접속 시 팝업 트리거하고, 설문 결과를 학급 언어 기상도에 반영한다.

export type WeeklySurveyAnswer = {
  weekKey: string; // e.g. "2025-W28"
  answeredAt: string; // ISO
  heard: boolean; // "들은 적 있나요?" 예/아니오
  words?: string[]; // 예 선택 시 사전 등록 단어 / 자유 입력
  count?: number; // 들은 횟수
};

export type WeeklySurveyAggregate = {
  noVotes: number; // "아니오" 응답 수
  yesVotes: number; // "예" 응답 수
  incidentCount: number; // 누적 사용 횟수
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** ISO 8601 주(week) 키 — "YYYY-Www" 형식. */
export function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
}

/** 월(1) 또는 금(5) 요일이면 트리거. */
export function isSurveyDayToday(d = new Date()) {
  const day = d.getDay();
  return day === 1 || day === 5;
}

const ANSWER_KEY = (classCode: string, studentId: string) =>
  `wtmeme:survey:answer:${classCode || "guest"}:${studentId || "anon"}`;
const AGG_KEY = (classCode: string) => `wtmeme:survey:agg:${classCode || "guest"}`;

export function loadMyAnswer(classCode: string, studentId: string): WeeklySurveyAnswer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANSWER_KEY(classCode, studentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklySurveyAnswer;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadAggregate(classCode: string): Record<string, WeeklySurveyAggregate> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(AGG_KEY(classCode));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as Record<string, WeeklySurveyAggregate>;
  } catch {}
  return {};
}

export function submitAnswer(
  classCode: string,
  studentId: string,
  input: Omit<WeeklySurveyAnswer, "answeredAt" | "weekKey">,
): WeeklySurveyAnswer {
  const answer: WeeklySurveyAnswer = {
    ...input,
    weekKey: isoWeekKey(),
    answeredAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(ANSWER_KEY(classCode, studentId), JSON.stringify(answer));
    const agg = loadAggregate(classCode);
    const cur = agg[answer.weekKey] ?? { noVotes: 0, yesVotes: 0, incidentCount: 0 };
    if (answer.heard) {
      cur.yesVotes += 1;
      cur.incidentCount += Math.max(0, Math.min(50, Number(answer.count ?? 0) || 0));
    } else {
      cur.noVotes += 1;
    }
    agg[answer.weekKey] = cur;
    window.localStorage.setItem(AGG_KEY(classCode), JSON.stringify(agg));
  } catch {}
  return answer;
}

/**
 * 학급 언어 기상도 최종 점수 산출.
 *  - baseHarm: 사전 승인 단어 평균 유해 점수 (기존 방식)
 *  - awarenessBonus: 사전 등재 건수가 늘어날수록 경각심↑ → 기상도↑ (점수↓)
 *  - surveyImpact: 설문 응답에 따라 가감
 *      · "아니오" 비율이 높을수록 큰 폭 감산 (맑음)
 *      · "예" 응답의 사용 횟수 누적은 흐림
 */
export function computeWeatherScore(params: {
  baseHarm: number;
  approvedCount: number;
  aggregate?: WeeklySurveyAggregate;
}): number {
  const { baseHarm, approvedCount, aggregate } = params;
  const awarenessBonus = Math.min(30, approvedCount * 1.5);
  let surveyImpact = 0;
  if (aggregate) {
    const total = aggregate.noVotes + aggregate.yesVotes;
    if (total > 0) {
      const noRatio = aggregate.noVotes / total;
      surveyImpact -= Math.round(noRatio * 25); // 아니오 비율 → 최대 -25
      surveyImpact += Math.min(45, aggregate.incidentCount * 2); // 사용 횟수 누적 → 최대 +45
    }
  }
  const score = Math.round(baseHarm - awarenessBonus + surveyImpact);
  return Math.max(0, Math.min(100, score));
}