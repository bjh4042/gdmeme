// 시연 데이터 적용/해제 — barunmal_demo_v1 네임스페이스.
// 실제 학생 데이터와 섞이지 않도록, 적용한 id 목록을 메타에 남기고
// 해제 시 그 id 만 정확히 제거한다.

import { useRosterStore } from "@/stores/roster";
import { useClassStore } from "@/stores/class";
import { useEngagementStore } from "@/stores/engagement";
import { useDictStore } from "@/stores/dict";
import { savePractice } from "@/lib/practice-storage";
import { generateDemoDataset } from "./demo-generator";
import {
  DEMO_NAMESPACE,
  DEMO_VERSION,
  type DemoDataset,
  type DemoMeta,
} from "./demo-types";

const KEY = {
  meta: `${DEMO_NAMESPACE}:meta`,
  dataset: `${DEMO_NAMESPACE}:dataset`,
  enabled: `${DEMO_NAMESPACE}:enabled`,
};

const PRACTICE_KEY = (studentId: string) => `bmsd_step5_${studentId}`;

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 실패 무시 */
  }
}

function remove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}

export function getDemoMeta(): DemoMeta | null {
  return read<DemoMeta>(KEY.meta);
}

export function getDemoDataset(): DemoDataset | null {
  return read<DemoDataset>(KEY.dataset);
}

export function isDemoApplied(): boolean {
  const meta = getDemoMeta();
  return !!meta && meta.version === DEMO_VERSION;
}

/** 시연 모드 사용 가능 여부 — 개발 환경 또는 교사가 직접 켠 경우에만. */
export function isDemoModeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  try {
    if (window.localStorage.getItem(KEY.enabled) === "1") return true;
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

export function setDemoModeEnabled(on: boolean) {
  if (on) write(KEY.enabled, "1");
  else remove(KEY.enabled);
}

/** 시연 데이터를 생성해 각 스토어에 적용한다. 이미 적용되어 있으면 먼저 해제. */
export function applyDemoData(): DemoDataset {
  clearDemoData();

  const data = generateDemoDataset();
  const roster = useRosterStore.getState();
  const dictStore = useDictStore.getState();
  const eng = useEngagementStore.getState();

  // 로스터: 기존 학생은 유지하고 시연 학생만 덧붙인다.
  const demoIds = new Set(data.students.map((s) => s.id));
  const keep = roster.students.filter((s) => !demoIds.has(s.id));
  roster.write([...data.students, ...keep]);

  // 사전: 기존 카드 유지 + 시연 카드 추가.
  const demoDictIds = new Set(data.dict.map((d) => d.id));
  dictStore.persist([...dictStore.entries.filter((d) => !demoDictIds.has(d.id)), ...data.dict]);

  // 참여도
  useEngagementStore.setState({ byStudent: { ...eng.byStudent, ...data.engagement } });

  // 7일 챌린지 (학생별 어댑터)
  for (const [studentId, state] of Object.entries(data.practice)) savePractice(studentId, state);

  // 학급 공동 XP
  if (data.classXp > 0) {
    useClassStore
      .getState()
      .addXP(data.classCode, data.classXp, "시연용 예시 데이터", "demo-seed", "barunmal_demo_v1");
  }

  const meta: DemoMeta = {
    namespace: DEMO_NAMESPACE,
    version: DEMO_VERSION,
    appliedAt: new Date().toISOString(),
    classCode: data.classCode,
    studentIds: data.students.map((s) => s.id),
    dictIds: data.dict.map((d) => d.id),
    classXp: data.classXp,
  };
  write(KEY.meta, meta);
  write(KEY.dataset, data);
  return data;
}

/** 시연 데이터만 제거. 실제 학생 활동은 건드리지 않는다. */
export function clearDemoData(): boolean {
  const meta = getDemoMeta();
  if (!meta) return false;

  const studentIds = new Set(meta.studentIds);
  const dictIds = new Set(meta.dictIds);

  const roster = useRosterStore.getState();
  roster.write(roster.students.filter((s) => !studentIds.has(s.id)));

  const dictStore = useDictStore.getState();
  dictStore.persist(dictStore.entries.filter((d) => !dictIds.has(d.id)));

  const eng = useEngagementStore.getState();
  const nextByStudent = { ...eng.byStudent };
  for (const id of studentIds) delete nextByStudent[id];
  useEngagementStore.setState({ byStudent: nextByStudent });

  for (const id of studentIds) remove(PRACTICE_KEY(id));

  if (meta.classXp > 0) {
    const cls = useClassStore.getState();
    const current = cls.byClass[meta.classCode]?.xp ?? 0;
    cls.setXP?.(
      meta.classCode,
      Math.max(0, current - meta.classXp),
      "시연용 예시 데이터 해제",
      "demo-clear",
    );
  }

  remove(KEY.meta);
  remove(KEY.dataset);
  return true;
}

/** 재생성 = 해제 후 재적용. */
export function refreshDemoData(): DemoDataset {
  return applyDemoData();
}

export const DEMO_STORAGE_KEYS = KEY;