// STEP5 실천하기 로컬 저장소 — 학생 단위로 실천 계획·챌린지·배지를 유지.
// 기존 zustand 스토어를 손대지 않기 위해 별도의 얇은 localStorage 어댑터 사용.

export type PracticePlan = {
  goal: string;
  promise: string;
  feedback?: string;
  missions?: string[];
  badge?: PracticeBadge;
  updatedAt: string;
};

export type PracticeBadge = {
  id: string;
  emoji: string;
  name: string;
  color: string;
};

export type PracticeChallenge = {
  startDate: string; // ISO date (YYYY-MM-DD)
  days: boolean[]; // length 7
};

export type PracticeState = {
  plan?: PracticePlan;
  challenge?: PracticeChallenge;
  completedAt?: string;
};

const KEY = (studentId: string) => `bmsd_step5_${studentId}`;

export function loadPractice(studentId: string): PracticeState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY(studentId));
    if (!raw) return {};
    return JSON.parse(raw) as PracticeState;
  } catch {
    return {};
  }
}

export function savePractice(studentId: string, next: PracticeState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(studentId), JSON.stringify(next));
  } catch {
    // 저장 실패는 조용히 무시 (프라이빗 모드 등)
  }
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const GOAL_PRESETS: string[] = [
  "친구를 존중하는 말을 사용하겠습니다.",
  "온라인에서도 예쁜 말을 사용하겠습니다.",
  "놀리는 댓글을 쓰지 않겠습니다.",
  "화가 나도 바로 댓글을 쓰지 않겠습니다.",
  "상대방 입장을 먼저 생각하겠습니다.",
  "친구를 칭찬하는 말을 먼저 하겠습니다.",
];

export const ENCOURAGEMENTS: string[] = [
  "작은 말 한마디가 큰 힘이 될 수 있어요.",
  "오늘도 예쁜 말로 하루를 시작해 보세요.",
  "실천은 작은 행동부터 시작됩니다.",
  "친구를 존중하는 마음이 세상을 바꿉니다.",
  "말투를 바꾸면 관계가 달라져요.",
  "오늘 한 번의 다정한 말이 누군가의 하루를 지켜줘요.",
  "잘하고 있어요. 어제보다 한 걸음 나아갔어요.",
  "포기하지 않는 마음이 진짜 실력이에요.",
  "따뜻한 말은 돌아와 나를 지켜줘요.",
  "예쁜 말은 습관이 되고, 습관은 곧 나 자신이 돼요.",
  "고운 말 한마디로 교실이 밝아져요.",
  "친구의 이야기를 끝까지 들어주는 것도 실천이에요.",
  "잠깐 멈추고 생각하는 것도 큰 용기예요.",
  "오늘의 나는 어제보다 더 멋져요.",
  "말은 마음의 옷이에요. 오늘도 단정하게 입어요.",
  "실수해도 괜찮아요. 다시 시도하면 돼요.",
  "고운 말은 나 자신에게 주는 선물이에요.",
  "함께하는 친구가 있어 우리는 더 강해져요.",
  "오늘 한 번, 먼저 인사해 볼까요?",
  "당신의 다짐이 누군가에게 용기가 됩니다.",
];

export function pickEncouragement(seed?: number): string {
  const i =
    typeof seed === "number"
      ? seed % ENCOURAGEMENTS.length
      : Math.floor(Math.random() * ENCOURAGEMENTS.length);
  return ENCOURAGEMENTS[i];
}

/**
 * 실천 목표 텍스트에 따라 자동 지급 배지 결정.
 */
export function pickBadge(goal: string, promise: string): PracticeBadge {
  const t = `${goal} ${promise}`;
  if (/존중|입장|공감/.test(t))
    return { id: "respect", emoji: "😊", name: "존중왕", color: "#F59E0B" };
  if (/댓글|온라인|채팅/.test(t))
    return { id: "warm-comment", emoji: "💬", name: "따뜻한 댓글러", color: "#38BDF8" };
  if (/공감|이해|들어/.test(t))
    return { id: "empathy", emoji: "🤝", name: "공감천사", color: "#F472B6" };
  if (/예쁜|고운|바른/.test(t))
    return { id: "clean-words", emoji: "🌱", name: "예쁜말 지킴이", color: "#34D399" };
  return { id: "practice-star", emoji: "⭐", name: "바른말 실천가", color: "#8B5CF6" };
}