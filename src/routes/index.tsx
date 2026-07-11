import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import logoAsset from "@/assets/logo.png.asset.json";
import { Onboarding } from "@/components/literacy/Onboarding";
import { AnalyzerTab } from "@/components/literacy/AnalyzerTab";
import { ChatbotTab } from "@/components/literacy/ChatbotTab";
import { QuizTab } from "@/components/literacy/QuizTab";
import { DictionaryTab } from "@/components/literacy/DictionaryTab";
import { DashboardTab } from "@/components/literacy/DashboardTab";
import { TeacherDashboard } from "@/components/literacy/TeacherDashboard";
import { useEffect } from "react";
import { useHydrated, useStudent, useDictionary, useClassState, useStudents, studentId } from "@/lib/literacy-store";
import { levelOf } from "@/lib/literacy-types";


export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "analyze" | "chat" | "quiz" | "dict";

function Index() {
  const hydrated = useHydrated();
  const { student, setStudent } = useStudent();
  const { dict, addProposal, setStatus, updateEntry, resetSeed } = useDictionary();
  const { state, addXP, setXP } = useClassState(student?.classCode);
  const roster = useStudents();
  const [tab, setTab] = useState<Tab>("analyze");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [prefillWord, setPrefillWord] = useState<string | undefined>();
  const [openModalKey, setOpenModalKey] = useState<number | undefined>();

  // Register the active student into the roster on every session start / name change.
  useEffect(() => {
    if (student) roster.upsertActive(student);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.classCode, student?.number, student?.name]);

  if (!hydrated) return <div className="min-h-screen" style={{ background: "var(--gradient-hero)" }} />;
  if (!student) return <Onboarding onSubmit={setStudent} />;

  const who = `${student.classCode}_${student.number.padStart(2, "0")} ${student.name}`;
  const activeId = studentId(student.classCode, student.number);
  const lv = levelOf(state.xp);

  function awardXP(delta: number, kind: string, note?: string) {
    addXP(delta, who, kind, note);
    if (delta) roster.addStudentXP(activeId, delta);
  }

  return (
    <div
      className="min-h-screen pastel-bg"
      style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
    >
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/60 border-b border-white/60">
        <div className="max-w-6xl mobile-frame lg:max-w-6xl grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
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

      <main className="max-w-6xl mobile-frame lg:max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        {tab === "analyze" && (
          <AnalyzerTab
            dict={dict}
            onRegisterNew={(w) => {
              setPrefillWord(w);
              setOpenModalKey(Date.now());
              setTab("dict");
            }}
          />
        )}
        {tab === "chat" && (
          <ChatbotTab
            classLevel={lv.current.lv}
            onXP={(delta, kind, note) => awardXP(delta, kind, note)}
          />
        )}
        {tab === "quiz" && (
          <QuizTab
            dict={dict}
            onXP={(delta, kind, note) => awardXP(delta, kind, note)}
          />
        )}
        {tab === "dict" && (
          <div className="space-y-6">
            <DashboardTab dict={dict} state={state} />
            <DictionaryTab
              dict={dict}
              student={student}
              prefillWord={prefillWord}
              openModalKey={openModalKey}
              onSubmit={(p) => {
                addProposal(p);
              awardXP(5, "proposal", p.word);
              }}
            />
          </div>
        )}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-white/70 border-t border-white/60 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-6xl mobile-frame lg:max-w-6xl grid grid-cols-4">
          {[
            { id: "analyze", icon: "🔎", label: "밈 분석기" },
            { id: "chat", icon: "💬", label: "예절 역할극" },
            { id: "quiz", icon: "🎮", label: "스피드 퀴즈" },
            { id: "dict", icon: "📚", label: "우리말 사전" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`py-2.5 sm:py-3 min-h-[56px] flex flex-col items-center justify-center gap-0.5 font-bold text-[11px] sm:text-xs transition ${
                tab === t.id ? "text-[color:var(--mint-deep)]" : "text-muted-foreground"
              }`}
            >
              <span className="tabbar-icon text-2xl leading-none">{t.icon}</span>
              <span className="tabbar-label truncate max-w-full px-1">{t.label}</span>
              {tab === t.id && <span className="w-8 h-1 rounded-full bg-[color:var(--mint-deep)]" />}
            </button>
          ))}
        </div>
      </nav>

      {teacherOpen && (
        <TeacherDashboard
          dict={dict}
          students={roster.students}
          currentClassCode={student.classCode}
          onApprove={(id) => {
            setStatus(id, "approved");
            const w = dict.find((d) => d.id === id);
            if (w) addXP(20, `제안자 ${w.suggested_by}`, "approved", w.word);
          }}
          onReject={(id) => setStatus(id, "rejected")}
          onUpdate={(id, patch) => {
            updateEntry(id, patch);
            const w = dict.find((d) => d.id === id);
            addXP(0, "교사", "edit", w?.word);
          }}
          onUpdateStudent={(id, patch) => {
            const { xpDelta, classCode } = roster.updateStudent(id, patch);
            // Only mirror the delta into the currently-viewed class ledger.
            if (xpDelta && classCode === student.classCode) {
              setXP(state.xp + xpDelta, `교사 조정 · ${id}`, patch.name);
            }
          }}
          onDeleteStudent={(id) => {
            const { removedXp, classCode } = roster.removeStudent(id);
            if (removedXp && classCode === student.classCode) {
              setXP(Math.max(0, state.xp - removedXp), `교사 삭제 · ${id}`);
            }
            // If the currently active student was deleted, end the session.
            if (id === activeId) setStudent(null);
          }}
          onClose={() => setTeacherOpen(false)}
          onReset={() => {
            if (confirm("사전을 초기 시드 데이터로 되돌릴까요? (학생 제안은 사라집니다)")) resetSeed();
          }}
        />
      )}
    </div>
  );
}
