import { useMemo } from "react";
import type { DictEntry, StudentRecord } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import { computeInsights } from "@/lib/teacher-insights";

/**
 * 교사 대시보드 상단 「교육적 요약」 섹션.
 * 규칙 기반 파생 값만 표시하고, 데이터가 없으면 안내 문구를 보여준다.
 */
export function TeacherEducationalSummary({
  students,
  currentClassCode,
  dict,
}: {
  students: StudentRecord[];
  currentClassCode: string;
  dict: DictEntry[];
}) {
  const byStudent = useEngagementStore((s) => s.byStudent);
  const insights = useMemo(
    () => computeInsights({ students, byStudent, dict, classCode: currentClassCode || undefined }),
    [students, byStudent, dict, currentClassCode],
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <section className="mb-4 rounded-2xl border-2 border-[color:var(--mint-deep)]/30 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="text-base sm:text-lg font-black text-[color:var(--navy)]">
          📘 이번 주 교실 요약 <span className="text-xs text-slate-500 font-bold">({currentClassCode || "전체"})</span>
        </h4>
        <span className="text-[10px] text-slate-500">규칙 기반 · 실제 저장된 활동만 반영</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Card label="등록 학생" value={`${insights.totalStudents}명`} />
        <Card label="성찰 참여율" value={pct(insights.reflectionRate)} />
        <Card label="실천 체크율" value={pct(insights.practiceRate)} />
        <Card label="승인 대기" value={`${insights.pendingProposals}건`} />
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-xs">
        <Panel title="최근 활동 학생 Top 5">
          {insights.activeStudents.length === 0 ? (
            <Empty />
          ) : (
            <ol className="space-y-1">
              {insights.activeStudents.map((a, i) => (
                <li key={a.student.id} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {a.student.name}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">
                    제안{a.proposals}·성찰{a.reflections}·실천{a.practices}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="많이 공감받은 표현 Top 5">
          {insights.topWords.length === 0 ? <Empty /> : (
            <ol className="space-y-1">
              {insights.topWords.map((w, i) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {w.word}</span>
                  <span className="text-slate-500 tabular-nums shrink-0">👍 {w.vote_count ?? 0}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="위험 등급 표현 (70점↑)">
          {insights.dangerWords.length === 0 ? <Empty /> : (
            <ol className="space-y-1">
              {insights.dangerWords.map((w, i) => (
                <li key={w.id} className="flex justify-between gap-2">
                  <span className="truncate">{i + 1}. {w.word}</span>
                  <span className="text-red-600 font-bold tabular-nums shrink-0">{w.total_harmful_score}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <ul className="mt-3 space-y-1">
        {insights.guidance.map((g, i) => (
          <li key={i} className="text-[12px] text-slate-700 leading-snug">💡 {g}</li>
        ))}
      </ul>
    </section>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[color:var(--muted)]/40 p-2.5">
      <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">{label}</div>
      <div className="text-lg font-black text-[color:var(--navy)]">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 min-w-0">
      <div className="text-[10px] font-bold uppercase text-[color:var(--mint-deep)] tracking-wider mb-1.5">{title}</div>
      {children}
    </div>
  );
}
function Empty() {
  return <div className="text-slate-400 text-[11px]">아직 기록된 활동이 없습니다.</div>;
}
