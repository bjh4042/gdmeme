import { useEffect, useLayoutEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";

export const TUTORIAL_STORAGE_KEY = "visited_tutorial";

export type TutorialStep = {
  selector: string; // querySelector target
  title: string;
  body: string;
  tab?: "analyze" | "chat" | "assist" | "quiz" | "dict";
  openTeacher?: boolean;
};

const STEPS: TutorialStep[] = [
  {
    selector: "[data-tour='weather']",
    title: "1단계 · 우리 반 언어 기상도",
    body: "☀️ 우리 반 언어 기상도입니다. 학급 전체의 평균 유해 점수에 따라 실시간으로 날씨가 변해요!",
    tab: "dict",
  },
  {
    selector: "[data-tour='literacy-chart']",
    title: "2단계 · 5대 리터러시 차트",
    body: "📊 공격성, 따돌림, 혐오성, 폭력성, 문법파괴 등 5개 세부 영역의 5.0점 만점(0.5 단위) 실시간 통계 그래프를 보여줍니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='dict-grid']",
    title: "3단계 · 바른말 사전 그리드",
    body: "📖 학생들이 등록한 신조어 카드입니다. 카테고리 탭(전체/안전/순화 필요/위험)을 누르면 정확하게 필터링되어 나타납니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='quiz']",
    title: "4단계 · 스피드 퀴즈",
    body: "🎮 50문항 중 랜덤으로 10문제가 출제되는 4지선다 퀴즈입니다. 보기도 매번 무작위로 섞여 재미있게 학습할 수 있습니다.",
    tab: "quiz",
  },
  {
    selector: "[data-tour='admin-csv']",
    title: "5단계 · 관리자 엑셀 입출력",
    body: "⚙️ [엑셀 다운로드/업로드] 버튼입니다. 5대 세부 점수가 포함된 사전 데이터를 엑셀로 일괄 수정하고 초기화할 수 있습니다.",
    openTeacher: true,
  },
];

type Rect = { top: number; left: number; width: number; height: number };
const FALLBACK_RECT: Rect = { top: 120, left: 40, width: 320, height: 120 };

export function Tutorial({
  open,
  onClose,
  onTabChange,
  onOpenTeacher,
}: {
  open: boolean;
  onClose: () => void;
  onTabChange: (tab: "analyze" | "chat" | "assist" | "quiz" | "dict") => void;
  onOpenTeacher: () => void;
}) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 1024, h: 768 });

  const cur = STEPS[step];

  // 스텝 전환 시 탭/관리자 화면 스위치.
  useEffect(() => {
    if (!open) return;
    if (cur.tab) onTabChange(cur.tab);
    if (cur.openTeacher) onOpenTeacher();
  }, [open, step, cur.tab, cur.openTeacher, onTabChange, onOpenTeacher]);

  const measure = useCallback(() => {
    if (typeof window === "undefined") return;
    setVp({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(cur.selector) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [cur.selector]);

  useLayoutEffect(() => {
    if (!open) return;
    // 탭 변경/모달 오픈 후 DOM 렌더 대기.
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 260);
    const t3 = setTimeout(measure, 600);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [open, step, measure]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, measure]);

  if (!open || typeof document === "undefined") return null;

  const r = rect ?? FALLBACK_RECT;
  const pad = 8;
  const holeTop = r.top - pad;
  const holeLeft = r.left - pad;
  const holeW = r.width + pad * 2;
  const holeH = r.height + pad * 2;

  // 말풍선 배치: 하단 공간 우선, 부족하면 상단.
  const bubbleW = Math.min(360, vp.w - 24);
  const bubbleH = 220;
  const showBelow = holeTop + holeH + bubbleH + 24 < vp.h;
  let bubbleTop = showBelow ? holeTop + holeH + 12 : Math.max(12, holeTop - bubbleH - 12);
  let bubbleLeft = Math.min(
    Math.max(12, r.left + r.width / 2 - bubbleW / 2),
    vp.w - bubbleW - 12,
  );
  if (!rect) {
    bubbleTop = Math.max(24, vp.h / 2 - bubbleH / 2);
    bubbleLeft = Math.max(12, vp.w / 2 - bubbleW / 2);
  }

  const finish = () => {
    try {
      window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    } catch {}
    onClose();
  };
  const skip = finish;
  const next = () => {
    if (step >= STEPS.length - 1) finish();
    else setStep((s) => s + 1);
  };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  const node = (
    <div
      className="fixed inset-0 z-[200]"
      role="dialog"
      aria-modal="true"
      aria-label="바른말 수호대 사용 가이드"
    >
      {/* SVG 마스크로 4방향 어두운 오버레이 + 하이라이트 창 */}
      <svg
        width={vp.w}
        height={vp.h}
        className="absolute inset-0 pointer-events-auto"
        onClick={skip}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width={vp.w} height={vp.h} fill="white" />
            {rect && (
              <rect
                x={holeLeft}
                y={holeTop}
                width={holeW}
                height={holeH}
                rx={16}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={vp.w}
          height={vp.h}
          fill="rgba(2, 6, 23, 0.82)"
          mask="url(#tour-mask)"
        />
        {rect && (
          <rect
            x={holeLeft}
            y={holeTop}
            width={holeW}
            height={holeH}
            rx={16}
            fill="none"
            stroke="#f8fafc"
            strokeWidth={3}
            style={{ filter: "drop-shadow(0 0 12px rgba(56,189,248,0.9))" }}
          />
        )}
      </svg>

      <div
        className="absolute rounded-2xl bg-white shadow-2xl border border-white/60 p-4"
        style={{ top: bubbleTop, left: bubbleLeft, width: bubbleW }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] font-mono font-bold text-[color:var(--mint-deep)]">
            {step + 1} / {STEPS.length}
          </div>
          <button
            type="button"
            onClick={skip}
            className="text-xs font-bold text-muted-foreground hover:text-[color:var(--navy)]"
          >
            건너뛰기 ✕
          </button>
        </div>
        <div className="text-base font-black text-[color:var(--navy)] mb-1">
          {cur.title}
        </div>
        <p className="text-sm text-[color:var(--navy)] leading-relaxed mb-3">
          {cur.body}
        </p>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-[color:var(--muted)] text-[color:var(--navy)] disabled:opacity-40"
          >
            ← 이전
          </button>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === step ? "bg-[color:var(--mint-deep)]" : "bg-[color:var(--muted)]"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="px-3 py-2 rounded-xl text-xs font-black bg-[color:var(--navy)] text-white"
          >
            {step >= STEPS.length - 1 ? "완료 🎉" : "다음 →"}
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(node, document.body);
}