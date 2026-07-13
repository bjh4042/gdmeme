import { useMemo, useState } from "react";
import type { DictEntry, StudentRecord } from "@/lib/literacy-types";
import { aggregateRoadmap, STAGES, deriveRoadmap } from "@/lib/roadmap";
import { useEngagementStore, EMPTY_ENGAGEMENT } from "@/stores/engagement";

/**
 * 교사 대시보드 상단 확장 패널.
 *  1) 학급 현황: 등록/참여/완료/단계별 완료율
 *  2) 학생별 학습 현황: 5단계 진행률 표 (실명↔익명 토글)
 *  3) 단계별 활동 분석: 각 단계 참여/완료/대표 상세
 *
 * 기존 TeacherDashboard 의 어떤 상태나 콜백도 건드리지 않고,
 * 순수하게 스토어 데이터에서 파생한다. 접혀 있는 상태로 시작해
 * 기존 UI 를 방해하지 않는다.
 */
export function RoadmapTeacherPanel({
  students,
  currentClassCode,
  dict,
}: {
  students: StudentRecord[];
  currentClassCode: string;
  dict: DictEntry[];
}) {
  const byStudent = useEngagementStore((s) => s.byStudent);
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<"class" | "students" | "stages">("class");
  const [anonymize, setAnonymize] = useState(false);
  const [classFilter, setClassFilter] = useState<string>(currentClassCode || "__all__");

  const classes = useMemo(() => {
    const s = new Set<string>();
    for (const st of students) s.add(st.classCode);
    return Array.from(s).sort();
  }, [students]);

  const scope = useMemo(
    () => (classFilter === "__all__" ? students : students.filter((s) => s.classCode === classFilter)),
    [students, classFilter],
  );

  const agg = useMemo(
    () =>
      aggregateRoadmap({
        students: scope,
        byStudent,
        dict,
      }),
    [scope, byStudent, dict],
  );

  const recent7 = useMemo(() => {
    const now = Date.now();
    return scope.filter((s) => {
      const t = Date.parse(s.lastActiveAt);
      return Number.isFinite(t) && now - t <= 7 * 24 * 60 * 60 * 1000;
    }).length;
  }, [scope]);

  const nonActive = scope.length - agg.activeCount;
  const overallRate = scope.length
    ? Math.round((agg.perStageSummary.reduce((a, s) => a + s.avgProgress, 0) / (agg.perStageSummary.length * 1)) * 100)
    : 0;

  return (
    <section className="mb-5 rounded-2xl border-2 border-[color:var(--navy)]/15 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase text-[color:var(--mint-deep)] tracking-wider">Roadmap Insights (1차)</div>
          <h4 className="text-base sm:text-lg font-black text-[color:var(--navy)]">
            🛡️ 바른말 수호 5단계 · 학급 학습 현황
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="text-xs rounded-lg border border-slate-300 px-2 py-1.5 bg-white"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            aria-label="학급 필터"
          >
            <option value="__all__">전체 학급</option>
            {classes.map((c) => (
              <option key={c} value={c}>{c}반</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={anonymize}
              onChange={(e) => setAnonymize(e.target.checked)}
              className="accent-[color:var(--navy)]"
            />
            익명화 (S01…)
          </label>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-[color:var(--muted)] font-bold"
            aria-expanded={open}
          >
            {open ? "접기" : "펼치기"}
          </button>
        </div>
      </header>

      {open && (
        <div className="p-3 sm:p-4 space-y-4">
          <nav className="inline-flex rounded-xl bg-[color:var(--muted)] p-1 text-xs font-bold gap-1" role="tablist">
            {[
              { id: "class", label: "학급 현황" },
              { id: "students", label: "학생별 현황" },
              { id: "stages", label: "단계별 분석" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={view === t.id}
                onClick={() => setView(t.id as typeof view)}
                className={`px-3 py-1.5 rounded-lg transition ${
                  view === t.id ? "bg-[color:var(--navy)] text-[color:var(--navy-foreground)]" : "text-slate-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {view === "class" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="등록 학생" value={`${scope.length}명`} />
              <StatCard label="참여 학생" value={`${agg.activeCount}명`} sub={`미참여 ${nonActive}명`} />
              <StatCard label="최근 7일 활동" value={`${recent7}명`} />
              <StatCard label="임무 완료" value={`${agg.finishedCount}명`} sub={`전체 진행률 ${overallRate}%`} />
              <div className="col-span-2 sm:col-span-4 rounded-2xl border border-slate-200 p-3">
                <div className="text-xs font-black text-[color:var(--navy)] mb-2">5단계별 평균 진행률</div>
                <ul className="space-y-1.5">
                  {agg.perStageSummary.map((s) => (
                    <li key={s.key} className="grid grid-cols-[80px_1fr_56px] items-center gap-2 text-xs">
                      <span className="font-bold text-slate-700">
                        {s.stage.icon} {s.stage.short}
                      </span>
                      <span className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-hidden>
                        <span
                          className="block h-full bg-[color:var(--navy)]"
                          style={{ width: `${Math.round(s.avgProgress * 100)}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums">
                        {Math.round(s.avgProgress * 100)}% <span className="text-slate-400">({s.doneCount})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {view === "students" && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-2 py-2 font-black text-slate-700">#</th>
                    <th className="text-left px-2 py-2 font-black text-slate-700">학생</th>
                    <th className="text-left px-2 py-2 font-black text-slate-700">최근 접속</th>
                    <th className="text-center px-2 py-2 font-black text-slate-700">완료 단계</th>
                    <th className="text-center px-2 py-2 font-black text-slate-700">전체 완료율</th>
                    <th className="text-center px-2 py-2 font-black text-slate-700">활동(공감/저널)</th>
                    <th className="text-center px-2 py-2 font-black text-slate-700">실천</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.perStudent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-400">
                        표시할 학생이 없습니다.
                      </td>
                    </tr>
                  )}
                  {agg.perStudent.map((row, i) => {
                    const eng = byStudent[row.student.id] ?? EMPTY_ENGAGEMENT;
                    const rate = Math.round((row.roadmap.completedCount / row.roadmap.totalCount) * 100);
                    return (
                      <tr key={row.student.id} className="odd:bg-white even:bg-slate-50/40 border-t border-slate-100">
                        <td className="px-2 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <div className="font-bold text-slate-800">
                            {anonymize ? `S${String(i + 1).padStart(2, "0")}` : row.student.name}
                          </div>
                          <div className="text-[10px] text-slate-400">{row.student.classCode}·{row.student.number}</div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {row.student.lastActiveAt ? new Date(row.student.lastActiveAt).toLocaleDateString("ko-KR") : "-"}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex justify-center gap-0.5" aria-label={`완료 단계 ${row.roadmap.completedCount} / ${row.roadmap.totalCount}`}>
                            {row.roadmap.stages.map((st) => (
                              <span
                                key={st.key}
                                title={STAGES.find((s) => s.key === st.key)?.title}
                                className={`inline-block w-4 h-4 rounded-full border ${
                                  st.done
                                    ? "bg-emerald-500 border-emerald-600"
                                    : st.progress > 0
                                      ? "bg-amber-300 border-amber-500"
                                      : "bg-slate-200 border-slate-300"
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums font-bold">{rate}%</td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                          {eng.likesGivenCount}·{eng.journals.length}
                        </td>
                        <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                          {(eng.practiceLogs?.length ?? 0)}회
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === "stages" && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {STAGES.map((stage) => {
                const summary = agg.perStageSummary.find((s) => s.key === stage.key)!;
                const samples = scope
                  .slice(0, 40)
                  .map((s) => ({
                    student: s,
                    rm: deriveRoadmap({ studentId: s.id, classCode: s.classCode, engagement: byStudent[s.id], dict }),
                  }))
                  .filter((r) => r.rm.stages.find((x) => x.key === stage.key)?.done)
                  .slice(0, 5);
                return (
                  <div key={stage.key} className={`rounded-2xl border p-3 ${stage.color}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-black text-sm">
                        {stage.icon} {stage.order}단계 · {stage.title}
                      </div>
                      <div className="text-[11px] font-bold tabular-nums">
                        {summary.doneCount}/{scope.length || 0}명
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-1 leading-snug">{stage.desc}</div>
                    <div className="h-1.5 rounded-full bg-white/70 mt-2 overflow-hidden" aria-hidden>
                      <div
                        className="h-full bg-[color:var(--navy)]"
                        style={{ width: `${Math.round(summary.avgProgress * 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-slate-700">
                      <b>먼저 도달한 학생:</b>{" "}
                      {samples.length === 0
                        ? "아직 없어요"
                        : samples
                            .map((s, i) => (anonymize ? `S${String(i + 1).padStart(2, "0")}` : s.student.name))
                            .join(", ")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{label}</div>
      <div className="text-xl font-black text-[color:var(--navy)] mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}