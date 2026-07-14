// 퀴즈 결과 화면에서 domain(영역) 별 정답률에 따른 규칙 기반 피드백.
// quiz-bank-50 은 domain 이 없어 기본은 총점 요약만 반환한다.
export type QuizDomain = "meaning" | "context" | "empathy" | "expression";

export const DOMAIN_LABEL: Record<QuizDomain, string> = {
  meaning: "표현의 뜻",
  context: "맥락 이해",
  empathy: "공감·감정",
  expression: "대체 표현",
};

const DOMAIN_HINT: Record<QuizDomain, string> = {
  meaning: "우리말 사전에서 낱말의 뜻과 유래를 다시 살펴보세요.",
  context: "밈 분석기에서 어떤 상황에서 쓰였는지 예시를 관찰해 보세요.",
  empathy: "AI 수호비서와 함께 상대 친구의 감정을 생각해 보세요.",
  expression: "예절 역할극에서 존중을 담은 대체 표현을 연습해 보세요.",
};

export function summarizeQuiz(results: { domain?: QuizDomain; correct: boolean }[]): {
  total: { correct: number; count: number };
  byDomain: { domain: QuizDomain; correct: number; count: number; hint: string }[];
} {
  const total = { correct: results.filter((r) => r.correct).length, count: results.length };
  const map = new Map<QuizDomain, { correct: number; count: number }>();
  for (const r of results) {
    if (!r.domain) continue;
    const cur = map.get(r.domain) ?? { correct: 0, count: 0 };
    cur.count++;
    if (r.correct) cur.correct++;
    map.set(r.domain, cur);
  }
  const byDomain = Array.from(map.entries()).map(([domain, v]) => ({
    domain,
    ...v,
    hint:
      v.correct / Math.max(1, v.count) < 0.6
        ? DOMAIN_HINT[domain]
        : `잘 이해하고 있어요. 계속 유지해 보세요.`,
  }));
  return { total, byDomain };
}
