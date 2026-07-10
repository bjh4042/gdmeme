import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Onboarding } from "@/components/literacy/Onboarding";
import { ChatbotTab } from "@/components/literacy/ChatbotTab";
import { DictionaryTab } from "@/components/literacy/DictionaryTab";
import { DashboardTab } from "@/components/literacy/DashboardTab";
import { TeacherDashboard } from "@/components/literacy/TeacherDashboard";
import { useHydrated, useStudent, useDictionary, useClassState } from "@/lib/literacy-store";
import { levelOf } from "@/lib/literacy-types";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "chat" | "dict" | "dash";

function Index() {
  const hydrated = useHydrated();
  const { student, setStudent } = useStudent();
  const { dict, addProposal, setStatus, resetSeed } = useDictionary();
  const { state, addXP } = useClassState(student?.classCode);
  const [tab, setTab] = useState<Tab>("chat");
  const [teacherOpen, setTeacherOpen] = useState(false);

  if (!hydrated) return <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }} />;
  if (!student) return <Onboarding onSubmit={setStudent} />;

  const who = `${student.classCode}_${student.number.padStart(2, "0")} ${student.name}`;
  const lv = levelOf(state.xp);

  return (
    <div className="min-h-screen pb-24" style={{ background: "linear-gradient(180deg, oklch(0.96 0.03 190), oklch(0.985 0.015 190))" }}>
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b-2 border-[color:var(--border)]">
        <div className="max-w-6xl mx-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-3xl shrink-0">👑</div>
            <div className="min-w-0">
              <div className="font-black text-[color:var(--navy)] truncate">바른말 수호대</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {student.classCode}반 · {student.number}번 {student.name} · Lv.{lv.current.lv} {lv.current.name} · {state.xp} XP
              </div>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => setTeacherOpen(true)}
              title="교사 대시보드"
              className="w-9 h-9 grid place-items-center rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--mint)] text-lg"
            >
              🧑‍🏫
            </button>
            <button
              onClick={() => {
                if (confirm("세션을 종료하고 새 학생으로 다시 시작할까요?")) setStudent(null);
              }}
              title="세션 종료"
              className="w-9 h-9 grid place-items-center rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--mint)] text-sm"
            >
              ⎋
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === "chat" && (
          <ChatbotTab
            onXP={(delta, kind, note) => addXP(delta, who, kind, note)}
          />
        )}
        {tab === "dict" && (
          <DictionaryTab
            dict={dict}
            student={student}
            onSubmit={(p) => {
              addProposal(p);
              addXP(5, who, "proposal", p.word);
            }}
          />
        )}
        {tab === "dash" && <DashboardTab dict={dict} state={state} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-[color:var(--border)] shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)]">
        <div className="max-w-6xl mx-auto grid grid-cols-3">
          {[
            { id: "chat", icon: "💬", label: "챗봇/역할극" },
            { id: "dict", icon: "📖", label: "바른말 사전" },
            { id: "dash", icon: "🌤️", label: "학급 대시보드" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`py-3 flex flex-col items-center gap-0.5 font-bold text-xs transition ${
                tab === t.id ? "text-[color:var(--mint-deep)]" : "text-muted-foreground"
              }`}
            >
              <span className="text-2xl">{t.icon}</span>
              {t.label}
              {tab === t.id && <span className="w-8 h-1 rounded-full bg-[color:var(--mint-deep)]" />}
            </button>
          ))}
        </div>
      </nav>

      {teacherOpen && (
        <TeacherDashboard
          dict={dict}
          onApprove={(id) => {
            setStatus(id, "approved");
            const w = dict.find((d) => d.id === id);
            if (w) addXP(20, `제안자 ${w.suggested_by}`, "approved", w.word);
          }}
          onReject={(id) => setStatus(id, "rejected")}
          onClose={() => setTeacherOpen(false)}
          onReset={() => {
            if (confirm("사전을 초기 시드 데이터로 되돌릴까요? (학생 제안은 사라집니다)")) resetSeed();
          }}
        />
      )}
    </div>
  );
}
