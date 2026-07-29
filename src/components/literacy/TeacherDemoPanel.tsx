// 연구 시연용 예시 데이터 관리 패널 (barunmal_demo_v1).
// 표시되는 모든 수치는 실제 저장된 시연 레코드에서 계산된 값이다.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  DEMO_LABEL,
  DEMO_NAMESPACE,
  DEMO_STUDENT_COUNT,
  DEMO_VERSION,
  applyDemoData,
  clearDemoData,
  getDemoDataset,
  getDemoMeta,
  isDemoModeAvailable,
  summarizeDemo,
  type DemoDataset,
  type DemoSummary,
} from "@/lib/demo";

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function TeacherDemoPanel() {
  const [available, setAvailable] = useState(false);
  const [dataset, setDataset] = useState<DemoDataset | null>(null);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [appliedAt, setAppliedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const meta = getDemoMeta();
    const data = getDemoDataset();
    setAppliedAt(meta?.appliedAt ?? null);
    setDataset(data);
    setSummary(data ? summarizeDemo(data) : null);
  }, []);

  useEffect(() => {
    setAvailable(isDemoModeAvailable());
    refresh();
  }, [refresh]);

  if (!available) return null;

  const onApply = () => {
    const data = applyDemoData();
    refresh();
    toast.success(`${DEMO_LABEL}가 적용되었습니다.`, {
      description: `학생 ${data.students.length}명 · 활동 ${data.activities.length}건 · ${DEMO_NAMESPACE}`,
    });
  };

  const onClear = () => {
    if (!confirm(`${DEMO_LABEL}를 모두 제거할까요?\n\n실제 학생 활동 기록은 삭제되지 않습니다.`))
      return;
    const ok = clearDemoData();
    refresh();
    if (ok) toast.success(`${DEMO_LABEL}를 제거했습니다.`);
    else toast.info("적용된 시연 데이터가 없습니다.");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-bold">
          {DEMO_LABEL}
        </span>
        <span className="text-xs">
          연구 시연 목적의 가상 학생 {DEMO_STUDENT_COUNT}명 데이터입니다. 실제 학생 정보가 아닙니다.
        </span>
        <span className="ml-auto text-[11px] font-mono opacity-70">
          {DEMO_NAMESPACE} · v{DEMO_VERSION}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          {appliedAt ? "시연 데이터 다시 생성" : "시연 데이터 불러오기"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold"
        >
          시연 데이터 제거
        </button>
        <span className="text-xs text-muted-foreground">
          {appliedAt
            ? `적용됨 · ${new Date(appliedAt).toLocaleString("ko-KR")}`
            : "아직 적용되지 않았습니다."}
        </span>
      </div>

      {dataset && summary ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="시연 학생" value={`${summary.studentCount}명`} />
            <Stat
              label="누적 활동"
              value={`${summary.activityCount}건`}
              hint={`1인 평균 ${summary.avgActivitiesPerStudent}건`}
            />
            <Stat
              label="온라인 상황 비중"
              value={`${Math.round(summary.onlineRatio * 100)}%`}
              hint="채팅·댓글·게임"
            />
            <Stat label="평균 숙달도" value={summary.masteryAvg} hint="0-100" />
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-muted-foreground">단계별 활동</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {summary.stages.map((s) => (
                <Stat
                  key={s.key}
                  label={s.label}
                  value={`${s.activities}건`}
                  hint={`${s.students}명 참여`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-xs font-semibold">7일 챌린지</div>
              <div className="text-sm">
                참여 {summary.challenge.participants}명 · 완주 {summary.challenge.completed}명 ·
                중단 {summary.challenge.stopped}명
              </div>
              <div className="text-xs text-muted-foreground">
                평균 실천일 {summary.challenge.avgDoneDays}일
              </div>
              <div className="mt-2 flex gap-1">
                {summary.challenge.dayCompletion.map((n, i) => (
                  <div key={i} className="flex-1 text-center">
                    <div
                      className="mx-auto w-full rounded bg-primary/20"
                      style={{
                        height: `${8 + (n / Math.max(1, summary.studentCount)) * 32}px`,
                      }}
                    />
                    <div className="text-[10px] text-muted-foreground">{i + 1}일</div>
                    <div className="text-[10px] tabular-nums">{n}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-xs font-semibold">AI 수호비서 대화</div>
              <div className="text-sm">
                {summary.assistant.turns}턴 · {summary.assistant.students}명 사용
              </div>
              <div className="text-xs text-muted-foreground">
                해결 {summary.assistant.resolved}턴 · 대체 표현 채택{" "}
                {summary.assistant.adoptedAlternatives}회 · 평균 힌트 단계{" "}
                {summary.assistant.avgHintLevel}
              </div>
              <div className="mt-2 text-xs">
                사전 등재 {summary.dict.total}건 (승인 {summary.dict.approved} · 대기{" "}
                {summary.dict.pending})
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-xs font-semibold">많이 다룬 표현 유형</div>
              <ul className="space-y-1 text-xs">
                {summary.topCategories.map((c) => (
                  <li key={c.category} className="flex justify-between">
                    <span className="font-mono">{c.category}</span>
                    <span className="tabular-nums">{c.count}회</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-xs font-semibold">자주 나타난 오개념</div>
              <ul className="space-y-1 text-xs">
                {summary.topMisconceptions.length ? (
                  summary.topMisconceptions.map((m) => (
                    <li key={m.text} className="flex justify-between gap-2">
                      <span>{m.text}</span>
                      <span className="tabular-nums">{m.count}회</span>
                    </li>
                  ))
                ) : (
                  <li className="text-muted-foreground">기록된 오개념이 없습니다.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5">학생</th>
                  <th className="px-2 py-1.5">참여</th>
                  <th className="px-2 py-1.5">최고 단계</th>
                  <th className="px-2 py-1.5">숙달도</th>
                  <th className="px-2 py-1.5">추세</th>
                  <th className="px-2 py-1.5">지도 메모</th>
                </tr>
              </thead>
              <tbody>
                {dataset.profiles.map((p) => (
                  <tr key={p.studentId} className="border-t border-border">
                    <td className="px-2 py-1.5 font-semibold">{p.displayName}</td>
                    <td className="px-2 py-1.5">{p.participation}</td>
                    <td className="px-2 py-1.5">{p.highestStage}</td>
                    <td className="px-2 py-1.5 tabular-nums">{p.mastery}</td>
                    <td className="px-2 py-1.5">{p.trend}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{p.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}