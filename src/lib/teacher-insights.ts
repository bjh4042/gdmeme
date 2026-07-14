// 교사 대시보드 상단 「교육적 요약」 섹션의 규칙 기반 파생 유틸.
// 순수 함수 — 스토어 데이터만 읽고, 저장하지 않는다.
import type { DictEntry, StudentRecord } from "./literacy-types";
import type { StudentEngagement } from "@/stores/engagement";
import { riskBucketOf } from "./literacy-types";

export type ActiveStudent = {
  student: StudentRecord;
  score: number; // 최근성 + 활동량 결합 점수
  proposals: number;
  reflections: number;
  practices: number;
};

export type TeacherInsights = {
  totalStudents: number;
  reflectionRate: number; // 0..1
  practiceRate: number;
  proposalRate: number;
  pendingProposals: number;
  activeStudents: ActiveStudent[]; // top 5
  topWords: DictEntry[]; // vote_count top 5 (승인 기준)
  dangerWords: DictEntry[]; // 유해 위험 top 5
  guidance: string[]; // 규칙 기반 안내 문구
};

export function computeInsights(input: {
  students: StudentRecord[];
  byStudent: Record<string, StudentEngagement>;
  dict: DictEntry[];
  classCode?: string;
}): TeacherInsights {
  const scope = input.classCode
    ? input.students.filter((s) => s.classCode === input.classCode)
    : input.students;
  const total = scope.length || 1;
  const activeList = scope.map((s) => {
    const eng = input.byStudent[s.id];
    const proposals = input.dict.filter((d) => d.suggested_by === s.id).length;
    const reflections = eng?.journals?.length ?? 0;
    const practices = eng?.practiceLogs?.length ?? 0;
    const recencyMs = s.lastActiveAt ? Date.parse(s.lastActiveAt) : 0;
    const days = Number.isFinite(recencyMs) ? Math.max(0, (Date.now() - recencyMs) / 86400000) : 999;
    const score = proposals * 3 + reflections * 2 + practices * 2 + Math.max(0, 10 - days);
    return { student: s, score, proposals, reflections, practices };
  });
  const activeStudents = activeList.filter((a) => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

  const reflectionCount = scope.filter((s) => (input.byStudent[s.id]?.journals?.length ?? 0) > 0).length;
  const practiceCount = scope.filter((s) => (input.byStudent[s.id]?.practiceLogs?.length ?? 0) > 0).length;
  const proposalIds = new Set(input.dict.map((d) => d.suggested_by));
  const proposalCount = scope.filter((s) => proposalIds.has(s.id)).length;
  const pendingProposals = input.dict.filter((d) => d.status === "pending").length;

  const approved = input.dict.filter((d) => d.status === "approved");
  const topWords = [...approved].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 5);
  const dangerWords = [...approved]
    .filter((d) => riskBucketOf(d.total_harmful_score) === "danger")
    .sort((a, b) => b.total_harmful_score - a.total_harmful_score)
    .slice(0, 5);

  const guidance: string[] = [];
  if (scope.length === 0) guidance.push("아직 등록된 학생이 없습니다. 학생 명단을 업로드해 주세요.");
  else {
    if (reflectionCount / total < 0.3) guidance.push("성찰 저널 참여가 낮아요. 다음 수업에서 '오늘 알게 된 표현'을 1분 공유해 보세요.");
    if (practiceCount / total < 0.3) guidance.push("실천 체크가 부족해요. 로드맵 카드의 '오늘의 실천 체크' 안내를 다시 짚어주세요.");
    if (pendingProposals >= 5) guidance.push(`승인 대기 중인 학생 제안이 ${pendingProposals}건 있어요. 우선 확인이 필요해요.`);
    if (dangerWords.length >= 3) guidance.push("위험 등급(70점 이상) 표현이 다수 등록되었어요. 실제 사례로 함께 이야기 나눠보면 좋아요.");
    if (guidance.length === 0) guidance.push("전반적으로 참여가 안정적입니다. 이번 주는 학생들의 대체 표현을 함께 낭독해 보는 것을 추천해요.");
  }

  return {
    totalStudents: scope.length,
    reflectionRate: reflectionCount / total,
    practiceRate: practiceCount / total,
    proposalRate: proposalCount / total,
    pendingProposals,
    activeStudents,
    topWords,
    dangerWords,
    guidance,
  };
}
