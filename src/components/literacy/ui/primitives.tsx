import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * 공통 UI 프리미티브 — 학생 화면 전 탭(검색·사전·퀴즈·성찰·로드맵·배지)에서
 * 카드/섹션 헤더/버튼/입력/뱃지 스타일을 통일하기 위한 얇은 래퍼.
 * 기능 변경 없이 스타일만 표준화한다.
 */

export function SectionCard({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`glass-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-base sm:text-lg font-black text-[color:var(--navy)] truncate">
            {title}
          </div>
          {subtitle && <div className="text-xs text-muted-foreground truncate">{subtitle}</div>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

type Tone = "primary" | "secondary" | "accent" | "purple" | "danger" | "ghost";

const TONE_BTN: Record<Tone, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
  purple: "bg-[color:var(--purple)] text-white hover:opacity-90",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  ghost: "bg-white/70 text-[color:var(--navy)] hover:bg-white border border-white/70",
};

export const AppButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }
>(function AppButton({ tone = "primary", className = "", children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold shadow-[var(--shadow-soft)] transition hover:scale-[1.02] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 disabled:pointer-events-none ${TONE_BTN[tone]} ${className}`}
    >
      {children}
    </button>
  );
});

export const AppInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function AppInput({ className = "", ...rest }, ref) {
    return (
      <input
        ref={ref}
        {...rest}
        className={`w-full rounded-2xl border border-input bg-white/80 px-4 py-2.5 text-sm text-[color:var(--navy)] placeholder:text-muted-foreground/70 outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/40 ${className}`}
      />
    );
  },
);

const TONE_BADGE: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-[color:var(--navy)]",
  accent: "bg-accent/15 text-[color:var(--navy)]",
  purple: "bg-[color:var(--purple)]/12 text-[color:var(--purple)]",
  danger: "bg-destructive/10 text-destructive",
  ghost: "bg-white/70 text-[color:var(--navy)]",
};

export function PillBadge({
  tone = "primary",
  className = "",
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE_BADGE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  color,
  className = "",
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={`h-2 rounded-full bg-white/60 overflow-hidden ${className}`}>
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color ?? "var(--primary)" }}
      />
    </div>
  );
}

/**
 * 학생·교사 화면 공용 빈 상태 컴포넌트.
 * 검색 결과 없음, 활동 기록 없음, 학생 없음 등 모든 Empty State 를 통일한다.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-6 ${className}`}
    >
      {icon && (
        <div className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/10 text-primary">
          {icon}
        </div>
      )}
      <div className="text-sm font-black text-[color:var(--navy)]">{title}</div>
      {description && (
        <div className="text-xs text-muted-foreground leading-relaxed max-w-sm">
          {description}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * 공용 로딩 스피너. 프로젝트 전역 로딩 표시를 하나의 스타일로 통일한다.
 */
export function LoadingSpinner({
  size = 20,
  label,
  className = "",
}: {
  size?: 16 | 18 | 20 | 24;
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label ?? "로딩 중"}
      className={`inline-flex items-center gap-2 text-muted-foreground ${className}`}
    >
      <span
        aria-hidden
        className="inline-block rounded-full border-2 border-primary/30 border-t-primary animate-spin"
        style={{ width: size, height: size }}
      />
      {label && <span className="text-xs font-bold">{label}</span>}
    </span>
  );
}
