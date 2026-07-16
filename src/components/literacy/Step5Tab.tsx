import { useState } from "react";
import { Lightbulb, NotebookPen } from "lucide-react";
import type { ReactNode } from "react";

type Sub = "quiz" | "reflect";

/**
 * STEP 5 실천하기 — 「스피드 퀴즈」와 「나의 표현 돌아보기」를 하나의 학습 단계
 * 안에 탭으로 통합해 제공한다. 두 자식은 keep-alive(hidden 토글)로 유지해
 * 탭 이동 시 진행 상태가 초기화되지 않는다.
 */
export function Step5Tab({ quiz, reflect }: { quiz: ReactNode; reflect: ReactNode }) {
  const [sub, setSub] = useState<Sub>("quiz");
  return (
    <section className="space-y-4">
      <div
        role="tablist"
        aria-label="STEP 5 실천하기 하위 활동"
        className="inline-flex items-center gap-1 rounded-xl border border-border bg-white p-1 shadow-[var(--shadow-soft)]"
      >
        <SubTab active={sub === "quiz"} onClick={() => setSub("quiz")} icon={<Lightbulb className="h-4 w-4" />}>
          스피드 퀴즈
        </SubTab>
        <SubTab
          active={sub === "reflect"}
          onClick={() => setSub("reflect")}
          icon={<NotebookPen className="h-4 w-4" />}
        >
          나의 표현 돌아보기
        </SubTab>
      </div>
      <div hidden={sub !== "quiz"}>{quiz}</div>
      <div hidden={sub !== "reflect"}>{reflect}</div>
    </section>
  );
}

function SubTab({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
          : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}