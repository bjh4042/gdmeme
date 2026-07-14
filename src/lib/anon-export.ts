// 익명 연구 데이터 내보내기 — 개인식별정보 제거, CSV(UTF-8 BOM) / XLSX 지원.
import * as XLSX from "xlsx";
import type { DictEntry, StudentRecord } from "./literacy-types";
import type { StudentEngagement } from "@/stores/engagement";
import { deriveRoadmap } from "./roadmap";

type Row = Record<string, string | number>;

function anonMap(students: StudentRecord[]): Map<string, string> {
  const sorted = [...students].sort((a, b) => {
    const j = (a.joinedAt || "").localeCompare(b.joinedAt || "");
    if (j !== 0) return j;
    return (a.classCode + a.number).localeCompare(b.classCode + b.number);
  });
  const m = new Map<string, string>();
  sorted.forEach((s, i) => m.set(s.id, `S${String(i + 1).padStart(2, "0")}`));
  return m;
}

function buildRows(input: {
  students: StudentRecord[];
  byStudent: Record<string, StudentEngagement>;
  dict: DictEntry[];
}): Row[] {
  const map = anonMap(input.students);
  return input.students.map((s) => {
    const eng = input.byStudent[s.id];
    const proposals = input.dict.filter((d) => d.suggested_by === s.id);
    const rm = deriveRoadmap({ studentId: s.id, classCode: s.classCode, engagement: eng, dict: input.dict });
    return {
      익명코드: map.get(s.id) ?? s.id,
      검색수: (eng?.likesGivenCount ?? 0) + proposals.length, // 활동량 근사
      제안수: proposals.length,
      공감수: eng?.likesGivenCount ?? 0,
      공감받은수: eng?.likesReceivedCount ?? 0,
      퀴즈XP: s.xp,
      성찰수: eng?.journals?.length ?? 0,
      실천수: eng?.practiceLogs?.length ?? 0,
      단계1_발견: Math.round(rm.stages[0].progress * 100),
      단계2_파헤치기: Math.round(rm.stages[1].progress * 100),
      단계3_공감: Math.round(rm.stages[2].progress * 100),
      단계4_바꾸기: Math.round(rm.stages[3].progress * 100),
      단계5_실천: Math.round(rm.stages[4].progress * 100),
      완료단계수: rm.completedCount,
      마지막활동: s.lastActiveAt ? s.lastActiveAt.slice(0, 10) : "",
    };
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAnonCSV(input: {
  students: StudentRecord[];
  byStudent: Record<string, StudentEngagement>;
  dict: DictEntry[];
}) {
  const rows = buildRows(input);
  if (rows.length === 0) {
    downloadBlob(new Blob(["\ufeff익명코드\n"], { type: "text/csv;charset=utf-8;" }), "바른말수호대_익명_학습활동.csv");
    return 0;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  downloadBlob(
    new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }),
    "바른말수호대_익명_학습활동.csv",
  );
  return rows.length;
}

export function exportAnonXLSX(input: {
  students: StudentRecord[];
  byStudent: Record<string, StudentEngagement>;
  dict: DictEntry[];
}) {
  const rows = buildRows(input);
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 익명코드: "S00" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "익명_학습활동");
  XLSX.writeFile(wb, "바른말수호대_익명_학습활동.xlsx");
  return rows.length;
}
