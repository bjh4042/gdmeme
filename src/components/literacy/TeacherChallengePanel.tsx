import { useMemo, useState } from "react";
import type { StudentRecord } from "@/lib/literacy-types";
import { CHALLENGE_MISSIONS, formatIsoDate, todayIsoDate } from "@/lib/challenge-7day";
import { EMPTY_CHALLENGE, progressOf, useChallengeStore } from "@/stores/challenge";

/** 교사용 · 7일 실천 관리 — 학생별 DAY 완료/진행률/성찰/피드백. */
export function TeacherChallengePanel({
  students,
  currentClassCode,
}: {
  students: StudentRecord[];
  currentClassCode: string;
}) {
  const byStudent = useChallengeStore((s) => s.byStudent);
  const setTeacherFeedback = useChallengeStore((s) => s.setTeacherFeedback);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const rows = useMemo(() => {
    const today = todayIsoDate();
    return students
      .filter((s) => !currentClassCode || s.classCode === currentClassCode)
      .filter((s) => Number(s.number) > 0) // 00번(교사 계정) 제외
      .sort((a, b) => Number(a.number) - Number(b.number))
      .map((s) => {
        const rec = byStudent[s.id] ?? EMPTY_CHALLENGE;
        const doneDays = new Set(rec.days.map((d) => d.day));
        const last = rec.days.reduce<string | undefined>(
          (acc, d) => (!acc || d.date > acc ? d.date : acc),
          undefined,
        );
        return {
          student: s,
          rec,
          doneDays,
          pct: progressOf(rec),
          last,
          todayDone: rec.days.some((d) => d.date === today),
        };
      });
  }, [students, currentClassCode, byStudent]);

  const totalCells = rows.length * 7;
  const doneCells = rows.reduce((a, r) => a + r.rec.days.length, 0);
  const overall = totalCells ? Math.round((doneCells / totalCells) * 100) : 0;
  const todayCount = rows.filter((r) => r.todayDone).length;
  const fullCount = rows.filter((r) => r.rec.days.length === 7).length;

  const open = openId ? rows.find((r) => r.student.id === openId) : null;

  return (
    <div className="min-w-0">
      {/* 상단 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-3">
        <Stat label="전체 학생 수" value={`${rows.length}명`} />
        <Stat label="오늘 참여" value={`${todayCount}명`} />
        <Stat label="오늘 미참여" value={`${rows.length - todayCount}명`} />
        <Stat label="7일 완료" value={`${fullCount}명`} />
        <Stat label="평균 진행률" value={`${overall}%`} />
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">표시할 학생이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground border-b border-[color:var(--border)]">
                <th className="py-2 pr-2 font-bold">번호</th>
                <th className="py-2 pr-2 font-bold">이름</th>
                {CHALLENGE_MISSIONS.map((m) => (
                  <th key={m.day} className="py-2 px-1 font-bold text-center">
                    D{m.day}
                  </th>
                ))}
                <th className="py-2 px-2 font-bold">진행률</th>
                <th className="py-2 px-2 font-bold">최근 완료</th>
                <th className="py-2 px-2 font-bold">완료 일수</th>
                <th className="py-2 pl-2 font-bold">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student.id} className="border-b border-[color:var(--border)]/60">
                  <td className="py-2 pr-2 font-mono text-xs">{r.student.number}</td>
                  <td className="py-2 pr-2 font-bold text-[color:var(--navy)] truncate max-w-[7rem]">
                    {r.student.name}
                  </td>
                  {CHALLENGE_MISSIONS.map((m) => (
                    <td key={m.day} className="py-2 px-1 text-center">
                      <span
                        className={`inline-grid h-6 w-6 place-items-center rounded-lg text-[11px] font-black ${
                          r.doneDays.has(m.day)
                            ? "bg-primary/15 text-primary"
                            : "bg-[color:var(--muted)] text-muted-foreground"
                        }`}
                        aria-label={`DAY${m.day} ${r.doneDays.has(m.day) ? "완료" : "미완료"}`}
                      >
                        {r.doneDays.has(m.day) ? "✓" : "·"}
                      </span>
                    </td>
                  ))}
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[color:var(--muted)]">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: `${r.pct}%` }}
                        />
                      </span>
                      <span className="text-[11px] font-bold">{r.pct}%</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-[11px] text-muted-foreground">
                    {formatIsoDate(r.last)}
                  </td>
                  <td className="py-2 px-2 text-[11px] font-bold">{r.rec.days.length}/7</td>
                  <td className="py-2 pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenId(r.student.id);
                        setDraft(r.rec.teacherFeedback ?? "");
                      }}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[color:var(--muted)] font-bold hover:bg-[color:var(--mint)]"
                    >
                      성찰·피드백
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="mt-3 rounded-2xl border-2 border-[color:var(--navy)]/20 bg-[color:var(--muted)]/40 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-black text-[color:var(--navy)]">
              {open.student.number}번 {open.student.name} · 성찰 기록
            </h4>
            <button
              type="button"
              onClick={() => setOpenId(null)}
              className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white font-bold border border-[color:var(--border)]"
            >
              닫기
            </button>
          </div>
          <ul className="mt-2 space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
            {open.rec.days.length === 0 && (
              <li className="text-xs text-muted-foreground">아직 작성한 성찰이 없습니다.</li>
            )}
            {open.rec.days.map((d) => (
              <li
                key={d.day}
                className="rounded-xl bg-white border border-[color:var(--border)] px-3 py-2"
              >
                <div className="text-[11px] font-black text-primary">
                  DAY {d.day} · {formatIsoDate(d.date)}{" "}
                  {new Date(d.completedAt).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-xs text-slate-700 leading-relaxed">{d.reflection}</div>
              </li>
            ))}
          </ul>
          <label className="mt-3 block text-xs font-bold text-[color:var(--navy)]">
            교사 피드백
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 300))}
            rows={3}
            className="mt-1 w-full resize-none rounded-xl border-2 border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--navy)]"
            placeholder="학생에게 전할 격려와 안내를 적어 주세요."
          />
          <button
            type="button"
            onClick={() => setTeacherFeedback(open.student.id, draft)}
            className="mt-2 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground font-bold"
          >
            피드백 저장
          </button>
          {open.rec.teacherFeedbackAt && (
            <span className="ml-2 text-[11px] text-muted-foreground">
              최근 저장 · {new Date(open.rec.teacherFeedbackAt).toLocaleString("ko-KR")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[color:var(--muted)] px-3 py-2">
      <div className="text-[11px] text-muted-foreground font-bold">{label}</div>
      <div className="text-lg font-black text-[color:var(--navy)]">{value}</div>
    </div>
  );
}