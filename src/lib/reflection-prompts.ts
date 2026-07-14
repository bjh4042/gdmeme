// 성찰 저널·주간 설문에서 공통으로 안내하는 4가지 질문(문구 통일).
// 별도 저장소 없이 placeholder 및 힌트 안내에만 사용한다.
export const REFLECTION_PROMPTS: { key: string; label: string; hint: string }[] = [
  { key: "learned", label: "오늘 알게 된 표현", hint: "오늘 새로 살펴본 낱말·밈·표현 한 가지" },
  { key: "feeling", label: "상대의 감정", hint: "그 말을 들은 친구는 어떤 기분이었을까요?" },
  { key: "rewrite", label: "바꿔 말할 표현", hint: "존중을 담아 다시 말한다면 어떻게 말할까요?" },
  { key: "practice", label: "실천 한 가지", hint: "내일 대화에서 지킬 나만의 다짐 한 문장" },
];

/** 요일별로 안내 문구를 돌려주어 placeholder가 지루해지지 않도록 한다. */
export function todaysReflectionPrompt(): { label: string; hint: string } {
  const idx = new Date().getDay() % REFLECTION_PROMPTS.length;
  const p = REFLECTION_PROMPTS[idx];
  return { label: p.label, hint: p.hint };
}

export const REFLECTION_AFTER_SAVE =
  "오늘 생각한 바른 표현을 실제 대화에서도 실천해 보세요.";
