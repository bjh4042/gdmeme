export type Evaluation = {
  aggression: number;
  bullying: number;
  discrimination: number;
  violence: number;
  grammar_destruction: number;
};

export type DictEntry = {
  id: number;
  word: string;
  student_definition: string;
  suggested_by: string;
  evaluations: Evaluation;
  total_harmful_score: number;
  status: "pending" | "approved" | "rejected";
  grade: string;
  alternatives: string[];
  curriculum_code: string;
  timestamp: string;
  vote_count?: number;
  sum_eval?: Evaluation;
};

export type Student = {
  classCode: string;
  number: string;
  name: string;
};

export type ClassState = {
  xp: number;
  activityLog: { at: string; who: string; kind: string; delta: number; note?: string }[];
};

export function computeTotal(e: Evaluation) {
  return (e.aggression + e.bullying + e.discrimination + e.violence + e.grammar_destruction) * 4;
}

export function gradeOf(score: number): { label: string; tone: "safe" | "warn" | "danger"; emoji: string } {
  if (score <= 40) return { label: "안전/순화 필요", tone: "safe", emoji: "🟢" };
  if (score <= 70) return { label: "주의/경고", tone: "warn", emoji: "🟡" };
  return { label: "위험/사용 금지", tone: "danger", emoji: "🔴" };
}

export function weatherOf(avg: number) {
  if (avg <= 30) return { icon: "☀️", label: "맑음", desc: "고운 말이 가득한 교실입니다", tone: "safe" as const };
  if (avg <= 60) return { icon: "⛅", label: "구름 조금", desc: "유행어가 퍼지기 시작하니 주의하세요", tone: "warn" as const };
  return { icon: "🌧️", label: "비/천둥 번개", desc: "바른 우리말 정화 활동이 시급한 위험 상태입니다", tone: "danger" as const };
}

export const LEVELS = [
  { lv: 1, name: "풋내기 말동무", need: 0 },
  { lv: 2, name: "새싹 지킴이", need: 100 },
  { lv: 3, name: "고운 말 탐험대", need: 300 },
  { lv: 4, name: "바른말 기사단", need: 600 },
  { lv: 5, name: "우리말 수호대", need: 1000 },
];

export function levelOf(xp: number) {
  let cur = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.need) cur = l;
  const next = LEVELS.find((l) => l.need > xp);
  return { current: cur, next, progress: next ? (xp - cur.need) / (next.need - cur.need) : 1 };
}

// Korean chosung utility
const CHOSUNG = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
export const KOREAN_INITIALS = ["ㄱ","ㄴ","ㄷ","ㄹ","ㅁ","ㅂ","ㅅ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function firstInitial(word: string): string {
  const ch = word.trim().charAt(0);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const idx = Math.floor((code - 0xac00) / 588);
    const c = CHOSUNG[idx];
    // map double chosung to base for filter grouping
    const map: Record<string, string> = { "ㄲ": "ㄱ", "ㄸ": "ㄷ", "ㅃ": "ㅂ", "ㅆ": "ㅅ", "ㅉ": "ㅈ" };
    return map[c] ?? c;
  }
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  return "#";
}

export function sortByInitial(a: string, b: string) {
  return a.localeCompare(b, "ko");
}