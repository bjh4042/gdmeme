import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ClassState } from "@/lib/literacy-types";

const PERSIST_KEY = "wtmeme:store:class:v1";
const LEGACY_XP_PREFIX = "class_share_xp_";
const LEGACY_ACT_PREFIX = "class_recent_activities_";
const LEGACY_COMBINED_PREFIX = "wtmeme:class:v1:";

function migrateLegacy(): Record<string, ClassState> {
  const out: Record<string, ClassState> = {};
  if (typeof window === "undefined") return out;
  try {
    const codes = new Set<string>();
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (k.startsWith(LEGACY_XP_PREFIX)) codes.add(k.slice(LEGACY_XP_PREFIX.length));
      else if (k.startsWith(LEGACY_ACT_PREFIX)) codes.add(k.slice(LEGACY_ACT_PREFIX.length));
      else if (k.startsWith(LEGACY_COMBINED_PREFIX))
        codes.add(k.slice(LEGACY_COMBINED_PREFIX.length));
    }
    for (const code of codes) {
      const combinedRaw = window.localStorage.getItem(LEGACY_COMBINED_PREFIX + code);
      if (combinedRaw) {
        try {
          const parsed = JSON.parse(combinedRaw) as ClassState;
          out[code] = {
            xp: Math.max(0, Number(parsed?.xp) || 0),
            activityLog: Array.isArray(parsed?.activityLog)
              ? parsed.activityLog.map((a) => ({ ...a, classCode: a.classCode ?? code }))
              : [],
          };
        } catch { /* storage/parse 실패 무시 */ }
        window.localStorage.removeItem(LEGACY_COMBINED_PREFIX + code);
      } else {
        const xp =
          Number(JSON.parse(window.localStorage.getItem(LEGACY_XP_PREFIX + code) || "0")) || 0;
        const actRaw = window.localStorage.getItem(LEGACY_ACT_PREFIX + code);
        const activityLog = actRaw ? (JSON.parse(actRaw) as ClassState["activityLog"]) : [];
        out[code] = {
          xp: Math.max(0, xp),
          activityLog: (Array.isArray(activityLog) ? activityLog : []).filter(
            (a) => !a.classCode || a.classCode === code,
          ),
        };
      }
      window.localStorage.removeItem(LEGACY_XP_PREFIX + code);
      window.localStorage.removeItem(LEGACY_ACT_PREFIX + code);
    }
  } catch { /* storage/parse 실패 무시 */ }
  return out;
}

if (typeof window !== "undefined") {
  try {
    if (!window.localStorage.getItem(PERSIST_KEY)) {
      const migrated = migrateLegacy();
      if (Object.keys(migrated).length > 0) {
        window.localStorage.setItem(
          PERSIST_KEY,
          JSON.stringify({ state: { byClass: migrated }, version: 0 }),
        );
      }
    }
  } catch { /* storage/parse 실패 무시 */ }
}

type ClassStoreState = {
  byClass: Record<string, ClassState>;
  addXP: (classCode: string, delta: number, who: string, kind: string, note?: string) => void;
  setXP: (classCode: string, nextXp: number, who: string, note?: string) => void;
};

const EMPTY: ClassState = { xp: 0, activityLog: [] };

function pushActivity(
  prev: ClassState,
  entry: ClassState["activityLog"][number],
  newXp: number,
): ClassState {
  return {
    xp: Math.max(0, newXp),
    activityLog: [entry, ...prev.activityLog].slice(0, 100),
  };
}

export const useClassStore = create<ClassStoreState>()(
  persist(
    (set, get) => ({
      byClass: {},
      addXP: (classCode, delta, who, kind, note) => {
        if (!classCode) return;
        const prev = get().byClass[classCode] ?? EMPTY;
        const next = pushActivity(
          prev,
          { at: new Date().toISOString(), who, kind, delta, note, classCode },
          prev.xp + delta,
        );
        set({ byClass: { ...get().byClass, [classCode]: next } });
      },
      setXP: (classCode, nextXp, who, note) => {
        if (!classCode) return;
        const prev = get().byClass[classCode] ?? EMPTY;
        const clean = Math.max(0, Math.round(nextXp));
        const delta = clean - prev.xp;
        const next = pushActivity(
          prev,
          { at: new Date().toISOString(), who, kind: "teacher-adjust", delta, note, classCode },
          clean,
        );
        set({ byClass: { ...get().byClass, [classCode]: next } });
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ byClass: s.byClass }),
    },
  ),
);

export const EMPTY_CLASS: ClassState = EMPTY;
