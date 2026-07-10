import { useEffect, useState, useCallback } from "react";
import type { DictEntry, Student, ClassState, Evaluation } from "./literacy-types";
import { computeTotal, gradeOf } from "./literacy-types";
import { SEED_DICT } from "./literacy-seed";

const DICT_KEY = "wtmeme:dict:v2";
const STUDENT_KEY = "wtmeme:student:v1";
const CLASS_KEY_PREFIX = "wtmeme:class:v1:";

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
    setStudent(safeGet<Student | null>(STUDENT_KEY, null));
  }, []);
  const save = useCallback((s: Student | null) => {
    setStudent(s);
    if (s) safeSet(STUDENT_KEY, s);
    else if (typeof window !== "undefined") window.localStorage.removeItem(STUDENT_KEY);
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

  const resetSeed = useCallback(() => {
    persist(SEED_DICT);
  }, [persist]);

  return { dict, addProposal, setStatus, resetSeed, persist };
}

export function useClassState(classCode: string | undefined) {
  const [state, setState] = useState<ClassState>({ xp: 0, activityLog: [] });
  useEffect(() => {
    if (!classCode) return;
    setState(safeGet<ClassState>(CLASS_KEY_PREFIX + classCode, { xp: 0, activityLog: [] }));
  }, [classCode]);
  const addXP = useCallback(
    (delta: number, who: string, kind: string, note?: string) => {
      if (!classCode) return;
      setState((prev) => {
        const next: ClassState = {
          xp: Math.max(0, prev.xp + delta),
          activityLog: [
            { at: new Date().toISOString(), who, kind, delta, note },
            ...prev.activityLog,
          ].slice(0, 200),
        };
        safeSet(CLASS_KEY_PREFIX + classCode, next);
        return next;
      });
    },
    [classCode],
  );
  return { state, addXP };
}