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
  source?: string;
  evaluations: Evaluation;
  total_harmful_score: number;
  status: "pending" | "approved" | "rejected";
  grade: string;
  alternatives: string[];
  curriculum_code: string;
  timestamp: string;
  vote_count?: number;
  sum_eval?: Evaluation;
  /** 학생이 이 표현을 어떤 상황에서 보거나 들었는지 (선택). source 는 매체·경로, context_note 는 장면·맥락. */
  context_note?: string;
  /** 이 말을 들은 친구가 어떻게 느낄지 학생이 상상해 적은 짧은 문장 (선택). */
  listener_effect?: string;
};

export type Student = {
  classCode: string;
  number: string;
  name: string;
};

export type StudentRecord = {
  id: string; // `${classCode}_${number}`
  classCode: string;
  number: string;
  name: string;
  password?: string;
  group?: string;
  xp: number;
  joinedAt: string;
  lastActiveAt: string;
};

export type ClassState = {
  xp: number;
  activityLog: { at: string; who: string; kind: string; delta: number; note?: string; classCode?: string }[];
};

export function computeTotal(e: Evaluation) {
  return (e.aggression + e.bullying + e.discrimination + e.violence + e.grammar_destruction) * 4;
}

export function gradeOf(score: number): { label: string; tone: "safe" | "warn" | "danger"; emoji: string } {
  // 시스템 전역 단일 기준(SSOT): 0–39 안전, 40–69 주의/경고, 70–100 위험.
  if (score < RISK_THRESHOLDS.mild) return { label: "안전/순화 필요", tone: "safe", emoji: "🟢" };
  if (score < RISK_THRESHOLDS.danger) return { label: "주의/경고", tone: "warn", emoji: "🟡" };
  return { label: "위험/사용 금지", tone: "danger", emoji: "🔴" };
}

// 100점 만점 유해 점수 구간의 유일한 기준점.
// 필터 탭·뱃지·통계 어디서든 이 상수/함수만 참조한다.
export const RISK_THRESHOLDS = { safe: 0, mild: 40, danger: 70 } as const;

export type RiskBucket = "safe" | "mild" | "danger";

export function riskBucketOf(score: number): RiskBucket {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  if (s < RISK_THRESHOLDS.mild) return "safe";
  if (s < RISK_THRESHOLDS.danger) return "mild";
  return "danger";
}

export type WeatherTier = {
  min: number;
  max: number;
  icon: string;
  label: string;
  desc: string;
  tone: "safe" | "warn" | "danger";
  accent: string; // pastel bg class for matrix rows
};

export const WEATHER_MATRIX: WeatherTier[] = [
  { min: 0, max: 15, icon: "☀️", label: "아주 맑음(쾌청)", desc: "최고의 청정 교실! 우리 반은 비속어가 전혀 없는 바른말 수호 구역입니다.", tone: "safe", accent: "bg-sky-100 text-sky-900" },
  { min: 16, max: 30, icon: "🌤️", label: "구름 조금(맑음)", desc: "아주 양호해요. 서로를 존중하며 고운 말 약속을 훌륭하게 실천하고 있습니다.", tone: "safe", accent: "bg-cyan-100 text-cyan-900" },
  { min: 31, max: 45, icon: "⛅", label: "구름 사이 햇살(개임)", desc: "무난한 상태입니다. 유행어가 가끔 들리지만 금방 바른말로 자정하고 있어요.", tone: "safe", accent: "bg-emerald-100 text-emerald-900" },
  { min: 46, max: 60, icon: "☁️", label: "구름 많음(흐림)", desc: "주의가 필요해요! 무분별한 밈과 신조어가 교실에 번지기 시작했습니다.", tone: "warn", accent: "bg-amber-100 text-amber-900" },
  { min: 61, max: 75, icon: "🌦️", label: "한때 비(소나기)", desc: "경고 단계입니다! 거친 말투와 은어가 섞여 나와 친구들 사이에 다툼이 생길 수 있어요.", tone: "warn", accent: "bg-orange-100 text-orange-900" },
  { min: 76, max: 90, icon: "🌧️", label: "장마비(비바람)", desc: "위험해요! 교실 언어가 오염되어 어두운 구름이 가득합니다. 예절 역할극을 점검하세요.", tone: "danger", accent: "bg-rose-100 text-rose-900" },
  { min: 91, max: 100, icon: "⚡", label: "천둥번개(폭풍우)", desc: "비상사태! 유해한 비속어가 가득합니다. 당장 바른말 수호 대책이 시급합니다.", tone: "danger", accent: "bg-purple-100 text-purple-900" },
];

export function weatherOf(avg: number) {
  const clamped = Math.max(0, Math.min(100, Math.round(avg)));
  const tier = WEATHER_MATRIX.find((t) => clamped >= t.min && clamped <= t.max) ?? WEATHER_MATRIX[0];
  return { icon: tier.icon, label: tier.label, desc: tier.desc, tone: tier.tone };
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