import { useEffect, useState, useCallback } from "react";
import type { DictEntry, Student, StudentRecord, ClassState, Evaluation } from "./literacy-types";
import { computeTotal, gradeOf } from "./literacy-types";
import { SEED_DICT } from "./literacy-seed";

const DICT_KEY = "wtmeme:dict:v5";
const STUDENT_KEY = "wtmeme:student:v1";
// Legacy combined key (kept for one-time migration): { xp, activityLog }.
const LEGACY_CLASS_KEY_PREFIX = "wtmeme:class:v1:";
// New: fully isolated per-class sandboxes — one key per concern.
const CLASS_XP_KEY_PREFIX = "class_share_xp_";
const CLASS_ACTIVITY_KEY_PREFIX = "class_recent_activities_";
const STUDENTS_KEY = "wtmeme:students:v1";

type ActivityEntry = ClassState["activityLog"][number];

function xpKey(classCode: string) {
  return `${CLASS_XP_KEY_PREFIX}${classCode}`;
}
function activityKey(classCode: string) {
  return `${CLASS_ACTIVITY_KEY_PREFIX}${classCode}`;
}

/**
 * Read a class's isolated sandbox. Migrates from the legacy combined key
 * `wtmeme:class:v1:${classCode}` on first read, then removes it so future
 * writes never leak across classes via a shared object.
 */
function readClass(classCode: string): ClassState {
  if (typeof window === "undefined") return { xp: 0, activityLog: [] };
  const legacyKey = LEGACY_CLASS_KEY_PREFIX + classCode;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as ClassState;
      const migrated: ClassState = {
        xp: Math.max(0, Number(parsed?.xp) || 0),
        activityLog: Array.isArray(parsed?.activityLog)
          ? parsed.activityLog.map((a) => ({ ...a, classCode: a.classCode ?? classCode }))
          : [],
      };
      safeSet(xpKey(classCode), migrated.xp);
      safeSet(activityKey(classCode), migrated.activityLog);
      window.localStorage.removeItem(legacyKey);
      return migrated;
    } catch {
      window.localStorage.removeItem(legacyKey);
    }
  }
  const xp = Math.max(0, Number(safeGet<number>(xpKey(classCode), 0)) || 0);
  const raw = safeGet<ActivityEntry[]>(activityKey(classCode), []);
  // Defensive filter: only surface entries that belong to this class.
  const activityLog = (Array.isArray(raw) ? raw : []).filter(
    (a) => !a.classCode || a.classCode === classCode,
  );
  return { xp, activityLog };
}

function writeClass(classCode: string, next: ClassState) {
  safeSet(xpKey(classCode), next.xp);
  safeSet(activityKey(classCode), next.activityLog);
}

function studentId(classCode: string, number: string) {
  return `${classCode}_${number.padStart(2, "0")}`;
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSet(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useStudent() {
  const [student, setStudent] = useState<Student | null>(null);
  useEffect(() => {
    // Do NOT auto-restore the student from localStorage — always require an
    // explicit login on each visit. Clear any stale session left by prior versions.
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STUDENT_KEY);
    }
  }, []);
  const save = useCallback((s: Student | null) => {
    setStudent(s);
    // Keep the session in memory only — never persist across reloads.
    if (!s && typeof window !== "undefined") {
      window.localStorage.removeItem(STUDENT_KEY);
    }
  }, []);
  return { student, setStudent: save };
}

export function useDictionary() {
  const [dict, setDict] = useState<DictEntry[]>([]);
  useEffect(() => {
    const raw = safeGet<DictEntry[]>(DICT_KEY, SEED_DICT);
    // Migration: backfill missing `source` on older LocalStorage entries
    let mutated = false;
    const migrated = raw.map((d) => {
      if (d.source && d.source.trim()) return d;
      mutated = true;
      return { ...d, source: "출처 미상" };
    });
    if (mutated) safeSet(DICT_KEY, migrated);
    setDict(migrated);
  }, []);
  const persist = useCallback((next: DictEntry[]) => {
    setDict(next);
    safeSet(DICT_KEY, next);
  }, []);

  const addProposal = useCallback(
    (payload: {
      word: string;
      student_definition: string;
      alternatives: string[];
      evaluations: Evaluation;
      suggested_by: string;
      source?: string;
    }) => {
      setDict((prev) => {
        const existingIdx = prev.findIndex((d) => d.word.trim() === payload.word.trim());
        let next: DictEntry[];
        if (existingIdx >= 0) {
          const existing = prev[existingIdx];
          const vc = (existing.vote_count ?? 1) + 1;
          const sum: Evaluation = existing.sum_eval
            ? {
                aggression: existing.sum_eval.aggression + payload.evaluations.aggression,
                bullying: existing.sum_eval.bullying + payload.evaluations.bullying,
                discrimination: existing.sum_eval.discrimination + payload.evaluations.discrimination,
                violence: existing.sum_eval.violence + payload.evaluations.violence,
                grammar_destruction: existing.sum_eval.grammar_destruction + payload.evaluations.grammar_destruction,
              }
            : {
                aggression: existing.evaluations.aggression + payload.evaluations.aggression,
                bullying: existing.evaluations.bullying + payload.evaluations.bullying,
                discrimination: existing.evaluations.discrimination + payload.evaluations.discrimination,
                violence: existing.evaluations.violence + payload.evaluations.violence,
                grammar_destruction: existing.evaluations.grammar_destruction + payload.evaluations.grammar_destruction,
              };
          const avg: Evaluation = {
            aggression: sum.aggression / vc,
            bullying: sum.bullying / vc,
            discrimination: sum.discrimination / vc,
            violence: sum.violence / vc,
            grammar_destruction: sum.grammar_destruction / vc,
          };
          const total = Math.round(computeTotal(avg));
          const updated: DictEntry = {
            ...existing,
            evaluations: avg,
            total_harmful_score: total,
            grade: gradeOf(total).label,
            alternatives: Array.from(new Set([...existing.alternatives, ...payload.alternatives])).slice(0, 6),
            source: existing.source || payload.source,
            vote_count: vc,
            sum_eval: sum,
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
          };
          next = [...prev];
          next[existingIdx] = updated;
        } else {
          const total = computeTotal(payload.evaluations);
          const entry: DictEntry = {
            id: Date.now(),
            word: payload.word.trim(),
            student_definition: payload.student_definition,
            suggested_by: payload.suggested_by,
            source: payload.source,
            evaluations: payload.evaluations,
            total_harmful_score: total,
            status: "pending",
            grade: gradeOf(total).label,
            alternatives: payload.alternatives,
            curriculum_code: "4국01-02",
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            vote_count: 1,
            sum_eval: payload.evaluations,
          };
          next = [entry, ...prev];
        }
        safeSet(DICT_KEY, next);
        return next;
      });
    },
    [],
  );

  const setStatus = useCallback((id: number, status: "approved" | "rejected") => {
    setDict((prev) => {
      const next = prev.map((d) => (d.id === id ? { ...d, status } : d));
      safeSet(DICT_KEY, next);
      return next;
    });
  }, []);

  const updateEntry = useCallback(
    (
      id: number,
      patch: {
        word?: string;
        student_definition?: string;
        evaluations?: Evaluation;
        alternatives?: string[];
        source?: string;
      },
    ) => {
      setDict((prev) => {
        const next = prev.map((d) => {
          if (d.id !== id) return d;
          const evaluations = patch.evaluations ?? d.evaluations;
          const total = Math.round(computeTotal(evaluations));
          return {
            ...d,
            ...patch,
            evaluations,
            total_harmful_score: total,
            grade: gradeOf(total).label,
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
          };
        });
        safeSet(DICT_KEY, next);
        return next;
      });
    },
    [],
  );

  const resetSeed = useCallback(() => {
    persist(SEED_DICT);
  }, [persist]);

  return { dict, addProposal, setStatus, updateEntry, resetSeed, persist };
}

export function useClassState(classCode: string | undefined) {
  const [state, setState] = useState<ClassState>({ xp: 0, activityLog: [] });
  useEffect(() => {
    // Always reset first so the previous class's data cannot flash into UI
    // during account/class switches.
    setState({ xp: 0, activityLog: [] });
    if (!classCode) return;
    setState(readClass(classCode));
  }, [classCode]);
  const addXP = useCallback(
    (delta: number, who: string, kind: string, note?: string) => {
      if (!classCode) return;
      setState((prev) => {
        const next: ClassState = {
          xp: Math.max(0, prev.xp + delta),
          activityLog: [
            { at: new Date().toISOString(), who, kind, delta, note, classCode },
            ...prev.activityLog,
          ].slice(0, 200),
        };
        writeClass(classCode, next);
        return next;
      });
    },
    [classCode],
  );
  const setXP = useCallback(
    (nextXp: number, who: string, note?: string) => {
      if (!classCode) return;
      setState((prev) => {
        const clean = Math.max(0, Math.round(nextXp));
        const delta = clean - prev.xp;
        const next: ClassState = {
          xp: clean,
          activityLog: [
            { at: new Date().toISOString(), who, kind: "teacher-adjust", delta, note, classCode },
            ...prev.activityLog,
          ].slice(0, 200),
        };
        writeClass(classCode, next);
        return next;
      });
    },
    [classCode],
  );
  return { state, addXP, setXP };
}

/** Roster of all students that have ever logged in on this device. */
export function useStudents() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  useEffect(() => {
    setStudents(safeGet<StudentRecord[]>(STUDENTS_KEY, []));
  }, []);

  const write = useCallback((next: StudentRecord[]) => {
    setStudents(next);
    safeSet(STUDENTS_KEY, next);
  }, []);

  const upsertActive = useCallback((s: Student) => {
    const id = studentId(s.classCode, s.number);
    const now = new Date().toISOString();
    setStudents((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      let next: StudentRecord[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = { ...next[idx], name: s.name, lastActiveAt: now };
      } else {
        next = [
          { id, classCode: s.classCode, number: s.number, name: s.name, xp: 0, joinedAt: now, lastActiveAt: now },
          ...prev,
        ];
      }
      safeSet(STUDENTS_KEY, next);
      return next;
    });
  }, []);

  const addStudentXP = useCallback((id: string, delta: number) => {
    if (!delta) return;
    const now = new Date().toISOString();
    setStudents((prev) => {
      const next = prev.map((r) =>
        r.id === id ? { ...r, xp: Math.max(0, r.xp + delta), lastActiveAt: now } : r,
      );
      safeSet(STUDENTS_KEY, next);
      return next;
    });
  }, []);

  /** Teacher edit. Returns the XP delta so caller can sync class XP. */
  const updateStudent = useCallback(
    (
      id: string,
      patch: { name?: string; password?: string; xp?: number; group?: string },
    ): { xpDelta: number; classCode?: string } => {
      const now = new Date().toISOString();
      let xpDelta = 0;
      let classCode: string | undefined;
      setStudents((prev) => {
        const next = prev.map((r) => {
          if (r.id !== id) return r;
          classCode = r.classCode;
          const newXp = patch.xp != null ? Math.max(0, Math.round(patch.xp)) : r.xp;
          xpDelta = newXp - r.xp;
          return {
            ...r,
            name: patch.name?.trim() || r.name,
            password: patch.password !== undefined ? patch.password : r.password,
            group: patch.group !== undefined ? (patch.group.trim() || undefined) : r.group,
            xp: newXp,
            lastActiveAt: now,
          };
        });
        safeSet(STUDENTS_KEY, next);
        return next;
      });
      return { xpDelta, classCode };
    },
    [],
  );

  const removeStudent = useCallback((id: string): { removedXp: number; classCode?: string } => {
    let removedXp = 0;
    let classCode: string | undefined;
    setStudents((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) {
        removedXp = target.xp;
        classCode = target.classCode;
      }
      const next = prev.filter((r) => r.id !== id);
      safeSet(STUDENTS_KEY, next);
      return next;
    });
    return { removedXp, classCode };
  }, []);

  /**
   * Import a batch of student records (from Excel/CSV).
   * mode "merge": update existing (by id) and add new rows; preserve XP unless a row explicitly provides it.
   * mode "replace": remove all existing and replace with the imported set.
   * Returns per-class XP deltas so the caller can sync ClassState totals.
   */
  const importStudents = useCallback(
    (
      rows: Array<{
        classCode: string;
        number: string;
        name: string;
        password?: string;
        group?: string;
        xp?: number;
      }>,
      mode: "merge" | "replace" = "merge",
    ): { added: number; updated: number; removed: number; classXpDeltas: Record<string, number> } => {
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
          xp: r.xp != null && !Number.isNaN(Number(r.xp)) ? Math.max(0, Math.round(Number(r.xp))) : undefined,
        }))
        .filter((r) => r.classCode && r.number && r.name);

      setStudents((prev) => {
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
            if (delta) classXpDeltas[before.classCode] = (classXpDeltas[before.classCode] ?? 0) + delta;
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

        safeSet(STUDENTS_KEY, finalList);
        return finalList;
      });

      return { added, updated, removed, classXpDeltas };
    },
    [],
  );

  return { students, upsertActive, addStudentXP, updateStudent, removeStudent, importStudents, write };
}

export { studentId };

/**
 * Direct LocalStorage credit to a specific class's XP pool.
 * Used when the acting user (e.g. teacher) is not necessarily in the same
 * class as the target (e.g. crediting the applicant's home class on approval).
 */
export function addClassXPFor(
  classCode: string,
  delta: number,
  who: string,
  kind: string,
  note?: string,
) {
  if (!classCode || !delta) return;
  const prev = readClass(classCode);
  const next: ClassState = {
    xp: Math.max(0, prev.xp + delta),
    activityLog: [
      { at: new Date().toISOString(), who, kind, delta, note, classCode },
      ...prev.activityLog,
    ].slice(0, 200),
  };
  writeClass(classCode, next);
}