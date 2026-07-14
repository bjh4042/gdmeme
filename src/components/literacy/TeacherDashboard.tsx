import { useMemo, useRef, useState } from "react";
import type { DictEntry, Evaluation, StudentRecord } from "@/lib/literacy-types";
import { computeTotal, gradeOf, levelOf } from "@/lib/literacy-types";
import {
  Pencil,
  X,
  Plus,
  Trash2,
  Search,
  BookOpen,
  Users,
  ArrowUp,
  ArrowDown,
  Download,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useDictStore } from "@/stores/dict";
import { RoadmapTeacherPanel } from "./RoadmapTeacherPanel";
import { TeacherEducationalSummary } from "./TeacherEducationalSummary";
import { exportAnonCSV, exportAnonXLSX } from "@/lib/anon-export";
import { useEngagementStore } from "@/stores/engagement";
// 인증은 <TeacherGate /> 래퍼가 SHA-256 해시로 처리한다.
// 이 컴포넌트에 도달했다는 것 = 이미 인증 통과.

type UpdatePayload = {
  word?: string;
  student_definition?: string;
  evaluations?: Evaluation;
  alternatives?: string[];
  source?: string;
};

type StudentPatch = { name?: string; password?: string; xp?: number; group?: string };

export type StudentImportRow = {
  classCode: string;
  number: string;
  name: string;
  password?: string;
  group?: string;
  xp?: number;
};

type SortKey = "id" | "name" | "xp" | "lastActiveAt" | "group";
type SortDir = "asc" | "desc";

export function TeacherDashboard({
  dict,
  students,
  currentClassCode,
  onApprove,
  onReject,
  onUpdate,
  onUpdateStudent,
  onDeleteStudent,
  onImportStudents,
  onClose,
  onReset,
  onOpenReport,
}: {
  dict: DictEntry[];
  students: StudentRecord[];
  currentClassCode: string;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onUpdate: (id: number, patch: UpdatePayload) => void;
  onUpdateStudent: (id: string, patch: StudentPatch) => void;
  onDeleteStudent: (id: string) => void;
  onImportStudents: (
    rows: StudentImportRow[],
    mode: "merge" | "replace",
  ) => { added: number; updated: number; removed: number };
  onClose: () => void;
  onReset: () => void;
  onOpenReport?: (studentId: string) => void;
}) {
  const [section, setSection] = useState<"words" | "students">("words");
  const engagementByStudent = useEngagementStore((s) => s.byStudent);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [query, setQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [curriculumFilter, setCurriculumFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("__mine__");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const pending = dict.filter((d) => d.status === "pending");
  const approved = dict.filter((d) => d.status === "approved");
  const rejected = dict.filter((d) => d.status === "rejected");
  const base = status === "pending" ? pending : status === "approved" ? approved : rejected;
  const q = query.trim().toLowerCase();
  const list = base.filter((d) => {
    if (curriculumFilter !== "all" && d.curriculum_code !== curriculumFilter) return false;
    if (gradeFilter !== "all" && d.grade !== gradeFilter) return false;
    if (!q) return true;
    return (
      d.word.toLowerCase().includes(q) ||
      d.student_definition.toLowerCase().includes(q) ||
      (d.source ?? "").toLowerCase().includes(q)
    );
  });
  const curriculumOptions = Array.from(new Set(dict.map((d) => d.curriculum_code))).sort();
  const gradeOptions = Array.from(new Set(dict.map((d) => d.grade)));
  const editing = editingId != null ? (dict.find((d) => d.id === editingId) ?? null) : null;

  const sq = studentQuery.trim().toLowerCase();
  const classOptions = Array.from(new Set(students.map((s) => s.classCode))).sort();
  const groupOptions = Array.from(
    new Set(students.map((s) => s.group).filter((g): g is string => !!g)),
  ).sort();
  const studentList = students
    .filter((s) => {
      if (classFilter === "__mine__") {
        if (currentClassCode && s.classCode !== currentClassCode) return false;
      } else if (classFilter !== "all" && s.classCode !== classFilter) {
        return false;
      }
      if (groupFilter === "__none__" ? !!s.group : groupFilter !== "all" && s.group !== groupFilter)
        return false;
      if (!sq) return true;
      return (
        s.name.toLowerCase().includes(sq) ||
        s.id.toLowerCase().includes(sq) ||
        (s.group ?? "").toLowerCase().includes(sq)
      );
    })
    .sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortKey) {
        case "name":
          return dir * a.name.localeCompare(b.name, "ko");
        case "xp":
          return dir * (a.xp - b.xp);
        case "lastActiveAt":
          return dir * a.lastActiveAt.localeCompare(b.lastActiveAt);
        case "group":
          return (
            dir *
            ((a.group ?? "").localeCompare(b.group ?? "", "ko") ||
              a.classCode.localeCompare(b.classCode) ||
              Number(a.number) - Number(b.number))
          );
        case "id":
        default:
          return (
            dir * (a.classCode.localeCompare(b.classCode) || Number(a.number) - Number(b.number))
          );
      }
    });
  const editingStudentRec = editingStudent
    ? (students.find((s) => s.id === editingStudent) ?? null)
    : null;

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "xp" || k === "lastActiveAt" ? "desc" : "asc");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 사전 데이터 CSV 내보내기 / 업로드 (관리자 전용)
  // ─────────────────────────────────────────────────────────────
  const dictFileRef = useRef<HTMLInputElement | null>(null);

  function csvEscape(v: unknown): string {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // 5대 유해성 점수 정규화: 1.0~5.0, 0.5 단위 반올림. 빈 값/NaN → 1.0
  function normalizeScore5(v: unknown): number {
    const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
    if (!Number.isFinite(n)) return 1.0;
    const clamped = Math.max(1, Math.min(5, n));
    return Math.round(clamped * 2) / 2;
  }

  function downloadDictCSV() {
    const header = [
      "ID",
      "단어명",
      "출처",
      "점수_공격성",
      "점수_따돌림",
      "점수_혐오성",
      "점수_폭력성",
      "점수_문법파괴",
      "상태",
      "바른 대안 표현 1",
      "바른 대안 표현 2",
      "제안자",
    ];
    const lines = [header.join(",")];
    for (const d of dict) {
      const e = d.evaluations;
      lines.push(
        [
          d.id,
          d.word,
          d.source ?? "",
          normalizeScore5(e?.aggression).toFixed(1),
          normalizeScore5(e?.bullying).toFixed(1),
          normalizeScore5(e?.discrimination).toFixed(1),
          normalizeScore5(e?.violence).toFixed(1),
          normalizeScore5(e?.grammar_destruction).toFixed(1),
          d.grade,
          d.alternatives?.[0] ?? "",
          d.alternatives?.[1] ?? "",
          d.suggested_by ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    // 한글 깨짐 방지: UTF-8 BOM 선행 삽입
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "우리말_사전_데이터셋.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`총 ${dict.length}건의 사전 데이터를 CSV로 저장했어요.`);
  }

  function parseCSV(text: string): Record<string, string>[] {
    // BOM 제거
    const src = text.replace(/^\ufeff/, "");
    const rows: string[][] = [];
    let cur: string[] = [];
    let field = "";
    let inQ = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (inQ) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"';
            i++;
          } else inQ = false;
        } else field += c;
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") {
          cur.push(field);
          field = "";
        } else if (c === "\n") {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        } else if (c === "\r") {
          /* skip */
        } else field += c;
      }
    }
    if (field.length > 0 || cur.length > 0) {
      cur.push(field);
      rows.push(cur);
    }
    if (rows.length === 0) return [];
    const headers = rows[0].map((h) => h.trim());
    return rows
      .slice(1)
      .filter((r) => r.some((v) => v.trim() !== ""))
      .map((r) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = (r[i] ?? "").trim();
        });
        return obj;
      });
  }

  async function handleDictUpload(file: File) {
    try {
      let rows: Record<string, string>[] = [];
      const name = file.name.toLowerCase();
      if (name.endsWith(".csv")) {
        const text = await file.text();
        rows = parseCSV(text);
      } else {
        // xlsx/xls 도 함께 허용
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) return toast.error("시트를 찾을 수 없습니다.");
        rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" }).map((r) => {
          const o: Record<string, string> = {};
          for (const k of Object.keys(r)) o[k] = String(r[k] ?? "").trim();
          return o;
        });
      }
      if (rows.length === 0) return toast.error("유효한 행이 없습니다.");

      const pick = (r: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
        return "";
      };

      const current = useDictStore.getState().entries;
      const byId = new Map<number, DictEntry>(current.map((d) => [d.id, d]));
      let maxId = current.reduce((m, d) => (d.id > m ? d.id : m), 0);
      let added = 0;
      let updated = 0;

      for (const r of rows) {
        const idStr = pick(r, "ID", "id", "아이디");
        const word = pick(r, "단어명", "word", "낱말");
        const source = pick(r, "출처", "source");
        const statusStr = pick(r, "상태", "grade");
        const alt1 = pick(r, "바른 대안 표현 1", "대안1", "alt1");
        const alt2 = pick(r, "바른 대안 표현 2", "대안2", "alt2");
        const suggested = pick(r, "제안자", "suggested_by");
        if (!word) continue;

        const idNum = idStr ? Number(idStr) : NaN;
        const alternatives = [alt1, alt2].filter((x) => x && x.trim() !== "");

        // 5대 유해성 점수 (1.0~5.0, 0.5 단위). 컬럼 없으면 기존값/기본 1.0
        const prevEval = !Number.isNaN(idNum) ? byId.get(idNum)?.evaluations : undefined;
        const evaluations: Evaluation = {
          aggression: normalizeScore5(
            pick(r, "점수_공격성", "aggression") || prevEval?.aggression || 1,
          ),
          bullying: normalizeScore5(pick(r, "점수_따돌림", "bullying") || prevEval?.bullying || 1),
          discrimination: normalizeScore5(
            pick(r, "점수_혐오성", "점수_차별성", "discrimination") ||
              prevEval?.discrimination ||
              1,
          ),
          violence: normalizeScore5(pick(r, "점수_폭력성", "violence") || prevEval?.violence || 1),
          grammar_destruction: normalizeScore5(
            pick(r, "점수_문법파괴", "grammar_destruction") || prevEval?.grammar_destruction || 1,
          ),
        };
        // 종합 점수: 5대 영역 평균 → 100점 만점 비례 환산 (computeTotal와 동치)
        const score = Math.round(computeTotal(evaluations));

        if (!Number.isNaN(idNum) && byId.has(idNum)) {
          const prev = byId.get(idNum)!;
          const nextScore = score;
          const next: DictEntry = {
            ...prev,
            word,
            source: source || prev.source,
            evaluations,
            total_harmful_score: nextScore,
            grade: statusStr || gradeOf(nextScore).label,
            alternatives: alternatives.length ? alternatives : prev.alternatives,
            suggested_by: suggested || prev.suggested_by,
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
          };
          byId.set(idNum, next);
          updated++;
        } else {
          const newId = !Number.isNaN(idNum) && idNum > 0 ? idNum : ++maxId;
          if (newId > maxId) maxId = newId;
          const nextScore = score;
          const entry: DictEntry = {
            id: newId,
            word,
            student_definition: "(엑셀 업로드로 추가된 항목)",
            suggested_by: suggested || "교사 업로드",
            source: source || "출처 미상",
            evaluations,
            total_harmful_score: nextScore,
            status: "approved",
            grade: statusStr || gradeOf(nextScore).label,
            alternatives,
            curriculum_code: "4국01-02",
            timestamp: new Date().toISOString().slice(0, 19).replace("T", " "),
            vote_count: 1,
          };
          byId.set(newId, entry);
          added++;
        }
      }

      const next = Array.from(byId.values());
      useDictStore.getState().persist(next);
      toast.success(`총 ${added + updated}건의 사전 데이터가 성공적으로 반영되었습니다.`, {
        description: `추가 ${added}건 · 수정 ${updated}건`,
      });
    } catch (e) {
      toast.error("파일을 읽는 중 오류가 발생했습니다: " + String(e));
    } finally {
      if (dictFileRef.current) dictFileRef.current.value = "";
    }
  }

  function downloadExcel(scope: "filtered" | "all") {
    const rows = (scope === "filtered" ? studentList : students).map((s) => ({
      학급코드: s.classCode,
      번호: s.number,
      이름: s.name,
      그룹: s.group ?? "",
      비밀번호: s.password ?? "",
      누적XP: s.xp,
      아이디: s.id,
      가입일: s.joinedAt,
      최근접속: s.lastActiveAt,
    }));
    if (rows.length === 0) {
      rows.push({
        학급코드: "3105",
        번호: "1",
        이름: "홍길동",
        그룹: "모둠A",
        비밀번호: "1234",
        누적XP: 0,
        아이디: "3105_01",
        가입일: "",
        최근접속: "",
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 10 },
      { wch: 6 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 12 },
      { wch: 22 },
      { wch: 22 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생명단");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `학생명단_${stamp}.xlsx`);
  }

  function downloadTemplate() {
    const rows = [
      { 학급코드: "3105", 번호: "1", 이름: "홍길동", 그룹: "모둠A", 비밀번호: "1234", 누적XP: 0 },
      { 학급코드: "3105", 번호: "2", 이름: "김철수", 그룹: "모둠A", 비밀번호: "", 누적XP: 0 },
      { 학급코드: "3105", 번호: "3", 이름: "이영희", 그룹: "모둠B", 비밀번호: "", 누적XP: 0 },
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "학생명단_양식");
    XLSX.writeFile(wb, "학생명단_업로드양식.xlsx");
  }

  async function handleUpload(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) return alert("시트를 찾을 수 없습니다.");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const rows: StudentImportRow[] = raw
        .map((r) => {
          const pick = (...keys: string[]) => {
            for (const k of keys) {
              const v = r[k];
              if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
            }
            return "";
          };
          const classCode = pick("학급코드", "classCode", "반", "class");
          const number = pick("번호", "number", "no");
          const name = pick("이름", "name");
          const password = pick("비밀번호", "password", "pw");
          const group = pick("그룹", "group", "모둠");
          const xpStr = pick("누적XP", "xp", "XP", "점수");
          return {
            classCode,
            number,
            name,
            password: password || undefined,
            group: group || undefined,
            xp: xpStr ? Number(xpStr) : undefined,
          };
        })
        .filter((r) => r.classCode && r.number && r.name);
      if (rows.length === 0) return alert("유효한 학생 행이 없습니다. (필수: 학급코드·번호·이름)");
      const mode = confirm(
        `${rows.length}명의 학생을 불러왔습니다.\n\n[확인] 병합 (기존 유지 + 추가/갱신)\n[취소] 다음 대화상자에서 전체 교체 여부 선택`,
      )
        ? "merge"
        : confirm(
              "⚠️ 전체 교체를 진행하시겠습니까?\n업로드 파일에 없는 기존 학생은 모두 삭제됩니다.",
            )
          ? "replace"
          : null;
      if (!mode) return;
      const res = onImportStudents(rows, mode as "merge" | "replace");
      alert(`업로드 완료\n· 추가 ${res.added}명\n· 갱신 ${res.updated}명\n· 삭제 ${res.removed}명`);
    } catch (e) {
      alert("파일을 읽는 중 오류가 발생했습니다: " + String(e));
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 overflow-x-hidden overflow-y-auto p-2 sm:p-4 scroll-touch pl-safe pr-safe"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div
        className="w-full max-w-4xl min-w-0 mx-auto my-2 sm:my-6 rounded-3xl bg-card p-3 sm:p-6 border-2 border-[color:var(--navy)]"
        style={{ marginBottom: "calc(80px + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-[color:var(--navy)] truncate">
              🧑‍🏫 교사 대시보드
            </h3>
            <p className="text-xs text-muted-foreground">단어 관리 · 학생 회원 관리</p>
          </div>
          <div className="shrink-0 flex gap-2">
            {section === "words" && (
              <button
                onClick={onReset}
                className="text-xs px-3 py-2 rounded-lg bg-[color:var(--muted)] font-bold"
              >
                시드로 초기화
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs px-3 py-2 rounded-lg bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold"
            >
              닫기
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 rounded-2xl bg-[color:var(--muted)]">
          <SubTab
            active={section === "words"}
            onClick={() => setSection("words")}
            icon={<BookOpen size={15} />}
            label={`단어 관리 (${dict.length})`}
          />
          <SubTab
            active={section === "students"}
            onClick={() => setSection("students")}
            icon={<Users size={15} />}
            label={`학생 회원 관리 (${students.length})`}
          />
        </div>

        <RoadmapTeacherPanel students={students} currentClassCode={currentClassCode} dict={dict} />

        <TeacherEducationalSummary
          students={students}
          currentClassCode={currentClassCode}
          dict={dict}
        />

        {/* 데모 데이터 안내 배너 (교사 화면 전용) */}
        <div
          role="note"
          aria-label="예시 데이터 안내"
          className="mb-4 rounded-2xl border-2 border-dashed border-[color:var(--amber,#f59e0b)]/60 bg-amber-50 px-3 py-2 text-[12px] text-[color:var(--navy)]"
        >
          ⓘ 현재 화면에는 <b>기능 확인용 예시(더미) 데이터</b>가 포함되어 있을 수 있어요. 실제 수업
          시작 전<b> ‘시드로 초기화’</b> 또는 학생 명단 업로드로 실데이터를 반영해 주세요.
        </div>

        {section === "words" ? (
          <>
            {/* 📊 사전 데이터 CSV 내보내기 / 업로드 (관리자 전용) */}
            <div
              data-tour="admin-csv"
              className="mb-4 rounded-2xl border-2 border-dashed border-[color:var(--mint-deep)]/40 bg-[color:var(--mint)]/20 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-black text-[color:var(--navy)]">
                    📊 사전 데이터셋 일괄 관리
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    CSV로 내려받아 엑셀에서 편집 → 다시 업로드하면 ID 기준으로 Upsert 반영돼요.
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadDictCSV}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] px-3 py-2 text-xs font-bold hover:scale-[1.03] transition"
                  >
                    <Download size={14} /> 사전 데이터 엑셀 다운로드
                  </button>
                  <button
                    type="button"
                    onClick={() => dictFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white border-2 border-[color:var(--navy)] text-[color:var(--navy)] px-3 py-2 text-xs font-bold hover:bg-[color:var(--mint)] transition"
                  >
                    <Upload size={14} /> 엑셀 파일 선택
                  </button>
                  <input
                    ref={dictFileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleDictUpload(f);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 대시보드 내 단어 검색 (단어명·뜻풀이·출처)"
                className="w-full rounded-xl border-2 border-[color:var(--border)] pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[color:var(--mint-deep)]"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-full hover:bg-black/5"
                  aria-label="검색 초기화"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">교육과정 코드</span>
                <select
                  value={curriculumFilter}
                  onChange={(e) => setCurriculumFilter(e.target.value)}
                  className="rounded-xl border-2 border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  <option value="all">전체</option>
                  {curriculumOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">유해 등급</span>
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="rounded-xl border-2 border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  <option value="all">전체</option>
                  {gradeOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-muted-foreground">승인 상태</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "pending" | "approved" | "rejected")}
                  className="rounded-xl border-2 border-[color:var(--border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  <option value="pending">대기 ({pending.length})</option>
                  <option value="approved">승인 ({approved.length})</option>
                  <option value="rejected">반려 ({rejected.length})</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-center">
              <TabStat
                label="대기"
                n={pending.length}
                active={status === "pending"}
                color="var(--warn)"
                onClick={() => setStatus("pending")}
              />
              <TabStat
                label="승인"
                n={approved.length}
                active={status === "approved"}
                color="var(--safe)"
                onClick={() => setStatus("approved")}
              />
              <TabStat
                label="반려"
                n={rejected.length}
                active={status === "rejected"}
                color="var(--danger)"
                onClick={() => setStatus("rejected")}
              />
            </div>

            <div className="text-xs text-muted-foreground mb-2">
              총 <b className="text-[color:var(--navy)]">{list.length}</b>개
              {query && <> · 검색어 "{query}"</>}
            </div>

            {list.length === 0 ? (
              <div className="rounded-xl bg-[color:var(--muted)] p-6 text-sm text-muted-foreground text-center">
                {query ? "검색 결과가 없습니다." : "해당 상태의 단어가 없습니다."}
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((d) => (
                  <EntryRow
                    key={d.id}
                    entry={d}
                    showActions={status === "pending"}
                    onApprove={onApprove}
                    onReject={onReject}
                    onEdit={() => setEditingId(d.id)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="relative mb-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="🔍 학생 검색 (이름·아이디·그룹)"
                className="w-full rounded-xl border-2 border-[color:var(--border)] pl-9 pr-3 py-2.5 text-sm outline-none focus:border-[color:var(--mint-deep)]"
              />
            </div>

            {/* Filters + sort + import/export toolbar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">학급</span>
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="rounded-xl border-2 border-[color:var(--border)] px-2 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  {currentClassCode && (
                    <option value="__mine__">우리 반 ({currentClassCode})</option>
                  )}
                  <option value="all">전체 학급</option>
                  {classOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">그룹/모둠</span>
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="rounded-xl border-2 border-[color:var(--border)] px-2 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  <option value="all">전체</option>
                  <option value="__none__">그룹 미지정</option>
                  {groupOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">정렬 기준</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  className="rounded-xl border-2 border-[color:var(--border)] px-2 py-2 text-sm outline-none focus:border-[color:var(--mint-deep)] bg-white"
                >
                  <option value="id">아이디 (학급·번호)</option>
                  <option value="name">이름</option>
                  <option value="xp">누적 XP</option>
                  <option value="group">그룹</option>
                  <option value="lastActiveAt">최근 접속</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-muted-foreground">순서</span>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border-2 border-[color:var(--border)] px-2 py-2 text-sm font-bold bg-white hover:bg-[color:var(--muted)]"
                >
                  {sortDir === "asc" ? (
                    <>
                      <ArrowUp size={14} /> 오름차순
                    </>
                  ) : (
                    <>
                      <ArrowDown size={14} /> 내림차순
                    </>
                  )}
                </button>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                onClick={() => downloadExcel("filtered")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--mint-deep)] text-white hover:scale-[1.03] transition"
              >
                <Download size={13} /> 현재 목록 XLSX 다운로드
              </button>
              <button
                onClick={() => downloadExcel("all")}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--navy)] text-[color:var(--navy-foreground)]"
              >
                <Download size={13} /> 전체 XLSX 다운로드
              </button>
              <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--safe)] text-white cursor-pointer hover:scale-[1.03] transition">
                <Upload size={13} /> XLSX 업로드
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.currentTarget.value = "";
                    if (f) handleUpload(f);
                  }}
                />
              </label>
              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--muted)] text-[color:var(--navy)]"
              >
                📄 업로드 양식 받기
              </button>
              <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden />
              <button
                onClick={() => {
                  const n = exportAnonCSV({ students, byStudent: engagementByStudent, dict });
                  toast.success(`익명 학습활동 CSV 저장 (${n}명)`);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border-2 border-[color:var(--mint-deep)] text-[color:var(--mint-deep)]"
                title="개인정보를 제외한 익명 학습활동 데이터를 CSV로 저장"
              >
                <Download size={13} /> 익명 CSV
              </button>
              <button
                onClick={() => {
                  const n = exportAnonXLSX({ students, byStudent: engagementByStudent, dict });
                  toast.success(`익명 학습활동 XLSX 저장 (${n}명)`);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border-2 border-[color:var(--mint-deep)] text-[color:var(--mint-deep)]"
                title="개인정보를 제외한 익명 학습활동 데이터를 XLSX로 저장"
              >
                <Download size={13} /> 익명 XLSX
              </button>
            </div>

            <div className="text-xs text-muted-foreground mb-2">
              표시 <b className="text-[color:var(--navy)]">{studentList.length}</b>명 / 전체{" "}
              {students.length}명
            </div>

            {studentList.length === 0 ? (
              <div className="rounded-xl bg-[color:var(--muted)] p-6 text-sm text-muted-foreground text-center">
                {students.length === 0
                  ? "아직 등록된 학생이 없습니다. XLSX 업로드로 명단을 불러올 수 있어요."
                  : "조건에 맞는 학생이 없습니다."}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-auto rounded-2xl border-2 border-[color:var(--border)] max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-[color:var(--muted)] text-xs sticky top-0 z-10 shadow-[0_1px_0_var(--border)]">
                      <tr>
                        <SortableTh
                          label="아이디"
                          active={sortKey === "id"}
                          dir={sortDir}
                          onClick={() => toggleSort("id")}
                        />
                        <SortableTh
                          label="이름"
                          active={sortKey === "name"}
                          dir={sortDir}
                          onClick={() => toggleSort("name")}
                        />
                        <SortableTh
                          label="그룹"
                          active={sortKey === "group"}
                          dir={sortDir}
                          onClick={() => toggleSort("group")}
                        />
                        <SortableTh
                          label="누적 XP"
                          active={sortKey === "xp"}
                          dir={sortDir}
                          onClick={() => toggleSort("xp")}
                          className="text-right"
                        />
                        <Th>레벨</Th>
                        <Th className="text-right">관리</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentList.map((s) => {
                        const lv = levelOf(s.xp);
                        const mine = s.classCode === currentClassCode;
                        return (
                          <tr
                            key={s.id}
                            className={`border-t border-[color:var(--border)] ${mine ? "" : "opacity-70"}`}
                          >
                            <Td className="font-mono text-xs">{s.id}</Td>
                            <Td className="font-bold text-[color:var(--navy)] max-w-[16ch] truncate" title={s.name}>{s.name}</Td>
                            <Td>
                              {s.group ? (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--mint)]/50 text-[color:var(--navy)]">
                                  {s.group}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </Td>
                            <Td className="text-right font-black text-[color:var(--navy)]">
                              {s.xp}
                            </Td>
                            <Td>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[color:var(--mint)] text-[color:var(--navy)]">
                                Lv.{lv.current.lv}
                              </span>
                            </Td>
                            <Td className="text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => setEditingStudent(s.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-[color:var(--navy)] text-[color:var(--navy-foreground)] hover:scale-[1.03] transition"
                                >
                                  <Pencil size={11} /> 정보 수정
                                </button>
                                {onOpenReport && (
                                  <button
                                    onClick={() => onOpenReport(s.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-[color:var(--mint)] text-[color:var(--navy)] hover:scale-[1.03] transition"
                                    title="언어 수호 리포트 보기"
                                  >
                                    📄 리포트
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `정말로 이 학생의 계정과 누적 데이터를 삭제하시겠습니까?\n\n[${s.id}] ${s.name} · ${s.xp} XP\n\n(예절 역할극 대화 이력은 유지됩니다)`,
                                      )
                                    ) {
                                      onDeleteStudent(s.id);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-[color:var(--danger)] hover:bg-red-200 transition"
                                >
                                  <Trash2 size={11} /> 삭제
                                </button>
                              </div>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Mobile card list */}
                <div className="md:hidden space-y-2">
                  {studentList.map((s) => {
                    const lv = levelOf(s.xp);
                    const mine = s.classCode === currentClassCode;
                    return (
                      <div
                        key={s.id}
                        className={`rounded-2xl border-2 border-[color:var(--border)] p-3 ${mine ? "" : "opacity-70"}`}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                          <div className="min-w-0">
                            <div className="font-black text-[color:var(--navy)] truncate">
                              {s.name}
                            </div>
                            <div className="font-mono text-[11px] text-muted-foreground truncate">
                              {s.id}
                            </div>
                            {s.group && (
                              <div className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--mint)]/50 text-[color:var(--navy)]">
                                {s.group}
                              </div>
                            )}
                          </div>
                          <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[color:var(--mint)] text-[color:var(--navy)]">
                            Lv.{lv.current.lv} · {s.xp}XP
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1 justify-end">
                          <button
                            onClick={() => setEditingStudent(s.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--navy)] text-[color:var(--navy-foreground)]"
                          >
                            <Pencil size={12} /> 정보 수정
                          </button>
                          {onOpenReport && (
                            <button
                              onClick={() => onOpenReport(s.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--mint)] text-[color:var(--navy)]"
                            >
                              📄 리포트
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `정말로 이 학생의 계정과 누적 데이터를 삭제하시겠습니까?\n\n[${s.id}] ${s.name} · ${s.xp} XP\n\n(예절 역할극 대화 이력은 유지됩니다)`,
                                )
                              ) {
                                onDeleteStudent(s.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-100 text-[color:var(--danger)]"
                          >
                            <Trash2 size={12} /> 삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {editing && (
        <EditModal
          entry={editing}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            onUpdate(editing.id, patch);
            setEditingId(null);
          }}
        />
      )}

      {editingStudentRec && (
        <StudentEditModal
          student={editingStudentRec}
          onClose={() => setEditingStudent(null)}
          onSave={(patch) => {
            onUpdateStudent(editingStudentRec.id, patch);
            setEditingStudent(null);
          }}
        />
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left font-bold text-[color:var(--navy)] px-3 py-2 ${className}`}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className = "",
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`text-left font-bold text-[color:var(--navy)] px-3 py-2 ${className}`}>
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${active ? "text-[color:var(--mint-deep)]" : "text-[color:var(--navy)]"}`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp size={11} />
          ) : (
            <ArrowDown size={11} />
          )
        ) : (
          <span className="text-[10px] opacity-40">↕</span>
        )}
      </button>
    </th>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition ${
        active
          ? "bg-white text-[color:var(--navy)] shadow-sm"
          : "text-muted-foreground hover:text-[color:var(--navy)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function TabStat({
  label,
  n,
  color,
  active,
  onClick,
}: {
  label: string;
  n: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-3 text-white transition ${active ? "ring-4 ring-offset-2 ring-[color:var(--navy)]/30 scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
      style={{ background: color }}
    >
      <div className="text-xs opacity-90 font-bold">{label}</div>
      <div className="text-2xl font-black">{n}</div>
    </button>
  );
}

function EntryRow({
  entry,
  showActions,
  onApprove,
  onReject,
  onEdit,
}: {
  entry: DictEntry;
  showActions: boolean;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onEdit: () => void;
}) {
  const g = gradeOf(entry.total_harmful_score);
  const bg =
    g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";
  return (
    <div className="rounded-xl border-2 border-[color:var(--border)] p-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 mb-2">
        <div className="min-w-0">
          <div className="font-black text-[color:var(--navy)] text-lg truncate">{entry.word}</div>
          <div className="text-xs text-muted-foreground truncate">
            제안 {entry.suggested_by} · 투표 {entry.vote_count ?? 1}
          </div>
        </div>
        <span
          className="shrink-0 text-xs font-bold px-2 py-1 rounded-full text-white"
          style={{ background: bg }}
        >
          {g.emoji} {entry.total_harmful_score}
        </span>
      </div>
      <p className="text-sm text-[color:var(--navy)] line-clamp-3">{entry.student_definition}</p>
      <div className="mt-2 text-xs text-[color:var(--mint-deep)] truncate">
        💡 대안: {entry.alternatives.join(" / ") || "—"}
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1 text-[10px] text-center">
        {(
          ["aggression", "bullying", "discrimination", "violence", "grammar_destruction"] as const
        ).map((k) => (
          <div key={k} className="rounded-md bg-[color:var(--muted)] py-1">
            <div className="text-muted-foreground">{k.slice(0, 4)}</div>
            <div className="font-black text-[color:var(--navy)]">
              {entry.evaluations[k].toFixed(1)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {showActions && (
          <>
            <button
              onClick={() => onReject(entry.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--muted)] text-[color:var(--danger)]"
            >
              반려
            </button>
            <button
              onClick={() => onApprove(entry.id)}
              className="px-4 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--safe)] text-white"
            >
              ✅ 승인
            </button>
          </>
        )}
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold bg-[color:var(--navy)] text-[color:var(--navy-foreground)] hover:scale-[1.03] transition"
        >
          <Pencil size={13} /> 데이터 수정
        </button>
      </div>
    </div>
  );
}

const EVAL_META: { key: keyof Evaluation; label: string; emoji: string }[] = [
  { key: "aggression", label: "공격성", emoji: "💥" },
  { key: "bullying", label: "따돌림", emoji: "🚫" },
  { key: "discrimination", label: "혐오성", emoji: "🙅" },
  { key: "violence", label: "폭력성", emoji: "⚔️" },
  { key: "grammar_destruction", label: "문법파괴", emoji: "🔤" },
];

function EditModal({
  entry,
  onClose,
  onSave,
}: {
  entry: DictEntry;
  onClose: () => void;
  onSave: (patch: UpdatePayload) => void;
}) {
  const [word, setWord] = useState(entry.word);
  const [def, setDef] = useState(entry.student_definition);
  const [source, setSource] = useState(entry.source ?? "");
  const [evals, setEvals] = useState<Evaluation>({ ...entry.evaluations });
  const [alts, setAlts] = useState<string[]>([...entry.alternatives]);
  const [newAlt, setNewAlt] = useState("");

  const total = useMemo(() => Math.round(computeTotal(evals)), [evals]);
  const g = gradeOf(total);
  const badgeBg =
    g.tone === "safe" ? "var(--safe)" : g.tone === "warn" ? "var(--warn)" : "var(--danger)";

  function updateEval(k: keyof Evaluation, v: number) {
    setEvals((prev) => ({ ...prev, [k]: v }));
  }
  function addAlt() {
    const t = newAlt.trim();
    if (!t) return;
    if (alts.includes(t)) return;
    setAlts([...alts, t]);
    setNewAlt("");
  }

  function save() {
    const w = word.trim();
    const d = def.trim();
    if (!w || !d) return;
    onSave({
      word: w,
      student_definition: d,
      source: source.trim() || undefined,
      evaluations: evals,
      alternatives: alts.slice(0, 8),
    });
  }

  return (
    <GlassModal title="✏️ 데이터 수정" subtitle={entry.word} onClose={onClose}>
      <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 overflow-y-auto scroll-touch">
        <Field label="낱말명">
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            maxLength={40}
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
          />
        </Field>
        <Field label="뜻풀이 (초등 국어 눈높이 설명)">
          <textarea
            value={def}
            onChange={(e) => setDef(e.target.value)}
            maxLength={600}
            rows={4}
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)] resize-y"
          />
          <div className="text-[10px] text-muted-foreground text-right mt-1">{def.length}/600</div>
        </Field>
        <Field label="출처 (선택)">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            maxLength={120}
            placeholder="예: 국립국어원, 인터넷 커뮤니티 등"
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
          />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-[color:var(--navy)]">
              5대 리터러시 유해성 점수 (1~5)
            </div>
            <div
              className="text-xs font-black px-3 py-1.5 rounded-full text-white shadow-sm transition-colors"
              style={{ background: badgeBg }}
            >
              {g.emoji} 종합 {total}/100 · {g.label}
            </div>
          </div>
          <div className="space-y-2">
            {EVAL_META.map(({ key, label, emoji }) => (
              <div key={key} className="rounded-xl bg-white/60 border border-white/70 px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-bold text-[color:var(--navy)]">
                    {emoji} {label}
                  </div>
                  <div className="text-xs font-black text-[color:var(--navy)]">
                    {evals[key].toFixed(1)}
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={evals[key]}
                  onChange={(e) => updateEval(key, Number(e.target.value))}
                  className="w-full accent-[color:var(--mint-deep)]"
                />
              </div>
            ))}
          </div>
        </div>
        <Field label="바른 우리말 대안 표현">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {alts.length === 0 && (
              <span className="text-xs text-muted-foreground">
                아직 대안이 없어요. 아래에서 추가해 주세요.
              </span>
            )}
            {alts.map((a, i) => (
              <span
                key={`${a}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-[color:var(--mint)] text-[color:var(--navy)] text-xs font-bold px-2.5 py-1"
              >
                {a}
                <button
                  onClick={() => setAlts(alts.filter((_, idx) => idx !== i))}
                  className="opacity-70 hover:opacity-100"
                  aria-label={`${a} 삭제`}
                  type="button"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newAlt}
              onChange={(e) => setNewAlt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAlt();
                }
              }}
              maxLength={30}
              placeholder="새 대안 표현 (Enter로 추가)"
              className="flex-1 rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
            />
            <button
              type="button"
              onClick={addAlt}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[color:var(--mint-deep)] text-white text-sm font-bold hover:scale-[1.03] transition"
            >
              <Plus size={14} /> 추가
            </button>
          </div>
        </Field>
      </div>
      <ModalFooter onClose={onClose} onSave={save} disabled={!word.trim() || !def.trim()} />
    </GlassModal>
  );
}

function StudentEditModal({
  student,
  onClose,
  onSave,
}: {
  student: StudentRecord;
  onClose: () => void;
  onSave: (patch: StudentPatch) => void;
}) {
  const [name, setName] = useState(student.name);
  const [password, setPassword] = useState(student.password ?? "");
  const [group, setGroup] = useState(student.group ?? "");
  const [xp, setXp] = useState<number>(student.xp);
  const lv = levelOf(Math.max(0, Math.round(xp)));

  function save() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      password,
      group,
      xp: Math.max(0, Math.round(xp)),
    });
  }

  return (
    <GlassModal
      title="✏️ 학생 정보 수정"
      subtitle={`${student.id} · ${student.name}`}
      onClose={onClose}
    >
      <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 overflow-y-auto scroll-touch">
        <Field label="이름">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
          />
        </Field>
        <Field label="그룹 / 모둠 (선택)">
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            maxLength={20}
            placeholder="예: 모둠A, 1분단, 도서부…"
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
          />
        </Field>
        <Field label="비밀번호 (재설정하려면 입력 · 비우면 삭제)">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={40}
            placeholder="새 비밀번호"
            className="w-full rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setPassword("1234")}
              className="text-xs px-2 py-1 rounded-md bg-[color:var(--muted)] font-bold"
            >
              1234로 초기화
            </button>
            <button
              type="button"
              onClick={() => setPassword("")}
              className="text-xs px-2 py-1 rounded-md bg-[color:var(--muted)] font-bold"
            >
              비밀번호 제거
            </button>
          </div>
        </Field>
        <Field label="누적 XP 강제 조정">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={xp}
              onChange={(e) => setXp(Number(e.target.value))}
              className="w-32 rounded-xl bg-white/70 border border-white/70 px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[color:var(--mint-deep)]"
            />
            <input
              type="range"
              min={0}
              max={2000}
              step={10}
              value={Math.min(2000, Math.max(0, xp))}
              onChange={(e) => setXp(Number(e.target.value))}
              className="flex-1 accent-[color:var(--mint-deep)]"
            />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-[color:var(--mint)] text-[color:var(--navy)] font-bold">
              Lv.{lv.current.lv} {lv.current.name}
            </span>
            <span className="text-muted-foreground">
              이전 {student.xp} XP → 새로 {Math.max(0, Math.round(xp))} XP
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            ⚠︎ XP를 조정하면 학급 총합 XP도 그 차이만큼 함께 반영되어 [우리 반 언어 기상도]와 카톡
            잠금 해제에 영향을 줍니다.
          </div>
        </Field>
      </div>
      <ModalFooter onClose={onClose} onSave={save} disabled={!name.trim()} />
    </GlassModal>
  );
}

function GlassModal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm overflow-x-hidden p-2 sm:p-4 flex items-center justify-center animate-fade-in pl-safe pr-safe"
      style={{
        paddingTop: "max(env(safe-area-inset-top, 0px), 8px)",
        paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
      }}
    >
      <div
        className="w-full max-w-2xl min-w-0 max-h-[calc(100dvh-16px)] sm:max-h-[85vh] rounded-3xl border border-white/60 shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.75))",
          backdropFilter: "blur(24px) saturate(160%)",
        }}
      >
        <div className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/50 bg-white/40">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[color:var(--mint-deep)]">{title}</div>
            {subtitle && (
              <h3 className="text-xl font-black text-[color:var(--navy)] truncate">{subtitle}</h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-11 h-11 grid place-items-center rounded-full hover:bg-black/5"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onSave,
  disabled,
}: {
  onClose: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-white/50 bg-white/40 flex flex-wrap items-center justify-end gap-2">
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-xl bg-[color:var(--muted)] text-sm font-bold"
      >
        취소
      </button>
      <button
        onClick={onSave}
        disabled={disabled}
        className="px-5 py-2 rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] text-sm font-bold disabled:opacity-40 hover:scale-[1.03] transition"
      >
        💾 변경사항 저장하기
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-bold text-[color:var(--navy)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}
