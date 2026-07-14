import { useEffect, useState } from "react";
import type { DictEntry } from "@/lib/literacy-types";
import { STAGES, deriveRoadmap, type StageKey } from "@/lib/roadmap";
import { useEngagementStore } from "@/stores/engagement";
import { toast } from "sonner";
import { REFLECTION_AFTER_SAVE } from "@/lib/reflection-prompts";

/**
 * 학생 대시보드 상단 「바른말 수호 5단계」 로드맵 카드.
 * - 완료/현재/잠금 시각화 (색상+아이콘+체크로 색맹 접근성 대응)
 * - 단계 클릭 시 관련 탭으로 이동
 * - 5단계 모두 완료 시 축하 오버레이(1회만)
 * - "오늘의 실천 체크" 인라인 버튼 → engagement.logPractice 로 practice 단계 완료
 */
export function RoadmapCard({
  studentId,
  classCode,
  dict,
  onStageJump,
}: {
  studentId: string;
  classCode: string;
  dict: DictEntry[];
  onStageJump?: (tab: "analyze" | "chat" | "assist" | "quiz" | "dict") => void;
}) {
  const engagement = useEngagementStore((s) => s.byStudent[studentId]);
  const logPractice = useEngagementStore((s) => s.logPractice);
  const rm = deriveRoadmap({ studentId, classCode, engagement, dict });
  const [celebrated, setCelebrated] = useState(false);
  const [showCelebrate, setShowCelebrate] = useState(false);

  useEffect(() => {
    if (!rm.allDone || celebrated) return;
    const key = `wtmeme:roadmap:done:${studentId}`;
    try {
      if (window.localStorage.getItem(key) === "true") {
        setCelebrated(true);
        return;
      }
      window.localStorage.setItem(key, "true");
    } catch {}
    setCelebrated(true);
    setShowCelebrate(true);
    const t = setTimeout(() => setShowCelebrate(false), 5000);
    return () => clearTimeout(t);
  }, [rm.allDone, celebrated, studentId]);

  function handleClickStage(key: StageKey) {
    const meta = STAGES.find((s) => s.key === key);
    if (!meta || !onStageJump) return;
    onStageJump(meta.tabHint);
  }

  function handlePracticeCheck() {
    const res = logPractice(studentId, "오늘의 바른말 실천 체크");
    if (res.already) toast("오늘은 이미 실천 체크를 남겼어요. 내일 또 만나요!", { icon: "🌱" });
    else if (res.ok)
      toast.success("실천 체크 완료! 5단계 실천하기가 채워졌어요.", {
        description: `누적 ${res.total}회 · ${REFLECTION_AFTER_SAVE}`,
      });
  }

  return (
    <section
      aria-label="바른말 수호 5단계 학습 로드맵"
      className="rounded-3xl border-2 border-[color:var(--navy)]/10 bg-white/80 backdrop-blur p-4 sm:p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[color:var(--mint-deep)] uppercase tracking-wider">
            바른말 수호 5단계
          </div>
          <h3 className="text-lg sm:text-xl font-black text-[color:var(--navy)]">
            🛡️ 나의 수호 임무 로드맵
          </h3>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
            발견 → 파헤치기 → 공감 → 바꾸기 → 실천. 순서대로 도전하면 우리 반 언어가 맑아져요.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-muted-foreground">완료</div>
          <div className="text-lg font-black text-[color:var(--navy)]">
            {rm.completedCount} <span className="text-sm text-muted-foreground">/ {rm.totalCount}</span>
          </div>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5 sm:gap-3" role="list">
        {rm.stages.map((st, idx) => {
          const meta = STAGES[idx];
          const isCurrent = idx === rm.currentIndex && !st.done;
          return (
            <li key={st.key}>
              <button
                type="button"
                onClick={() => handleClickStage(st.key)}
                aria-label={`${meta.order}단계 ${meta.title}. ${st.done ? "완료" : isCurrent ? "진행 중" : "잠금"}. ${st.detail}`}
                aria-current={isCurrent ? "step" : undefined}
                className={`w-full text-left rounded-2xl border-2 p-3 transition min-h-[92px] flex flex-col gap-1 hover:-translate-y-0.5 hover:shadow ${
                  st.done
                    ? "bg-emerald-50 border-emerald-300"
                    : isCurrent
                      ? `${meta.color} ring-2 ring-[color:var(--navy)]/40`
                      : "bg-slate-50 border-slate-200 opacity-80"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-slate-500">STEP {meta.order}</span>
                  {st.done && (
                    <span aria-hidden className="text-[10px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-1.5 py-0.5">
                      ✓ 완료
                    </span>
                  )}
                  {isCurrent && (
                    <span aria-hidden className="text-[10px] font-black text-[color:var(--navy)] bg-white/70 border border-[color:var(--navy)]/30 rounded-full px-1.5 py-0.5">
                      진행 중
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl leading-none" aria-hidden>{meta.icon}</span>
                  <span className="font-black text-sm text-[color:var(--navy)]">{meta.title}</span>
                </div>
                <div className="text-[11px] leading-snug text-slate-700 line-clamp-2">{st.detail}</div>
                <div className="mt-auto h-1.5 rounded-full bg-white/70 overflow-hidden">
                  <div
                    className={`h-full ${st.done ? "bg-emerald-500" : "bg-[color:var(--navy)]/70"}`}
                    style={{ width: `${Math.round(st.progress * 100)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="text-slate-600">
          💡 지금 도전: <b>{STAGES[rm.currentIndex]?.title ?? "완료"}</b> — {STAGES[rm.currentIndex]?.hint ?? "5단계 모두 완료했어요!"}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={handlePracticeCheck}
            className="rounded-full bg-emerald-500 text-white font-bold px-3 py-1.5 hover:bg-emerald-600 transition"
          >
            🌱 오늘의 실천 체크
          </button>
        </div>
      </div>

      {showCelebrate && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          role="dialog"
          aria-modal="true"
          aria-label="바른말 수호 임무 완료"
          onClick={() => setShowCelebrate(false)}
        >
          <div className="max-w-sm w-full rounded-3xl bg-white p-6 text-center shadow-2xl border-2 border-emerald-300 animate-scale-in">
            <div className="text-6xl mb-3" aria-hidden>🎉🛡️</div>
            <div className="text-xs font-bold text-emerald-700 uppercase mb-1">MISSION COMPLETE</div>
            <h4 className="text-xl font-black text-[color:var(--navy)] mb-2">바른말 수호 임무 완료!</h4>
            <p className="text-sm text-slate-600 mb-4">
              5단계를 모두 성공했어요. 오늘도 우리 반 언어를 지켜줘서 고마워요.
              내일은 더 많은 친구를 도와줄 수 있을 거예요.
            </p>
            <button
              type="button"
              onClick={() => setShowCelebrate(false)}
              className="rounded-xl bg-[color:var(--navy)] text-[color:var(--navy-foreground)] font-black px-4 py-2 text-sm"
            >
              계속하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 각 활동 탭 상단에 얇게 두르는 「지금은 N단계」 칩. */
export function StageChip({ stage }: { stage: StageKey }) {
  const meta = STAGES.find((s) => s.key === stage);
  if (!meta) return null;
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.color}`}
      role="note"
      aria-label={`현재 학습 단계: ${meta.order}단계 ${meta.title}`}
    >
      <span aria-hidden>{meta.icon}</span>
      <span>STEP {meta.order} · {meta.title}</span>
    </div>
  );
}