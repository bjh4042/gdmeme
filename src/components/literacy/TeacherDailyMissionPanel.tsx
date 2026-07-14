import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { StudentRecord } from "@/lib/literacy-types";
import { studentId as makeStudentId } from "@/lib/literacy-store";
import {
  missionEntryAt,
  readMissionForStudent,
  type DailyMissionState,
} from "@/lib/daily-mission";

type Row = {
  student: StudentRecord;
  state: DailyMissionState | null;
};

/**
 * 오늘의 상황 미션 참여 현황 (교사용).
 * localStorage 에 저장된 실제 학생 응답만 표시한다. 가짜 통계 없음.
 */
export function TeacherDailyMissionPanel({
  students,
  currentClassCode,
}: {
  students: StudentRecord[];
  currentClassCode: string;
}) {
  const rows: Row[] = useMemo(() => {
    const inClass = students.filter((s) => s.classCode === currentClassCode);
    return inClass
      .map((s) => {
        const sid = makeStudentId(s.classCode, s.number);
        return { student: s, state: readMissionForStudent(sid) };
      })
      .sort((a, b) => {
        // 참여자 우선 → 완료 우선 → 번호순
        const ap = a.state ? 1 : 0;
        const bp = b.state ? 1 : 0;
        if (ap !== bp) return bp - ap;
        const ad = a.state?.done ? 1 : 0;
        const bd = b.state?.done ? 1 : 0;
        if (ad !== bd) return bd - ad;
        return a.student.number.localeCompare(b.student.number);
      });
  }, [students, currentClassCode]);

  const participated = rows.filter((r) => !!r.state).length;
  const completed = rows.filter((r) => r.state?.done).length;
  const pending = participated - completed;

  const [openId, setOpenId] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div className="text-[12px] text-slate-500">현재 학급에 등록된 학생이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <SummaryPill label="참여" value={participated} tone="sky" />
        <SummaryPill label="완료" value={completed} tone="emerald" />
        <SummaryPill label="미완료" value={pending < 0 ? 0 : pending} tone="amber" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_90px_90px_40px] items-center gap-2 bg-slate-50 border-b border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600">
          <div>번호</div>
          <div>이름</div>
          <div>상태</div>
          <div>완료 시각</div>
          <div />
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map(({ student, state }) => {
            const sid = makeStudentId(student.classCode, student.number);
            const open = openId === sid;
            const entry = state ? missionEntryAt(state.missionIndex) : null;
            return (
              <li key={sid}>
                <div
                  className="grid grid-cols-[60px_1fr_90px_90px_40px] items-center gap-2 px-3 py-2 text-[12px]"
                >
                  <div className="font-mono text-slate-700">{student.number}</div>
                  <div className="text-slate-800 truncate">{student.name}</div>
                  <div>
                    {state?.done ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5">
                        완료
                      </span>
                    ) : state ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5">
                        진행중
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5">
                        미참여
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 tabular-nums">
                    {state?.completedAt ? formatTime(state.completedAt) : "—"}
                  </div>
                  <div>
                    {state ? (
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : sid)}
                        className="w-7 h-7 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-500"
                        aria-label="학생 응답 보기"
                        title="학생 응답 보기"
                      >
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
                {open && state && (
                  <div className="bg-slate-50/70 px-3 py-3 border-t border-slate-100 space-y-2">
                    {entry && (
                      <div className="text-[11px] text-slate-500">
                        <span className="font-bold text-slate-600">오늘의 상황:</span>{" "}
                        “{entry.keywords[0] ?? "-"}”
                      </div>
                    )}
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="text-[10px] font-bold text-slate-500 mb-1">
                        학생 응답
                      </div>
                      <div
                        className="text-[12px] text-slate-800"
                        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                      >
                        {state.answer || "(응답 없음)"}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber";
}) {
  const map: Record<string, string> = {
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };
  return (
    <div className={`rounded-2xl border px-3 py-2 ${map[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-lg font-black tabular-nums">{value}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "—";
  }
}
