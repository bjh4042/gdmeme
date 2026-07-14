// 5대 유해성 평가값에서 학생에게 보여줄 "사용할 때 생각할 점" 문구를 규칙 기반으로
// 파생. 외부 AI를 사용하지 않으며 값 누락에도 안전하다.
import type { Evaluation } from "./literacy-types";

type Rule = { key: keyof Evaluation; threshold: number; icon: string; text: string };

const RULES: Rule[] = [
  { key: "aggression", threshold: 3, icon: "🗯️", text: "상대에게 공격적으로 들릴 수 있어요." },
  {
    key: "bullying",
    threshold: 3,
    icon: "🙁",
    text: "친구를 놀리거나 소외시키는 말이 될 수 있어요.",
  },
  {
    key: "discrimination",
    threshold: 3,
    icon: "⚖️",
    text: "사람의 특징이나 배경을 낮추는 표현이 될 수 있어요.",
  },
  {
    key: "violence",
    threshold: 3,
    icon: "⚠️",
    text: "위험하거나 자극적인 행동을 가볍게 여기게 할 수 있어요.",
  },
  {
    key: "grammar_destruction",
    threshold: 3,
    icon: "✍️",
    text: "공식적인 상황에서는 뜻이 잘 전달되지 않을 수 있어요.",
  },
];

/** 평가값이 threshold 이상인 규칙만 반환. 값이 없으면 빈 배열. */
export function harmHints(ev?: Partial<Evaluation> | null): { icon: string; text: string }[] {
  if (!ev || typeof ev !== "object") return [];
  return RULES.filter((r) => {
    const v = (ev as Record<string, unknown>)[r.key];
    return typeof v === "number" && v >= r.threshold;
  }).map(({ icon, text }) => ({ icon, text }));
}
