// 7일 실천 챌린지 — 미션 정의 및 공용 유틸.
// 기존 STEP5(실천하기)의 자유 목표 설정과 별개로, 정해진 7개 미션을 하루 1개씩 수행한다.

export type ChallengeMission = {
  day: number; // 1~7
  title: string;
  hint: string;
  emoji: string;
};

export const CHALLENGE_MISSIONS: ChallengeMission[] = [
  {
    day: 1,
    title: "상대를 존중하는 표현 3번 사용하기",
    hint: "‘고마워’, ‘괜찮아’, ‘같이 하자’처럼 마음이 따뜻해지는 말을 써 보아요.",
    emoji: "🤝",
  },
  {
    day: 2,
    title: "인터넷에서 본 표현의 의미 찾아보기",
    hint: "오늘 본 낯선 말 하나를 골라 뜻과 쓰임을 알아보아요.",
    emoji: "🔎",
  },
  {
    day: 3,
    title: "온라인에서 고운 말 사용하기",
    hint: "댓글이나 채팅에서도 얼굴을 보고 말하듯이 표현해 보아요.",
    emoji: "💬",
  },
  {
    day: 4,
    title: "친구에게 공감 표현하기",
    hint: "‘그랬구나’, ‘많이 속상했겠다’처럼 마음을 알아주는 말을 건네 보아요.",
    emoji: "💗",
  },
  {
    day: 5,
    title: "비속어 대신 바른 표현 사용하기",
    hint: "쓰고 싶었던 말을 어떤 바른 말로 바꿨는지 적어 보아요.",
    emoji: "✏️",
  },
  {
    day: 6,
    title: "AI에게 물어본 내용을 직접 확인하기",
    hint: "AI가 알려 준 내용을 사전이나 선생님께 한 번 더 확인해 보아요.",
    emoji: "🤖",
  },
  {
    day: 7,
    title: "이번 주 가장 잘한 점 성찰하기",
    hint: "일주일 동안 가장 뿌듯했던 순간을 떠올려 적어 보아요.",
    emoji: "🌱",
  },
];

export function missionOf(day: number): ChallengeMission {
  return CHALLENGE_MISSIONS[Math.min(Math.max(day, 1), 7) - 1];
}

export function todayIsoDate(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + (9 * 60 + d.getTimezoneOffset()) * 60_000);
  return kst.toISOString().slice(0, 10);
}

export function formatIsoDate(iso?: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${Number(m)}월 ${Number(d)}일`;
}