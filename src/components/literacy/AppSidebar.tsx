import {
  Home,
  Search,
  BookOpen,
  Gamepad2,
  NotebookPen,
  Map,
  Award,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import logoAsset from "@/assets/logo-v2.webp.asset.json";

export type SidebarKey = "home" | "analyze" | "dict" | "quiz" | "reflect" | "roadmap" | "badges";

type Item = {
  key: SidebarKey;
  label: string;
  icon: LucideIcon;
};

const ITEMS: Item[] = [
  { key: "home", label: "홈", icon: Home },
  { key: "analyze", label: "표현 찾아보기", icon: Search },
  { key: "dict", label: "참여 사전", icon: BookOpen },
  { key: "quiz", label: "퀴즈 놀이터", icon: Gamepad2 },
  { key: "reflect", label: "나의 표현 돌아보기", icon: NotebookPen },
  { key: "roadmap", label: "로드맵", icon: Map },
  { key: "badges", label: "배지", icon: Award },
];

type Props = {
  activeKey: SidebarKey;
  onSelect: (key: SidebarKey) => void;
  studentName: string;
  studentMeta: string;
  onLogout: () => void;
  onOpenProfile: () => void;
};

export function AppSidebar({
  activeKey,
  onSelect,
  studentName,
  studentMeta,
  onLogout,
  onOpenProfile,
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

      {/* Middle: Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 scroll-touch">
        <ul className="flex flex-col gap-1">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const active = activeKey === it.key;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  onClick={() => onSelect(it.key)}
                  aria-current={active ? "page" : undefined}
                  className={`group w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                      : "text-foreground/80 hover:bg-primary/10 hover:text-primary hover:translate-x-0.5"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-transform duration-200 ${
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground group-hover:text-primary group-hover:scale-110"
                    }`}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span className="truncate">{it.label}</span>
                </button>
              </li>
            );
          })}
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
