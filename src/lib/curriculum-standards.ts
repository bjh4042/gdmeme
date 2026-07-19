// 연구보고서 기반 국어·도덕 성취기준 SSOT.
// 화면 표시·필터·내보내기 어디서든 이 상수만 참조한다.

export const CURRICULUM_STANDARDS = {
  "4국01-04": { subject: "국어", label: "상황과 상대를 고려한 예의 있는 대화" },
  "4국01-05": { subject: "국어", label: "온라인 대화 예절의 이해와 실천" },
  "4국04-05": { subject: "국어", label: "바른 국어생활의 이해와 실천" },
  "4국05-04": { subject: "국어", label: "매체를 바르게 이용하는 태도" },
  "4도03-02": { subject: "도덕", label: "디지털 환경에서의 존중과 배려" },
  "4도03-03": { subject: "도덕", label: "디지털 시민의 책임과 공정성" },
  "4도03-04": { subject: "도덕", label: "공동체 의사소통과 갈등 조정" },
  "4도03-05": { subject: "도덕", label: "규칙 준수와 공공선 실천" },
} as const;

export type CurriculumCode = keyof typeof CURRICULUM_STANDARDS;

// 활동(학습 단계)별 권장 성취기준 매핑. 기존 5단계 흐름(발견→파헤치기→공감→바꾸기→실천)과 정렬.
export const ACTIVITY_CURRICULUM_MAP = {
  dictionary: ["4국04-05", "4국05-04"],
  discover: ["4국04-05", "4국05-04"],
  analyze: ["4국01-04", "4국01-05", "4국04-05"],
  empathy: ["4국01-04", "4도03-02", "4도03-04"],
  rewrite: ["4국01-04", "4국01-05", "4도03-02", "4도03-04"],
  journal: ["4국04-05", "4국05-04", "4도03-03", "4도03-05"],
} as const satisfies Record<string, readonly CurriculumCode[]>;

/**
 * 하위 호환 정규화: 문자열/배열/undefined 어떤 형태든 안전하게 배열로 변환.
 * 기존 localStorage 에 저장된 단일 curriculum_code (예: "4국01-02") 도 그대로 읽을 수 있도록
 * 알 수 없는 코드는 필터링하지 않고 원문을 유지한다.
 */
export function normalizeCurriculumCodes(input: {
  curriculum_code?: string;
  curriculum_codes?: string[];
}): string[] {
  if (Array.isArray(input.curriculum_codes) && input.curriculum_codes.length > 0) {
    return input.curriculum_codes.filter((c) => typeof c === "string" && c.trim().length > 0);
  }
  if (input.curriculum_code && input.curriculum_code.trim().length > 0) {
    return [input.curriculum_code];
  }
  return [];
}

export function curriculumLabel(code: string): string {
  const meta = (CURRICULUM_STANDARDS as Record<string, { subject: string; label: string }>)[code];
  return meta ? `${meta.subject} · ${code} — ${meta.label}` : code;
}

// 사전 등록(발견하기) 기본 성취기준. 하드코딩된 "4국01-02" 를 대체한다.
export const DEFAULT_DICT_CURRICULUM_CODE: CurriculumCode = "4국04-05";
export const DEFAULT_DICT_CURRICULUM_CODES: readonly CurriculumCode[] = ACTIVITY_CURRICULUM_MAP.dictionary;