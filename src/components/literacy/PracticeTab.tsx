import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  Target,
  MessageSquareHeart,
  Trophy,
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  Flame,
  Award,
} from "lucide-react";
import { getPracticeCoachFeedback } from "@/lib/practice-coach.functions";
import {
  GOAL_PRESETS,
  loadPractice,
  pickBadge,
  pickEncouragement,
  savePractice,
  todayIso,
  type PracticeBadge,
  type PracticeChallenge,
  type PracticePlan,
  type PracticeState,
} from "@/lib/practice-storage";

type Props = {
  studentKey: string;
  studentName?: string;
  onXP?: (delta: number, kind: string, note?: string) => void;
};

/**
 * STEP5. 실천하기 — "행동 계획 · 실천 코치 · 7일 챌린지" 흐름.
 * STEP3(공감하기)와 완전히 다른 목적: 학생 스스로 실천을 설계하고 지속한다.
 */
export function PracticeTab({ studentKey, studentName, onXP }: Props) {
  const coachFn = useServerFn(getPracticeCoachFeedback);

  const [state, setState] = useState<PracticeState>({});
  const [goal, setGoal] = useState<string>("");
  const [customGoal, setCustomGoal] = useState<string>("");
  const [promise, setPromise] = useState<string>("");
  const [coachLoading, setCoachLoading] = useState(false);
  const [encouragement] = useState(() => pickEncouragement());
  const initialLoadRef = useRef(false);

  // 학생 전환 시 저장된 계획 복원
  useEffect(() => {
    if (!studentKey) return;
    const s = loadPractice(studentKey);
    setState(s);
    if (s.plan) {
      const isPreset = GOAL_PRESETS.includes(s.plan.goal);
      setGoal(isPreset ? s.plan.goal : "__custom");
      setCustomGoal(isPreset ? "" : s.plan.goal);
      setPromise(s.plan.promise ?? "");
    } else {
      setGoal("");
      setCustomGoal("");
      setPromise("");
    }
    initialLoadRef.current = true;
  }, [studentKey]);

  const persist = useCallback(
    (next: PracticeState) => {
      setState(next);
      savePractice(studentKey, next);
    },
    [studentKey],
  );

  const resolvedGoal = goal === "__custom" ? customGoal.trim() : goal;
  const canRequestCoach = resolvedGoal.length > 0 && promise.trim().length > 0;

  const handleRequestCoach = useCallback(async () => {
    if (!canRequestCoach || coachLoading) return;
    setCoachLoading(true);
    try {
      const res = await coachFn({ data: { goal: resolvedGoal, promise: promise.trim() } });
      const badge = pickBadge(resolvedGoal, promise);
      const plan: PracticePlan = {
        goal: resolvedGoal,
        promise: promise.trim(),
        feedback: res.feedback,
        missions: res.missions,
        badge,
        updatedAt: new Date().toISOString(),
      };
      persist({ ...state, plan });
      toast.success("AI 실천 코치 피드백이 도착했어요!");
      onXP?.(10, "step5-plan", "실천 계획 등록");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI 응답을 받지 못했어요.";
      toast.error(msg);
    } finally {
      setCoachLoading(false);
    }
  }, [canRequestCoach, coachLoading, coachFn, resolvedGoal, promise, persist, state, onXP]);

  const startChallenge = useCallback(() => {
    if (state.challenge) return;
    const ch: PracticeChallenge = { startDate: todayIso(), days: Array(7).fill(false) };
    persist({ ...state, challenge: ch });
    toast.success("7일 실천 챌린지가 시작되었어요! 오늘부터 하나씩 체크해요.");
  }, [state, persist]);

  const toggleDay = useCallback(
    (i: number) => {
      if (!state.challenge) return;
      const days = [...state.challenge.days];
      const before = days[i];
      days[i] = !before;
      const nextCh = { ...state.challenge, days };
      const doneCount = days.filter(Boolean).length;
      const completedAt =
        doneCount === 7 && !state.completedAt ? new Date().toISOString() : state.completedAt;
      persist({ ...state, challenge: nextCh, completedAt });
      if (!before) onXP?.(4, "step5-day", `DAY${i + 1} 실천`);
      if (doneCount === 7 && !state.completedAt) {
        toast.success("🏆 7일 실천 완료! 바른말 수호자 Lv.1 획득!");
        onXP?.(30, "step5-complete", "7일 실천 완료");
      }
    },
    [state, persist, onXP],
  );

  const resetPlan = useCallback(() => {
    if (!confirm("실천 계획을 다시 작성할까요? 7일 챌린지 진행률은 유지됩니다.")) return;
    persist({ ...state, plan: undefined });
    setGoal("");
    setCustomGoal("");
    setPromise("");
  }, [state, persist]);

  return (
    <section className="space-y-5">
      <IntroHeader encouragement={encouragement} />

      <GoalSelector
        value={goal}
        customValue={customGoal}
        onChange={setGoal}
        onCustomChange={setCustomGoal}
      />

      <PromiseInput value={promise} onChange={setPromise} />

      <CoachSection
        loading={coachLoading}
        canRequest={canRequestCoach}
        onRequest={handleRequestCoach}
        plan={state.plan}
      />

      {state.plan && (
        <>
          <MissionSection
            missions={state.plan.missions ?? []}
            hasChallenge={!!state.challenge}
            onStart={startChallenge}
          />
          <PracticeCard plan={state.plan} studentName={studentName} onReset={resetPlan} />
          <ChallengeTracker challenge={state.challenge} onToggle={toggleDay} />
          <BadgeDisplay badge={state.plan.badge} />
        </>
      )}

      {state.completedAt && <CompletionSection />}
    </section>
  );
}

/* ─────────────── ① 안내/응원 ─────────────── */
function IntroHeader({ encouragement }: { encouragement: string }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-emerald-700">
        <Sparkles className="h-4 w-4" />
        <span className="text-xs font-bold tracking-wide">STEP 5 · 실천하기</span>
      </div>
      <h2 className="mt-1 text-lg font-black text-slate-800">
        오늘 배운 내용을 생활 속에서 실천해 보아요
      </h2>
      <p className="mt-1 text-sm text-slate-600 leading-relaxed">
        내가 앞으로 어떻게 행동할지 스스로 정하고, AI 실천 코치가 더 구체적으로 도와줄 거예요.
      </p>
      <div
        className="mt-3 rounded-xl bg-white/70 border border-white px-3 py-2 text-sm text-slate-700 italic"
        aria-label="오늘의 응원 문구"
      >
        💌 {encouragement}
      </div>
    </div>
  );
}

/* ─────────────── ② 목표 선택 ─────────────── */
function GoalSelector({
  value,
  customValue,
  onChange,
  onCustomChange,
}: {
  value: string;
  customValue: string;
  onChange: (v: string) => void;
  onCustomChange: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Target className="h-4 w-4" />} step="①" title="오늘의 실천 목표 선택" />
      <p className="mt-1 text-xs text-slate-500">한 가지를 선택하거나 직접 작성해 주세요.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {GOAL_PRESETS.map((g) => {
          const active = value === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => onChange(g)}
              aria-pressed={active}
              className={`text-left rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] ${
                active
                  ? "border-emerald-400 bg-emerald-50 text-emerald-900 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/50"
              }`}
            >
              <span className="mr-2" aria-hidden>
                {active ? "✅" : "⬜"}
              </span>
              {g}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange("__custom")}
          aria-pressed={value === "__custom"}
          className={`text-left rounded-xl border-2 border-dashed px-3 py-2.5 text-sm font-medium transition-all min-h-[44px] sm:col-span-2 ${
            value === "__custom"
              ? "border-emerald-400 bg-emerald-50 text-emerald-900"
              : "border-slate-300 bg-white text-slate-600 hover:border-emerald-300"
          }`}
        >
          <span className="mr-2" aria-hidden>
            ✏️
          </span>
          직접 작성하기
        </button>
      </div>
      {value === "__custom" && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value.slice(0, 60))}
          placeholder="예) 게임에서 져도 친구를 놀리지 않겠습니다."
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
          aria-label="직접 작성한 실천 목표"
          maxLength={60}
        />
      )}
    </div>
  );
}

/* ─────────────── ③ 실천 다짐 ─────────────── */
function PromiseInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle
        icon={<MessageSquareHeart className="h-4 w-4" />}
        step="②"
        title="나만의 실천 다짐"
      />
      <p className="mt-1 text-xs text-slate-500">
        어떤 상황에서 어떻게 행동할지 한 문장으로 적어보세요.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 100))}
        rows={3}
        maxLength={100}
        placeholder="예) 채팅방에서도 예쁜 말을 사용하겠습니다."
        className="mt-3 w-full resize-none rounded-xl border border-slate-300 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-400"
        aria-label="나만의 실천 다짐"
      />
      <div className="mt-1 flex justify-end text-[11px] text-slate-400" aria-live="polite">
        {value.length} / 100
      </div>
    </div>
  );
}

/* ─────────────── ④ AI 실천 코치 ─────────────── */
function CoachSection({
  loading,
  canRequest,
  onRequest,
  plan,
}: {
  loading: boolean;
  canRequest: boolean;
  onRequest: () => void;
  plan?: PracticePlan;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Sparkles className="h-4 w-4" />} step="③" title="AI 실천 코치" />
      <p className="mt-1 text-xs text-slate-500">
        AI 코치가 계획을 칭찬하고, 더 구체적인 방법을 알려주고, 응원할 거예요.
      </p>
      <button
        type="button"
        onClick={onRequest}
        disabled={!canRequest || loading}
        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        aria-label="AI 실천 코치에게 피드백 받기"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> 코치가 생각 중...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" /> AI에게 피드백 받기
          </>
        )}
      </button>
      {!canRequest && !plan && (
        <p className="mt-2 text-[11px] text-amber-600">
          목표와 다짐을 모두 입력하면 코치에게 요청할 수 있어요.
        </p>
      )}
      {plan?.feedback && (
        <div className="mt-4 rounded-xl bg-emerald-50/70 border border-emerald-100 p-3.5 text-sm text-slate-800 leading-relaxed whitespace-pre-line animate-fade-in">
          <div className="mb-1 text-[11px] font-bold text-emerald-700">🤖 실천 코치의 답변</div>
          {plan.feedback}
        </div>
      )}
    </div>
  );
}

/* ─────────────── ⑤ 오늘의 실천 미션 ─────────────── */
function MissionSection({
  missions,
  hasChallenge,
  onStart,
}: {
  missions: string[];
  hasChallenge: boolean;
  onStart: () => void;
}) {
  if (missions.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Flame className="h-4 w-4" />} step="④" title="오늘의 실천 미션" />
      <ul className="mt-3 space-y-2">
        {missions.map((m, i) => (
          <li
            key={i}
            className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-slate-800"
          >
            <span className="mt-0.5 text-amber-500" aria-hidden>
              ✔
            </span>
            <span>{m}</span>
          </li>
        ))}
      </ul>
      {!hasChallenge && (
        <button
          type="button"
          onClick={onStart}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600"
        >
          🚀 오늘 도전하기 (7일 챌린지 시작)
        </button>
      )}
    </div>
  );
}

/* ─────────────── ⑥ 실천 카드 ─────────────── */
function PracticeCard({
  plan,
  studentName,
  onReset,
}: {
  plan: PracticePlan;
  studentName?: string;
  onReset: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const date = useMemo(
    () =>
      new Date(plan.updatedAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [plan.updatedAt],
  );

  const handleSavePng = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const node = cardRef.current;
      const rect = node.getBoundingClientRect();
      // svg foreignObject 방식으로 브라우저 내장 기능만 사용
      const clone = node.cloneNode(true) as HTMLElement;
      clone.style.background = "#ffffff";
      const xml = new XMLSerializer().serializeToString(clone);
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
  <foreignObject width="100%" height="100%">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: system-ui, -apple-system, 'Malgun Gothic', sans-serif;">${xml}</div>
  </foreignObject>
</svg>`;
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas ctx");
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = `바른말_실천카드_${todayIso()}.png`;
      a.click();
      toast.success("실천카드를 이미지로 저장했어요!");
    } catch {
      toast.error("이미지 저장에 실패했어요. 대신 인쇄를 이용해 주세요.");
    }
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Award className="h-4 w-4" />} step="⑤" title="바른말 실천카드" />
      <div
        ref={cardRef}
        className="mt-3 rounded-2xl border-4 border-dashed border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 text-center"
        aria-label="바른말 실천카드"
      >
        <div className="text-3xl">🌱</div>
        <div className="mt-1 text-sm font-bold tracking-wide text-emerald-700">
          바른말 실천카드
        </div>
        <div className="mt-3 text-[11px] text-slate-500">오늘의 약속</div>
        <div className="mt-1 text-sm font-semibold text-slate-800 leading-relaxed">
          "{plan.goal}"
        </div>
        <div className="mt-3 text-[11px] text-slate-500">오늘의 다짐</div>
        <div className="mt-1 text-sm text-slate-800 leading-relaxed">"{plan.promise}"</div>
        <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <span>작성일 · {date}</span>
          {studentName && <span>· {studentName}</span>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSavePng}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
        >
          <Download className="h-3.5 w-3.5" /> PNG 저장
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" /> 인쇄하기
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> 다시 작성
        </button>
      </div>
    </div>
  );
}

/* ─────────────── ⑦ 7일 챌린지 ─────────────── */
function ChallengeTracker({
  challenge,
  onToggle,
}: {
  challenge?: PracticeChallenge;
  onToggle: (i: number) => void;
}) {
  const done = challenge ? challenge.days.filter(Boolean).length : 0;
  const pct = challenge ? (done / 7) * 100 : 0;
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Flame className="h-4 w-4" />} step="⑥" title="7일 실천 챌린지" />
      {!challenge ? (
        <p className="mt-2 text-xs text-slate-500">
          위 "오늘 도전하기" 버튼을 눌러 7일 챌린지를 시작해 보세요.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-7 gap-1.5">
            {challenge.days.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onToggle(i)}
                aria-pressed={d}
                aria-label={`DAY${i + 1} ${d ? "완료 취소" : "완료 표시"}`}
                className={`flex flex-col items-center justify-center rounded-xl border-2 py-2 text-[11px] font-bold transition-all min-h-[52px] ${
                  d
                    ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-500 hover:border-emerald-300"
                }`}
              >
                <span>DAY{i + 1}</span>
                <span className="text-base leading-none" aria-hidden>
                  {d ? "✓" : "·"}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={7}
              />
            </div>
            <div className="mt-1 text-right text-[11px] font-semibold text-slate-600">
              {done} / 7 완료
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────── ⑧ 배지 ─────────────── */
function BadgeDisplay({ badge }: { badge?: PracticeBadge }) {
  if (!badge) return null;
  return (
    <div className="rounded-2xl bg-white border border-border p-4 shadow-[var(--shadow-soft)]">
      <SectionTitle icon={<Award className="h-4 w-4" />} step="⑦" title="오늘의 배지" />
      <div className="mt-3 flex items-center gap-3 animate-scale-in">
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl text-3xl shadow-md ring-2 ring-white"
          style={{ background: `linear-gradient(135deg, ${badge.color}, ${badge.color}cc)` }}
          aria-hidden
        >
          {badge.emoji}
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
            자동 지급 배지
          </div>
          <div className="text-lg font-black text-slate-800">{badge.name}</div>
          <div className="text-xs text-slate-600">실천 목표에 어울리는 오늘의 칭호예요.</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── ⑨ 완료 화면 ─────────────── */
function CompletionSection() {
  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-5 text-center shadow-[var(--shadow-soft)] animate-scale-in">
      <Trophy className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
      <div className="mt-2 text-xs font-bold uppercase tracking-widest text-amber-700">
        7일 실천 완료
      </div>
      <div className="mt-1 text-xl font-black text-slate-800">🏆 바른말 수호자 Lv.1</div>
      <p className="mt-2 text-sm text-slate-600">
        축하합니다! 오늘도 바른말을 실천했어요. 이 다짐이 다음 학습으로 이어질 거예요.
      </p>
      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/70 border border-amber-200 px-3 py-1 text-[11px] font-semibold text-amber-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> 다음 학습을 이어가 봐요
      </div>
    </div>
  );
}

/* ─────────────── 공통 소요소 ─────────────── */
function SectionTitle({
  icon,
  step,
  title,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
        {icon}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-bold text-emerald-600">{step}</span>
        <h3 className="text-sm font-black text-slate-800">{title}</h3>
      </div>
    </div>
  );
}