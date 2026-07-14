import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Student, StudentRecord } from "@/lib/literacy-types";

const PERSIST_KEY = "wtmeme:store:roster:v1";
const LEGACY_KEY = "wtmeme:students:v1";

if (typeof window !== "undefined") {
  try {
    if (!window.localStorage.getItem(PERSIST_KEY)) {
      const raw = window.localStorage.getItem(LEGACY_KEY);
      if (raw) {
        window.localStorage.setItem(
          PERSIST_KEY,
          JSON.stringify({ state: { students: JSON.parse(raw) }, version: 0 }),
        );
        window.localStorage.removeItem(LEGACY_KEY);
      }
    }
  } catch { /* storage/parse 실패 무시 */ }
}

function studentId(classCode: string, number: string) {
  return `${classCode}_${number.padStart(2, "0")}`;
}

type ImportRow = {
  classCode: string;
  number: string;
  name: string;
  password?: string;
  group?: string;
  xp?: number;
};

type RosterState = {
  students: StudentRecord[];
  upsertActive: (s: Student) => void;
  addStudentXP: (id: string, delta: number) => void;
  updateStudent: (
    id: string,
    patch: { name?: string; password?: string; xp?: number; group?: string },
  ) => { xpDelta: number; classCode?: string };
  removeStudent: (id: string) => { removedXp: number; classCode?: string };
  importStudents: (
    rows: ImportRow[],
    mode?: "merge" | "replace",
  ) => { added: number; updated: number; removed: number; classXpDeltas: Record<string, number> };
  write: (next: StudentRecord[]) => void;
};

export const useRosterStore = create<RosterState>()(
  persist(
    (set, get) => ({
      students: [],
      upsertActive: (s) => {
        const id = studentId(s.classCode, s.number);
        const now = new Date().toISOString();
        const prev = get().students;
        const idx = prev.findIndex((r) => r.id === id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], name: s.name, lastActiveAt: now };
          set({ students: next });
        } else {
          set({
            students: [
              {
                id,
                classCode: s.classCode,
                number: s.number,
                name: s.name,
                xp: 0,
                joinedAt: now,
                lastActiveAt: now,
              },
              ...prev,
            ],
          });
        }
      },
      addStudentXP: (id, delta) => {
        if (!delta) return;
        const now = new Date().toISOString();
        set({
          students: get().students.map((r) =>
            r.id === id ? { ...r, xp: Math.max(0, r.xp + delta), lastActiveAt: now } : r,
          ),
        });
      },
      updateStudent: (id, patch) => {
        const now = new Date().toISOString();
        let xpDelta = 0;
        let classCode: string | undefined;
        set({
          students: get().students.map((r) => {
            if (r.id !== id) return r;
            classCode = r.classCode;
            const newXp = patch.xp != null ? Math.max(0, Math.round(patch.xp)) : r.xp;
            xpDelta = newXp - r.xp;
            return {
              ...r,
              name: patch.name?.trim() || r.name,
              password: patch.password !== undefined ? patch.password : r.password,
              group: patch.group !== undefined ? patch.group.trim() || undefined : r.group,
              xp: newXp,
              lastActiveAt: now,
            };
          }),
        });
        return { xpDelta, classCode };
      },
      removeStudent: (id) => {
        let removedXp = 0;
        let classCode: string | undefined;
        const prev = get().students;
        const target = prev.find((r) => r.id === id);
        if (target) {
          removedXp = target.xp;
          classCode = target.classCode;
        }
        set({ students: prev.filter((r) => r.id !== id) });
        return { removedXp, classCode };
      },
      importStudents: (rows, mode = "merge") => {
        const now = new Date().toISOString();
        let added = 0;
        let updated = 0;
        let removed = 0;
        const classXpDeltas: Record<string, number> = {};
        const clean = rows
          .map((r) => ({
            classCode: String(r.classCode ?? "").trim(),
            number: String(r.number ?? "").trim(),
            name: String(r.name ?? "").trim(),
            password: r.password != null ? String(r.password) : undefined,
            group: r.group != null ? String(r.group).trim() || undefined : undefined,
            xp:
              r.xp != null && !Number.isNaN(Number(r.xp))
                ? Math.max(0, Math.round(Number(r.xp)))
                : undefined,
          }))
          .filter((r) => r.classCode && r.number && r.name);

        const prev = get().students;
        const byId = new Map(prev.map((r) => [r.id, r]));
        const seen = new Set<string>();
        const next: StudentRecord[] = [...prev];

        for (const r of clean) {
          const id = studentId(r.classCode, r.number);
          seen.add(id);
          const idx = next.findIndex((x) => x.id === id);
          if (idx >= 0) {
            const before = next[idx];
            const newXp = r.xp != null ? r.xp : before.xp;
            const delta = newXp - before.xp;
            if (delta)
              classXpDeltas[before.classCode] = (classXpDeltas[before.classCode] ?? 0) + delta;
            next[idx] = {
              ...before,
              name: r.name,
              password: r.password !== undefined ? r.password : before.password,
              group: r.group !== undefined ? r.group : before.group,
              xp: newXp,
              lastActiveAt: now,
            };
            updated++;
          } else {
            const rec: StudentRecord = {
              id,
              classCode: r.classCode,
              number: r.number,
              name: r.name,
              password: r.password,
              group: r.group,
              xp: r.xp ?? 0,
              joinedAt: now,
              lastActiveAt: now,
            };
            next.unshift(rec);
            if (rec.xp) classXpDeltas[rec.classCode] = (classXpDeltas[rec.classCode] ?? 0) + rec.xp;
            added++;
          }
        }

        let finalList = next;
        if (mode === "replace") {
          finalList = next.filter((r) => {
            if (seen.has(r.id)) return true;
            const orig = byId.get(r.id);
            if (orig) {
              classXpDeltas[orig.classCode] = (classXpDeltas[orig.classCode] ?? 0) - orig.xp;
              removed++;
            }
            return false;
          });
        }

        set({ students: finalList });
        return { added, updated, removed, classXpDeltas };
      },
      write: (next) => set({ students: next }),
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ students: s.students }),
    },
  ),
);

export { studentId };
