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
    body: "☀️ 우리 반 언어 기상도: 학급 전체의 언어 유해 점수가 실시간 반영되어 날씨(맑음/흐림/비)가 바뀝니다. 예쁜 말을 써서 교실 날씨를 맑게 유지해 보아요!",
    tab: "dict",
  },
  {
    selector: "[data-tour='score-chip']",
    title: "2단계 · 종합 점수 표시",
    body: "🔴 종합 점수 표시: 우리 반에 등록된 신조어들의 평균 유해 수치와 이에 따른 최종 위험 등급이 한눈에 표시되는 지표입니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='literacy-chart']",
    title: "3단계 · 5대 리터러시 평가 그래프",
    body: "📊 학생들이 등록한 낱말들을 5대 영역으로 다각도 분석하여 우리 반 언어생활의 취약점을 시각적으로 보여줍니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='gauge-aggression']",
    title: "4단계 · 공격성 & 따돌림 게이지",
    body: "🛡️ 친구를 향한 공격적인 유행어나 소외를 유도하는 밈의 위험도를 1.0~5.0점 척도로 세밀하게 추적합니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='gauge-hate']",
    title: "5단계 · 혐오·폭력·문법파괴 게이지",
    body: "✍️ 무분별한 혐오 표현, 언어폭력 및 심각한 신조어의 어원 파괴 현상을 0.5 단위로 정밀 분석합니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='dict-search']",
    title: "6단계 · 낱말 검색 & 초성 필터",
    body: "🔤 찾고 싶은 신조어를 직접 검색하거나 자음(ㄱ, ㄴ, ㄷ...) 단추로 원하는 단어를 빛의 속도로 찾아낼 수 있습니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='dict-filter-tabs']",
    title: "7단계 · 카테고리 필터 탭",
    body: "🔍 상단의 '전체·안전·순화 필요·위험' 탭을 터치하면, 해당 등급에 맞는 단어들만 오차 없이 깨끗하게 분류되어 표시됩니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='dict-grid']",
    title: "8단계 · 바른말 사전 카드",
    body: "📖 신조어의 진짜 뜻, 유해 점수, 그리고 초등 눈높이에 맞춘 '바른 대안 표현'이 카드에 보기 쉽게 정리되어 있습니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='dict-votes']",
    title: "9단계 · 실천 공감 인터랙션",
    body: "👍 카드 하단의 '바른말 최고야·덕분에 배웠어·실천을 응원해' 버튼을 눌러 친구들의 바른 언어 실천을 학급 전체가 격려할 수 있습니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='area-badges']",
    title: "10단계 · 영역별 다중 칭호",
    body: "🏅 친구 이름 옆에는 5대 유해성 영역을 훌륭하게 절제하여 획득한 최고 등급 칭호 뱃지들이 실시간으로 나타납니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='reflection-log']",
    title: "11단계 · 실시간 성찰 타임라인",
    body: "⏰ 학생들이 퀴즈를 풀거나 단어를 등록하며 스스로 성찰한 기록이 타임라인 로그로 투명하게 누적됩니다.",
    tab: "dict",
  },
  {
    selector: "[data-tour='quiz']",
    title: "12단계 · 도전! 스피드 퀴즈",
    body: "🎮 50문항 마스터 풀에서 10문제가 매번 랜덤 추출되며, 4지선다 보기 순서까지 무작위로 뒤섞여 출제됩니다.",
    tab: "quiz",
  },
  {
    selector: "[data-tour='admin-csv']",
    title: "13단계 · 교사 관리자 메뉴",
    body: "⚙️ 5대 영역 점수가 담긴 사전 데이터를 엑셀(CSV)로 일괄 내보내기/가져오기 하고, 시드로 초기화하여 깨끗한 연구 환경으로 리셋할 수 있습니다.",
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
  let bubbleLeft = Math.min(Math.max(12, r.left + r.width / 2 - bubbleW / 2), vp.w - bubbleW - 12);
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
              <rect x={holeLeft} y={holeTop} width={holeW} height={holeH} rx={16} fill="black" />
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
        <div className="text-base font-black text-[color:var(--navy)] mb-1">{cur.title}</div>
        <p className="text-sm text-[color:var(--navy)] leading-relaxed mb-3">{cur.body}</p>
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
