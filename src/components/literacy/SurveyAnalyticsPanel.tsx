import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
} from "recharts";
import type { StudentRecord } from "@/lib/literacy-types";
import {
  DOMAIN_META,
  SURVEY_ITEMS,
  loadAnswer,
  summarizeClass,
  overallScore,
  scoreByDomain,
  type SurveyDomain,
} from "@/lib/pre-post-survey";
import { aggregateRoadmap, STAGES } from "@/lib/roadmap";
import { useEngagementStore } from "@/stores/engagement";
import type { DictEntry } from "@/lib/literacy-types";

type Props = {
  students: StudentRecord[];
  currentClassCode: string;
  dict: DictEntry[];
};

export function SurveyAnalyticsPanel({ students, currentClassCode, dict }: Props) {
  const [open, setOpen] = useState(true);
  const [anonymize, setAnonymize] = useState(false);
  const [classFilter, setClassFilter] = useState<string>(currentClassCode || "__all__");
  const [tick, setTick] = useState(0);
  const byStudent = useEngagementStore((s) => s.byStudent);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("wtmeme:survey:changed", bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener("wtmeme:survey:changed", bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const classes = useMemo(() => {
    const s = new Set<string>();
    for (const st of students) s.add(st.classCode);
    return Array.from(s).sort();
  }, [students]);

  const scope = useMemo(
    () => (classFilter === "__all__" ? students : students.filter((s) => s.classCode === classFilter)),
    [students, classFilter],
  );

  const summary = useMemo(() => {
    // 여러 학급을 하나로 합치기 위해 학급별 요약을 병합
    const codes = classFilter === "__all__" ? classes : [classFilter];
    const pairs: ReturnType<typeof summarizeClass>["pairs"] = [];
    const merged = {
      pre: { count: 0, domains: { awareness: 0, empathy: 0, rewrite: 0, practice: 0 } as Record<SurveyDomain, number>, overall: 0 },
      post: { count: 0, domains: { awareness: 0, empathy: 0, rewrite: 0, practice: 0 } as Record<SurveyDomain, number>, overall: 0 },
    };
    for (const code of codes) {
      const s = summarizeClass(code, students);
      pairs.push(...s.pairs);
      (["pre", "post"] as const).forEach((st) => {
        if (!s.perStage[st].count) return;
        // 재가중치 평균을 위해 원본 합을 되살린다
        const c = s.perStage[st].count;
        merged[st].count += c;
        merged[st].overall += s.perStage[st].overall * c;
        (Object.keys(merged[st].domains) as SurveyDomain[]).forEach((k) => {
          merged[st].domains[k] += s.perStage[st].domains[k] * c;
        });
      });
    }
    (["pre", "post"] as const).forEach((st) => {
      const b = merged[st];
      if (b.count) {
        b.overall = Math.round((b.overall / b.count) * 10) / 10;
        (Object.keys(b.domains) as SurveyDomain[]).forEach((k) => {
          b.domains[k] = Math.round((b.domains[k] / b.count) * 100) / 100;
        });
      }
    });
    return { pairs, perStage: merged };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, classFilter, classes, tick]);

  const chartData = (Object.keys(DOMAIN_META) as SurveyDomain[]).map((k) => ({
    domain: DOMAIN_META[k].label,
    사전: summary.perStage.pre.domains[k],
    사후: summary.perStage.post.domains[k],
  }));

  const deltaOverall = summary.perStage.post.overall - summary.perStage.pre.overall;

  // CSV/XLSX export ---------------------------------------------------------
  const exportSurveyXLSX = () => {
    const rows: Record<string, string | number>[] = [];
    scope.forEach((s, i) => {
      const anon = `S${String(i + 1).padStart(2, "0")}`;
      const pre = loadAnswer(s.classCode, s.id, "pre");
      const post = loadAnswer(s.classCode, s.id, "post");
      const row: Record<string, string | number> = {
        번호: i + 1,
        학급: s.classCode,
        학생: anonymize ? anon : s.name,
        학번: anonymize ? "" : s.number,
      };
      const preDom = pre ? scoreByDomain(pre.answers) : null;
      const postDom = post ? scoreByDomain(post.answers) : null;
      (Object.keys(DOMAIN_META) as SurveyDomain[]).forEach((k) => {
        row[`사전_${DOMAIN_META[k].label}`] = preDom ? Math.round(preDom[k] * 100) / 100 : "";
        row[`사후_${DOMAIN_META[k].label}`] = postDom ? Math.round(postDom[k] * 100) / 100 : "";
      });
      row["사전_총점(20)"] = pre ? overallScore(pre.answers) : "";
      row["사후_총점(20)"] = post ? overallScore(post.answers) : "";
      row["증감"] = pre && post ? Math.round((overallScore(post.answers) - overallScore(pre.answers)) * 10) / 10 : "";
      rows.push(row);
    });
    if (rows.length === 0) {
      toast.warning("내보낼 학생이 없습니다.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "사전사후검사");

    // 로드맵 요약 시트
    const agg = aggregateRoadmap({ students: scope, byStudent, dict });
    const rmRows = agg.perStudent.map((r, i) => {
      const anon = `S${String(i + 1).padStart(2, "0")}`;
      const eng = byStudent[r.student.id];
      const row: Record<string, string | number> = {
        번호: i + 1,
        학급: r.student.classCode,
        학생: anonymize ? anon : r.student.name,
        완료단계수: r.roadmap.completedCount,
        전체진행률: `${Math.round((r.roadmap.completedCount / r.roadmap.totalCount) * 100)}%`,
        공감준수: eng?.likesGivenCount ?? 0,
        저널수: eng?.journals.length ?? 0,
        실천체크: eng?.practiceLogs?.length ?? 0,
      };
      r.roadmap.stages.forEach((st, idx) => {
        row[`${idx + 1}단계_${STAGES[idx].short}`] = st.done ? "완료" : `${Math.round(st.progress * 100)}%`;
      });
      return row;
    });
    if (rmRows.length) {
      const ws2 = XLSX.utils.json_to_sheet(rmRows);
      XLSX.utils.book_append_sheet(wb, ws2, "학습로드맵");
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const fname = `바른말수호_리포트_${classFilter === "__all__" ? "전체" : classFilter}_${stamp}.xlsx`;
    XLSX.writeFile(wb, fname);
    toast.success(`엑셀 저장 완료 · ${fname}`);
  };

  const exportSurveyCSV = () => {
    const header = [
      "번호", "학급", "학생",
      ...(Object.keys(DOMAIN_META) as SurveyDomain[]).flatMap((k) => [`사전_${DOMAIN_META[k].label}`, `사후_${DOMAIN_META[k].label}`]),
      "사전_총점", "사후_총점", "증감",
    ];
    const lines = [header.join(",")];
    scope.forEach((s, i) => {
      const anon = `S${String(i + 1).padStart(2, "0")}`;
      const pre = loadAnswer(s.classCode, s.id, "pre");
      const post = loadAnswer(s.classCode, s.id, "post");
      const preDom = pre ? scoreByDomain(pre.answers) : null;
      const postDom = post ? scoreByDomain(post.answers) : null;
      const cols: (string | number)[] = [i + 1, s.classCode, anonymize ? anon : s.name];
      (Object.keys(DOMAIN_META) as SurveyDomain[]).forEach((k) => {
        cols.push(preDom ? preDom[k].toFixed(2) : "");
        cols.push(postDom ? postDom[k].toFixed(2) : "");
      });
      cols.push(pre ? overallScore(pre.answers) : "");
      cols.push(post ? overallScore(post.answers) : "");
      cols.push(pre && post ? (overallScore(post.answers) - overallScore(pre.answers)).toFixed(1) : "");
      lines.push(cols.map((c) => (typeof c === "string" && c.includes(",") ? `"${c}"` : String(c))).join(","));
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `바른말수호_사전사후_${classFilter === "__all__" ? "전체" : classFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 저장 완료");
  };

  const printReport = () => {
    document.body.classList.add("wtmeme-print-mode");
    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove("wtmeme-print-mode"), 200);
    }, 100);
  };

  return (
    <section className="mb-5 rounded-2xl border-2 border-[color:var(--navy)]/15 bg-white" data-wtmeme-print="survey">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3 border-b border-slate-100">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase text-[color:var(--mint-deep)] tracking-wider">Pre / Post Assessment (2차)</div>
          <h4 className="text-base sm:text-lg font-black text-[color:var(--navy)]">
            📊 사전·사후 검사 · 통계 · 내보내기
          </h4>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
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
            익명화
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <MetricCard label="사전 응답" value={`${summary.perStage.pre.count}명`} sub={`총점 ${summary.perStage.pre.overall}/20`} />
            <MetricCard label="사후 응답" value={`${summary.perStage.post.count}명`} sub={`총점 ${summary.perStage.post.overall}/20`} />
            <MetricCard
              label="총점 변화"
              value={`${deltaOverall > 0 ? "+" : ""}${deltaOverall.toFixed(1)}`}
              sub={deltaOverall > 0 ? "긍정적 성장" : deltaOverall < 0 ? "재점검 필요" : "-"}
            />
            <MetricCard label="문항 수" value={`${SURVEY_ITEMS.length}문항`} sub="4영역 리커트 1~5" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-3">
              <div className="text-xs font-black text-[color:var(--navy)] mb-2">영역별 평균 (사전 vs 사후)</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="domain" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="사전" fill="#94a3b8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="사후" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-3">
              <div className="text-xs font-black text-[color:var(--navy)] mb-2">4영역 균형 (레이더)</div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={chartData} outerRadius="75%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Radar name="사전" dataKey="사전" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.35} />
                    <Radar name="사후" dataKey="사후" stroke="#0f172a" fill="#0f172a" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-2 py-2 font-black text-slate-700">#</th>
                  <th className="text-left px-2 py-2 font-black text-slate-700">학생</th>
                  <th className="text-center px-2 py-2 font-black text-slate-700">사전 총점</th>
                  <th className="text-center px-2 py-2 font-black text-slate-700">사후 총점</th>
                  <th className="text-center px-2 py-2 font-black text-slate-700">증감</th>
                  <th className="text-center px-2 py-2 font-black text-slate-700">응답 상태</th>
                </tr>
              </thead>
              <tbody>
                {summary.pairs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-slate-400">표시할 학생이 없습니다.</td>
                  </tr>
                )}
                {summary.pairs.map((row, i) => {
                  const preScore = row.pre ? overallScore(row.pre.answers) : null;
                  const postScore = row.post ? overallScore(row.post.answers) : null;
                  const delta = preScore != null && postScore != null ? postScore - preScore : null;
                  return (
                    <tr key={row.student.id} className="odd:bg-white even:bg-slate-50/40 border-t border-slate-100">
                      <td className="px-2 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-bold text-slate-800">
                          {anonymize ? `S${String(i + 1).padStart(2, "0")}` : row.student.name}
                        </div>
                        <div className="text-[10px] text-slate-400">{row.student.classCode}</div>
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{preScore != null ? preScore.toFixed(1) : "-"}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{postScore != null ? postScore.toFixed(1) : "-"}</td>
                      <td
                        className={`px-2 py-1.5 text-center tabular-nums font-bold ${
                          delta == null ? "text-slate-400" : delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-slate-500"
                        }`}
                      >
                        {delta == null ? "-" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                      </td>
                      <td className="px-2 py-1.5 text-center text-[11px]">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${row.pre ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>사전</span>
                        <span className={`inline-block ml-1 px-2 py-0.5 rounded-full font-bold ${row.post ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>사후</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={exportSurveyXLSX}
              className="text-xs px-3 py-2 rounded-lg bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-bold"
            >
              📊 엑셀(XLSX) 다운로드 (검사+로드맵)
            </button>
            <button
              type="button"
              onClick={exportSurveyCSV}
              className="text-xs px-3 py-2 rounded-lg border-2 border-[color:var(--navy)] text-[color:var(--navy)] font-bold"
            >
              📄 CSV 다운로드
            </button>
            <button
              type="button"
              onClick={printReport}
              className="text-xs px-3 py-2 rounded-lg bg-[color:var(--mint-deep)] text-white font-bold"
            >
              🖨️ A4 인쇄용 리포트
            </button>
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed">
            · 검사 문항은 4영역(언어 민감성/공감/표현 바꾸기/실천 의지) 각 3문항, 그중 부정문항 3개는 역채점(6−v) 처리 후 평균됩니다.
            · 익명화 옵션을 켜면 이름 대신 S01·S02… 로 출력됩니다. 원본 응답은 학생 기기 localStorage 에만 저장됩니다.
          </p>
        </div>
      )}
    </section>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{label}</div>
      <div className="text-xl font-black text-[color:var(--navy)] mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
