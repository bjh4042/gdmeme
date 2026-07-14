/**
 * 오늘의 상황 미션 — AI_KNOWLEDGE_SCENARIO 를 재활용해
 * 학생마다 하루 1개의 상황을 뽑아 연습하도록 하는 헬퍼.
 *
 * ✅ 원칙
 * - 외부 AI 호출 없음. bot_reply 를 그대로 피드백으로 사용한다.
 * - 학생 ID + 날짜 조합으로 결정론적으로 뽑되, 최근 7개는 회피한다.
 * - localStorage 만 사용. 기존 키(wtmeme:*) 와 충돌하지 않는 네임스페이스.
 * - 기존 검색/매칭 로직에는 손대지 않는다.
 */
import { AI_KNOWLEDGE_SCENARIO } from "./ai-assistant-dataset-scenario";
import type { AssistantEntry } from "./ai-assistant-dataset";

export const DAILY_MISSION_KEY_PREFIX = "wtmeme:daily-mission:";
export const DAILY_MISSION_RECENT_PREFIX = "wtmeme:daily-mission-recent:";

export type DailyMissionState = {
  date: string; // YYYY-MM-DD (로컬)
  missionIndex: number; // AI_KNOWLEDGE_SCENARIO 내 인덱스
  answer: string;
  done: boolean;
  completedAt: string | null;
  xpAwarded: boolean;
};

export type DailyMission = {
  index: number;
  entry: AssistantEntry;
  situation: string; // 학생에게 보여줄 상황 문구
  areaLabel: string; // 배지 라벨 (사과/거절 등)
};

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function safeRemove(key: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadRecent(studentId: string): number[] {
  const raw = safeGet(DAILY_MISSION_RECENT_PREFIX + studentId);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((n) => typeof n === "number");
  } catch {
    /* ignore */
  }
  return [];
}
function pushRecent(studentId: string, index: number, keep = 7) {
  const prev = loadRecent(studentId).filter((n) => n !== index);
  prev.unshift(index);
  safeSet(DAILY_MISSION_RECENT_PREFIX + studentId, JSON.stringify(prev.slice(0, keep)));
}

function pickMissionIndex(studentId: string, date: string): number {
  const total = AI_KNOWLEDGE_SCENARIO.length;
  if (total === 0) return 0;
  const recent = new Set(loadRecent(studentId));
  const seed = hashStr(`${studentId}|${date}`);
  const idx = seed % total;
  for (let step = 0; step < total; step++) {
    const candidate = (idx + step) % total;
    if (!recent.has(candidate)) return candidate;
  }
  return idx;
}

function deriveAreaLabel(entry: AssistantEntry): string {
  const first = (entry.bot_reply.split("\n")[0] ?? "").trim();
  const m = first.match(/\[([^\]]+?)\s*코칭\]/);
  if (m) return m[1].replace(/\s*상황$/, "").trim();
  // fallback: category tail
  const cat = entry.category.split("-")[0];
  return cat.replace(/[[\]]/g, "").trim() || "대화";
}

function deriveSituation(entry: AssistantEntry): string {
  return entry.keywords[0] ?? "오늘의 대화 상황";
}

export function loadMissionState(studentId: string): DailyMissionState | null {
  const raw = safeGet(DAILY_MISSION_KEY_PREFIX + studentId);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DailyMissionState;
    if (!parsed || typeof parsed.date !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveMissionState(studentId: string, state: DailyMissionState) {
  safeSet(DAILY_MISSION_KEY_PREFIX + studentId, JSON.stringify(state));
}

/** 오늘의 미션을 반환. 새 날짜면 새 미션을 뽑고 저장한다. */
export function getTodayMission(studentId: string): {
  mission: DailyMission;
  state: DailyMissionState;
} {
  const today = todayKey();
  let state = loadMissionState(studentId);
  if (!state || state.date !== today) {
    const idx = pickMissionIndex(studentId, today);
    state = {
      date: today,
      missionIndex: idx,
      answer: "",
      done: false,
      completedAt: null,
      xpAwarded: false,
    };
    saveMissionState(studentId, state);
  }
  const entry = AI_KNOWLEDGE_SCENARIO[state.missionIndex] ?? AI_KNOWLEDGE_SCENARIO[0];
  const mission: DailyMission = {
    index: state.missionIndex,
    entry,
    situation: deriveSituation(entry),
    areaLabel: deriveAreaLabel(entry),
  };
  return { mission, state };
}

/** 학생 답변 저장(임시). 완료 처리는 completeMission 에서. */
export function saveMissionAnswer(studentId: string, answer: string) {
  const state = loadMissionState(studentId);
  if (!state) return;
  saveMissionState(studentId, { ...state, answer });
}

/**
 * 미션 완료 처리. 반환값: xpJustAwarded — true 이면 이번 호출에서 최초 완료된 것.
 * 이미 오늘 완료된 상태에서 다시 열어도 XP 는 한 번만 지급된다.
 */
export function completeMission(
  studentId: string,
  answer: string,
): { xpJustAwarded: boolean; state: DailyMissionState } {
  const now = new Date();
  const today = todayKey(now);
  let state = loadMissionState(studentId);
  if (!state || state.date !== today) {
    // 새 날짜면 오늘 미션을 먼저 만든 뒤 완료 처리
    const { state: fresh } = getTodayMission(studentId);
    state = fresh;
  }
  const wasDone = state.done;
  const next: DailyMissionState = {
    ...state,
    answer,
    done: true,
    completedAt: state.completedAt ?? now.toISOString(),
    xpAwarded: state.xpAwarded || !wasDone,
  };
  saveMissionState(studentId, next);
  if (!wasDone) pushRecent(studentId, state.missionIndex);
  return { xpJustAwarded: !wasDone, state: next };
}

/** 학생 개인 미션 기록 삭제 (데이터 초기화 시 사용). */
export function clearMissionFor(studentId: string) {
  safeRemove(DAILY_MISSION_KEY_PREFIX + studentId);
  safeRemove(DAILY_MISSION_RECENT_PREFIX + studentId);
}

/** 교사 대시보드용 — 로컬스토리지 스캔으로 오늘 미션 참여 현황 취합. */
export function readMissionForStudent(studentId: string): DailyMissionState | null {
  const s = loadMissionState(studentId);
  if (!s) return null;
  if (s.date !== todayKey()) return null;
  return s;
}

export function missionEntryAt(index: number): AssistantEntry | null {
  return AI_KNOWLEDGE_SCENARIO[index] ?? null;
}
