import { useEffect, useState } from "react";
import { Search, Compass, Heart, Pencil, Sprout, Check, Lock, type LucideIcon } from "lucide-react";
import type { DictEntry } from "@/lib/literacy-types";
import { STAGES, deriveRoadmap, type StageKey } from "@/lib/roadmap";
import { useEngagementStore } from "@/stores/engagement";
import { toast } from "sonner";
import { REFLECTION_AFTER_SAVE } from "@/lib/reflection-prompts";

// 시안 컬러 팔레트 · 단계별 원형 아이콘/보더/글로우 톤을 한 곳에서 관리.
const STAGE_STYLE: Record<
  StageKey,
  {
    icon: LucideIcon;
    ring: string; // 현재 단계 accent ring
    bg: string; // 원형 배경 (미완료)
    fg: string; // 원형 아이콘 색
    doneBg: string; // 완료 원형 배경
    line: string; // 오른쪽 연결선 (완료 이후 색)
    label: string; // 단계명 색
    glow: string; // 현재 단계 glow shadow
  }
> = {
  discover: {
    icon: Search,
    ring: "ring-sky-300",
    bg: "bg-sky-50 border-sky-200",
    fg: "text-sky-600",
    doneBg: "bg-sky-100 border-sky-400",
    line: "border-sky-300",
    label: "text-sky-700",
    glow: "shadow-[0_0_0_6px_rgba(56,189,248,0.18)]",
  },
  dissect: {
    icon: Compass,
    ring: "ring-emerald-300",
    bg: "bg-emerald-50 border-emerald-200",
    fg: "text-emerald-600",
    doneBg: "bg-emerald-100 border-emerald-400",
    line: "border-emerald-300",
    label: "text-emerald-700",
    glow: "shadow-[0_0_0_6px_rgba(16,185,129,0.18)]",
  },
  empathize: {
    icon: Heart,
    ring: "ring-rose-300",
    bg: "bg-rose-50 border-rose-200",
    fg: "text-rose-500",
    doneBg: "bg-rose-100 border-rose-400",
    line: "border-rose-300",
    label: "text-rose-600",
    glow: "shadow-[0_0_0_6px_rgba(244,114,182,0.22)]",
  },
  rewrite: {
    icon: Pencil,
    ring: "ring-amber-300",
    bg: "bg-amber-50 border-amber-200",
    fg: "text-amber-600",
    doneBg: "bg-amber-100 border-amber-400",
    line: "border-amber-300",
    label: "text-amber-700",
    glow: "shadow-[0_0_0_6px_rgba(251,191,36,0.22)]",
  },
  practice: {
    icon: Sprout,
    ring: "ring-violet-300",
    bg: "bg-violet-50 border-violet-200",
    fg: "text-violet-600",
    doneBg: "bg-violet-100 border-violet-400",
    line: "border-violet-300",
    label: "text-violet-700",
    glow: "shadow-[0_0_0_6px_rgba(139,92,246,0.22)]",
  },
};

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
    } catch {
      /* storage/parse 실패 무시 */
    }
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
            {rm.completedCount}{" "}
            <span className="text-sm text-muted-foreground">/ {rm.totalCount}</span>
          </div>
        </div>
      </div>

      <ol className="grid gap-3 sm:gap-2 sm:grid-cols-5" role="list">
        {rm.stages.map((st, idx) => {
          const meta = STAGES[idx];
          const style = STAGE_STYLE[st.key];
          const Icon = style.icon;
          const isCurrent = idx === rm.currentIndex && !st.done;
          const isLocked = !st.done && !isCurrent;
          const nextDone = rm.stages[idx + 1]?.done ?? false;
          const showConnectorActive = st.done && (nextDone || idx + 1 === rm.currentIndex);
          return (
            <li key={st.key} className="relative">
              <button
                type="button"
                onClick={() => handleClickStage(st.key)}
                aria-label={`${meta.order}단계 ${meta.title}. ${st.done ? "완료" : isCurrent ? "진행 중" : "잠금"}. ${st.detail}`}
                aria-current={isCurrent ? "step" : undefined}
                className="group w-full flex flex-col items-center text-center px-1 pt-2 pb-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--navy)]/40"
              >
                {/* 원형 아이콘 */}
                <div className="relative">
                  {/* 연결선 (오른쪽) — 마지막 아이템 제외, sm 이상에서만 */}
                  {idx < rm.stages.length - 1 && (
                    <span
                      aria-hidden
                      className={`hidden sm:block absolute top-1/2 left-full h-0 w-[calc(100%+0.5rem)] border-t-2 border-dashed -translate-y-1/2 ${
                        showConnectorActive ? style.line : "border-slate-200"
                      }`}
                    />
                  )}
                  <div
                    className={`relative h-14 w-14 rounded-full border-2 grid place-items-center transition-all duration-200 group-hover:scale-105 ${
                      st.done
                        ? `${style.doneBg} ${style.fg}`
                        : isCurrent
                          ? `bg-white ${style.fg} border-current ring-4 ${style.ring} ${style.glow}`
                          : "bg-slate-50 border-slate-200 text-slate-300"
                    }`}
                  >
                    <Icon className="h-6 w-6" strokeWidth={isCurrent ? 2.4 : 2} aria-hidden />
                    {st.done && (
                      <span
                        aria-hidden
                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center shadow"
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    {isLocked && (
                      <span
                        aria-hidden
                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-slate-200 text-slate-500 grid place-items-center"
                      >
                        <Lock className="h-3 w-3" strokeWidth={2.5} />
                      </span>
                    )}
                  </div>
                </div>

                {/* 단계명 */}
                <div
                  className={`mt-3 text-sm font-black ${
                    st.done ? style.label : isCurrent ? style.label : "text-slate-400"
                  }`}
                >
                  {meta.title}
                </div>

                {/* 한 줄 설명 */}
                <div className="mt-1 text-[11px] leading-snug text-slate-600 min-h-[2.6em] px-1">
                  {meta.oneLiner}
                </div>

                {/* 진행 상태 라벨 */}
                <div
                  className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${
                    st.done ? "text-emerald-600" : isCurrent ? style.label : "text-slate-400"
                  }`}
                >
                  {st.done ? "완료" : isCurrent ? "진행 중" : "잠금"}
                </div>

                {/* Progress */}
                <div className="mt-1.5 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      st.done ? "bg-emerald-500" : isCurrent ? "bg-current" : "bg-slate-300"
                    } ${isCurrent ? style.fg : ""}`}
                    style={{ width: `${Math.round(st.progress * 100)}%` }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {/* 전체 진행률 */}
      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-black text-rose-600">
          현재 단계
          <span className="text-slate-700">
            {rm.allDone ? "완료" : `${STAGES[rm.currentIndex]?.title} 단계에요!`}
          </span>
        </span>
        <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-rose-400 to-violet-500 transition-all duration-500"
            style={{
              width: `${Math.round((rm.completedCount / rm.totalCount) * 100)}%`,
            }}
          />
        </div>
        <span className="shrink-0 text-sm font-black text-[color:var(--navy)]">
          {Math.round((rm.completedCount / rm.totalCount) * 100)}%
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="text-slate-600">
          💡 지금 도전: <b>{STAGES[rm.currentIndex]?.title ?? "완료"}</b> —{" "}
          {STAGES[rm.currentIndex]?.hint ?? "5단계 모두 완료했어요!"}
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
            <div className="text-6xl mb-3" aria-hidden>
              🎉🛡️
            </div>
            <div className="text-xs font-bold text-emerald-700 uppercase mb-1">
              MISSION COMPLETE
            </div>
            <h4 className="text-xl font-black text-[color:var(--navy)] mb-2">
              바른말 수호 임무 완료!
            </h4>
            <p className="text-sm text-slate-600 mb-4">
              5단계를 모두 성공했어요. 오늘도 우리 반 언어를 지켜줘서 고마워요. 내일은 더 많은
              친구를 도와줄 수 있을 거예요.
            </p>
            <button
              type="button"
              onClick={() => setShowCelebrate(false)}
              className="rounded-xl bg-primary text-primary-foreground font-black px-4 py-2 text-sm"
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
      <span>
        STEP {meta.order} · {meta.title}
      </span>
    </div>
  );
}
