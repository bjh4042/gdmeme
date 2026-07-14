import {
  Home,
  Search,
  BookOpen,
  Heart,
  Pencil,
  Sprout,
  Award,
  LogOut,
  Check,
  type LucideIcon,
} from "lucide-react";
import logoAsset from "@/assets/logo-v2.webp.asset.json";
import type { StageKey } from "@/lib/roadmap";

export type SidebarKey =
  | "home"
  | "step1"
  | "step2"
  | "step3"
  | "step4"
  | "step5"
  | "badges"
  // legacy keys kept for type-compat with older callers
  | "analyze"
  | "dict"
  | "quiz"
  | "reflect"
  | "roadmap";

type StepItem = {
  key: SidebarKey;
  step: number;
  stageKey: StageKey;
  label: string;
  sub: string;
  icon: LucideIcon;
  emoji: string;
};

const STEP_ITEMS: StepItem[] = [
  {
    key: "step1",
    step: 1,
    stageKey: "discover",
    label: "발견하기",
    sub: "디지털 언어 탐색",
    icon: Search,
    emoji: "🔍",
  },
  {
    key: "step2",
    step: 2,
    stageKey: "dissect",
    label: "파헤치기",
    sub: "우리말 사전 만들기",
    icon: BookOpen,
    emoji: "📖",
  },
  {
    key: "step3",
    step: 3,
    stageKey: "empathize",
    label: "공감하기",
    sub: "AI 수호비서",
    icon: Heart,
    emoji: "❤️",
  },
  {
    key: "step4",
    step: 4,
    stageKey: "rewrite",
    label: "바꾸기",
    sub: "예절 역할극",
    icon: Pencil,
    emoji: "✏️",
  },
  {
    key: "step5",
    step: 5,
    stageKey: "practice",
    label: "실천하기",
    sub: "퀴즈 · 표현 돌아보기",
    icon: Sprout,
    emoji: "🌱",
  },
];

type Props = {
  activeKey: SidebarKey;
  onSelect: (key: SidebarKey) => void;
  studentName: string;
  studentMeta: string;
  onLogout: () => void;
  onOpenProfile: () => void;
  stageDone?: Partial<Record<StageKey, boolean>>;
};

export function AppSidebar({
  activeKey,
  onSelect,
  studentName,
  studentMeta,
  onLogout,
  onOpenProfile,
  stageDone,
}: Props) {
  return (
    <aside
      aria-label="주 메뉴"
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-border bg-card shadow-[var(--shadow-soft)]"
    >
      {/* Top: Logo + name + slogan */}
      <div className="px-5 pt-6 pb-5 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="바른말 수호대 로고"
            className="h-11 w-11 rounded-xl shrink-0"
          />
          <div className="min-w-0">
            <div className="font-black text-base leading-tight text-foreground truncate">
              바른말 수호대
            </div>
            <div className="text-[11px] text-muted-foreground truncate">디지털 언어를 바르게!</div>
          </div>
        </div>
      </div>

      {/* Middle: Nav — 학습 5단계 중심 IA */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scroll-touch">
        <ul className="flex flex-col gap-1">
          <li>
            <button
              type="button"
              onClick={() => onSelect("home")}
              aria-current={activeKey === "home" ? "page" : undefined}
              className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeKey === "home"
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-foreground/80 hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <Home
                className={`h-5 w-5 shrink-0 ${activeKey === "home" ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`}
                strokeWidth={activeKey === "home" ? 2.4 : 2}
              />
              <span className="truncate">홈</span>
            </button>
          </li>

          <li className="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            학습 단계
          </li>

          {STEP_ITEMS.map((it) => {
            const Icon = it.icon;
            const active = activeKey === it.key;
            const done = !!stageDone?.[it.stageKey];
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => onSelect(it.key)}
                  aria-current={active ? "page" : undefined}
                  className={`group w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                      : done
                        ? "text-foreground/90 hover:bg-primary/10 hover:text-primary"
                        : "text-foreground/70 hover:bg-primary/10 hover:text-primary hover:translate-x-0.5"
                  }`}
                >
                  <span
                    className={`mt-0.5 h-8 w-8 shrink-0 grid place-items-center rounded-lg text-sm font-black ${
                      active
                        ? "bg-white/20 text-primary-foreground"
                        : done
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary"
                    }`}
                    aria-hidden
                  >
                    {done && !active ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : (
                      <Icon className="h-4 w-4" strokeWidth={active ? 2.6 : 2.2} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-black tracking-wider ${active ? "text-primary-foreground/80" : "text-primary/70"}`}
                      >
                        STEP {it.step}
                      </span>
                      {done && !active && (
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-1.5 py-px">
                          완료
                        </span>
                      )}
                    </span>
                    <span className="block text-sm font-black leading-tight truncate">
                      {it.emoji} {it.label}
                    </span>
                    <span
                      className={`block text-[11px] font-medium leading-tight truncate ${active ? "text-primary-foreground/85" : "text-muted-foreground"}`}
                    >
                      {it.sub}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

          <li className="mt-3 mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            보상
          </li>
          <li>
            <button
              type="button"
              onClick={() => onSelect("badges")}
              className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                activeKey === "badges"
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-foreground/80 hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <Award
                className={`h-5 w-5 shrink-0 ${activeKey === "badges" ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`}
                strokeWidth={activeKey === "badges" ? 2.4 : 2}
              />
              <span className="truncate">🏅 배지</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Bottom: profile + logout */}
      <div className="mt-auto border-t border-border p-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
        >
          <div className="h-9 w-9 rounded-full bg-primary/10 grid place-items-center text-primary font-bold text-sm shrink-0">
            {studentName.slice(0, 1) || "학"}
          </div>
          <div className="min-w-0 text-left">
            <div className="text-sm font-bold text-foreground truncate">{studentName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{studentMeta}</div>
          </div>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="mt-1 w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
