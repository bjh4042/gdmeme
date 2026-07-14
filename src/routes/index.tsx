import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import logoAsset from "@/assets/logo-v2.webp.asset.json";
import { Onboarding } from "@/components/literacy/Onboarding";
import { AnalyzerTab } from "@/components/literacy/AnalyzerTab";
import { ChatbotTab } from "@/components/literacy/ChatbotTab";
import { QuizTab } from "@/components/literacy/QuizTab";
import { DictionaryTab } from "@/components/literacy/DictionaryTab";
import { DashboardTab } from "@/components/literacy/DashboardTab";
import { AssistantTab } from "@/components/literacy/AssistantTab";
import { TeacherGate } from "@/components/literacy/TeacherGate";
import { ProfileModal } from "@/components/literacy/ProfileModal";
import { ReportModal } from "@/components/literacy/ReportModal";
import { useEffect } from "react";
import {
  useHydrated,
  useStudent,
  useDictionary,
  useClassState,
  useStudents,
  studentId,
  addClassXPFor,
} from "@/lib/literacy-store";
import { levelOf } from "@/lib/literacy-types";
import { toast } from "sonner";
import { useEngagementStore } from "@/stores/engagement";
import { SCENARIOS } from "@/lib/literacy-seed";
import { useClassStore, EMPTY_CLASS } from "@/stores/class";
import { seedClass3105IfNeeded } from "@/lib/seed-3105";
import { Tutorial, TUTORIAL_STORAGE_KEY } from "@/components/literacy/Tutorial";
import { HeaderAreaBadges } from "@/components/literacy/HeaderAreaBadges";
import { BadgeCodexModal } from "@/components/literacy/BadgeCodexModal";
import { WeeklySurveyModal } from "@/components/literacy/WeeklySurveyModal";
import { isSurveyDayToday, isoWeekKey, loadMyAnswer } from "@/lib/weekly-survey";
import { RoadmapCard, StageChip } from "@/components/literacy/RoadmapCard";
import { stageContextForTab } from "@/lib/stage-context";
import { AppSidebar, type SidebarKey } from "@/components/literacy/AppSidebar";
import { HomeTab } from "@/components/literacy/HomeTab";
import { Step5Tab } from "@/components/literacy/Step5Tab";
import { deriveRoadmap } from "@/lib/roadmap";

export const Route = createFileRoute("/")({
  component: Index,
});

type Tab = "home" | "analyze" | "chat" | "assist" | "quiz" | "dict" | "step5";

function Index() {
  const hydrated = useHydrated();
  const { student, setStudent } = useStudent();
  const { dict, addProposal, setStatus, updateEntry, resetSeed } = useDictionary();
  const { state, addXP, setXP } = useClassState(student?.classCode);
  const roster = useStudents();
  const [tab, setTab] = useState<Tab>("home");
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [prefillWord, setPrefillWord] = useState<string | undefined>();
  const [openModalKey, setOpenModalKey] = useState<number | undefined>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [codexOpen, setCodexOpen] = useState(false);
  const [reportForId, setReportForId] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const markLexicographer = useEngagementStore((s) => s.markLexicographer);
  const reportRoleplayClear = useEngagementStore((s) => s.reportRoleplayClear);
  const totalScenarios = SCENARIOS.length;

  // Register the active student into the roster on every session start / name change.
  useEffect(() => {
    if (student) roster.upsertActive(student);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.classCode, student?.number, student?.name]);

  // 20인 더미데이터 시드 · 최초 진입 1회만 실행
  useEffect(() => {
    if (hydrated) seedClass3105IfNeeded();
  }, [hydrated]);

  // 최초 진입자 자동 튜토리얼 (localStorage 방문 기록 없을 때만).
  useEffect(() => {
    if (!hydrated || !student) return;
    try {
      if (window.localStorage.getItem(TUTORIAL_STORAGE_KEY) !== "true") {
        const t = setTimeout(() => setTutorialOpen(true), 400);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage/parse 실패 무시 */
    }
  }, [hydrated, student]);

  // 주간 성찰 설문 트리거 (월/금 접속 시, 이번 주 미응답이면 팝업).
  useEffect(() => {
    if (!hydrated || !student) return;
    if (!isSurveyDayToday()) return;
    const sid = studentId(student.classCode, student.number);
    const prior = loadMyAnswer(student.classCode, sid);
    if (prior && prior.weekKey === isoWeekKey()) return;
    const t = setTimeout(() => setSurveyOpen(true), 1200);
    return () => clearTimeout(t);
  }, [hydrated, student]);

  const activeId = student ? studentId(student.classCode, student.number) : "";

  const teacherView = teacherOpen ? (
    <TeacherGate
      dict={dict}
      students={roster.students}
      currentClassCode={student?.classCode ?? ""}
      onApprove={(id) => {
        const w = dict.find((d) => d.id === id);
        setStatus(id, "approved");
        if (!w) return;
        const applicantId = w.suggested_by;
        // 1) 신청 학생 개인 누적 XP에 +5
        roster.addStudentXP(applicantId, 5);
        // 2) 신청 학생의 학급 공동 XP에도 +5 (교사 현재 학급/타 학급 모두 대응)
        const applicant = roster.students.find((r) => r.id === applicantId);
        const applicantClass = applicant?.classCode ?? student?.classCode;
        if (applicantClass === student?.classCode) {
          addXP(5, `승인 · ${applicant?.name ?? applicantId}`, "word-approved", w.word);
        } else if (applicantClass) {
          addClassXPFor(
            applicantClass,
            5,
            `승인 · ${applicant?.name ?? applicantId}`,
            "word-approved",
            w.word,
          );
        }
        // 3) 뱃지 · 사전 편찬자 해금
        markLexicographer(applicantId);
        toast.success("교사 승인 완료! 신청 학생에게 수호 경험치 5 XP가 지급되었습니다.", {
          description: `단어: ${w.word} · 신청자: ${applicant?.name ?? applicantId}`,
        });
      }}
      onReject={(id) => setStatus(id, "rejected")}
      onUpdate={(id, patch) => {
        updateEntry(id, patch);
        const w = dict.find((d) => d.id === id);
        addXP(0, "교사", "edit", w?.word);
      }}
      onUpdateStudent={(id, patch) => {
        const { xpDelta, classCode } = roster.updateStudent(id, patch);
        if (xpDelta && classCode === student?.classCode) {
          setXP(state.xp + xpDelta, `교사 조정 · ${id}`, patch.name);
        }
      }}
      onDeleteStudent={(id) => {
        const { removedXp, classCode } = roster.removeStudent(id);
        if (removedXp && classCode === student?.classCode) {
          setXP(Math.max(0, state.xp - removedXp), `교사 삭제 · ${id}`);
        }
        if (id === activeId && student) setStudent(null);
      }}
      onImportStudents={(rows, mode) => {
        const res = roster.importStudents(rows, mode);
        const delta = student ? (res.classXpDeltas[student.classCode] ?? 0) : 0;
        if (delta) setXP(Math.max(0, state.xp + delta), `엑셀 업로드 (${mode})`);
        return { added: res.added, updated: res.updated, removed: res.removed };
      }}
      onClose={() => setTeacherOpen(false)}
      onReset={() => {
        // 2단계 확인: 실수로 학생 활동이 사라지지 않도록 두 번 확인
        const ok1 = confirm(
          "정말로 사전을 초기 시드 데이터로 되돌릴까요?\n\n" +
            "삭제 대상: 학생이 제안한 낱말, 승인/거절 상태 변경 내역, 대안 표현 편집 내용",
        );
        if (!ok1) return;
        const check = prompt('확인을 위해 아래에 "초기화"를 정확히 입력하세요.');
        if (check?.trim() !== "초기화") return;
        resetSeed();
      }}
      onOpenReport={(id) => setReportForId(id)}
    />
  ) : null;

  const teacherReportStudent = reportForId
    ? roster.students.find((r) => r.id === reportForId)
    : null;
  const teacherReportClassState = useClassStore((s) =>
    teacherReportStudent ? (s.byClass[teacherReportStudent.classCode] ?? EMPTY_CLASS) : EMPTY_CLASS,
  );

  const who = student
    ? `${student.classCode}_${student.number.padStart(2, "0")} ${student.name}`
    : "";
  const lv = levelOf(state.xp);

  // useCallback으로 자식 탭에 넘기는 콜백을 안정화(memo 회피 방지).
  const awardXP = useCallback(
    (delta: number, kind: string, note?: string) => {
      addXP(delta, who, kind, note);
      if (delta && activeId) roster.addStudentXP(activeId, delta);
    },
    [addXP, who, activeId, roster],
  );

  const onRegisterNew = useCallback((w: string) => {
    setPrefillWord(w);
    setOpenModalKey(Date.now());
    setTab("dict");
  }, []);

  const onDictSubmit = useCallback(
    (p: Parameters<React.ComponentProps<typeof DictionaryTab>["onSubmit"]>[0]) => {
      addProposal(p);
      awardXP(5, "proposal", p.word);
    },
    [addProposal, awardXP],
  );

  const classLv = lv.current.lv;

  // 4개 탭을 항상 마운트하고 hidden 토글로만 전환 → 탭 이동해도
  // 스크롤/입력/챗 상태가 그대로 살아있는 keep-alive.
  const analyzerNode = useMemo(
    () => (
      <AnalyzerTab dict={dict} onRegisterNew={onRegisterNew} classCode={student?.classCode ?? ""} />
    ),
    [dict, onRegisterNew, student?.classCode],
  );
  const chatbotNode = useMemo(
    () => (
      <ChatbotTab
        classLevel={classLv}
        studentKey={activeId}
        onXP={awardXP}
        onRoleplayClear={(scenarioId, total) => {
          const master = reportRoleplayClear(activeId, scenarioId, total);
          if (master)
            toast.success("🎖️ 예절 마스터 뱃지 획득!", {
              description: "역할극 전 시나리오 클리어",
            });
        }}
      />
    ),
    [classLv, activeId, awardXP, reportRoleplayClear],
  );
  const assistNode = useMemo(() => <AssistantTab onXP={awardXP} />, [awardXP]);
  const quizNode = useMemo(() => <QuizTab dict={dict} onXP={awardXP} />, [dict, awardXP]);
  const step5Node = useMemo(
    () => <Step5Tab quiz={<QuizTab dict={dict} onXP={awardXP} />} reflect={<AssistantTab onXP={awardXP} />} />,
    [dict, awardXP],
  );
  const dictNode = useMemo(
    () => (
      <div className="space-y-6">
        {student && (
          <RoadmapCard
            studentId={activeId}
            classCode={student.classCode}
            dict={dict}
            onStageJump={(t) => setTab(t)}
          />
        )}
        <DashboardTab dict={dict} state={state} classCode={student?.classCode} />
        {student && (
          <DictionaryTab
            dict={dict}
            student={student}
            prefillWord={prefillWord}
            openModalKey={openModalKey}
            onSubmit={onDictSubmit}
          />
        )}
      </div>
    ),
    [dict, state, student, prefillWord, openModalKey, onDictSubmit, activeId],
  );

  const homeNode = useMemo(
    () =>
      student ? (
        <HomeTab
          studentName={student.name}
          classCode={student.classCode}
          studentNumber={student.number}
          activeId={activeId}
          dict={dict}
          onJump={(t) => setTab(t)}
        />
      ) : null,
    [student, activeId, dict],
  );

  if (!student || !hydrated) {
    // hydrated 가 false 인 동안(SSR + 첫 클라 렌더)에는 스플래시를 보여
    // 자동 로그인 복원 중 폼이 잠깐 깜빡이는 현상을 방지.
    if (!hydrated) {
      return (
        <div className="min-h-screen w-full max-w-full overflow-x-hidden grid place-items-center bg-white">
          <div className="flex flex-col items-center gap-3 text-[color:var(--navy)]">
            <img src={logoAsset.url} alt="바른말 수호대" className="h-14 w-auto rounded-xl" />
            <div className="text-sm font-bold opacity-70">불러오는 중…</div>
          </div>
        </div>
      );
    }
    return (
      <>
        <Onboarding
          onSubmit={setStudent}
          onAdmin={() => setTeacherOpen(true)}
          roster={roster.students}
        />
        {teacherView}
      </>
    );
  }

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-hidden pastel-bg lg:pl-60"
      style={{ paddingBottom: "calc(76px + env(safe-area-inset-bottom, 0px))" }}
    >
      <AppSidebar
        activeKey={((): SidebarKey => {
          if (tab === "home") return "home";
          if (tab === "analyze") return "step1";
          if (tab === "dict") return "step2";
          if (tab === "assist") return "step3";
          if (tab === "chat") return "step4";
          if (tab === "quiz" || tab === "step5") return "step5";
          return "home";
        })()}
        onSelect={(key) => {
          switch (key) {
            case "home":
              setTab("home");
              break;
            case "step1":
            case "analyze":
              setTab("analyze");
              break;
            case "step2":
            case "dict":
              setTab("dict");
              break;
            case "step3":
            case "reflect":
              setTab("assist");
              break;
            case "step4":
              setTab("chat");
              break;
            case "step5":
            case "quiz":
              setTab("step5");
              break;
            case "roadmap":
              setTab("home");
              break;
            case "badges":
              setCodexOpen(true);
              break;
          }
        }}
        studentName={student.name}
        studentMeta={`${student.classCode}반 · ${student.number}번 · Lv.${lv.current.lv}`}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={() => {
          if (confirm("세션을 종료하고 새 학생으로 다시 시작할까요?")) setStudent(null);
        }}
        stageDone={(() => {
          const rm = deriveRoadmap({
            studentId: activeId,
            classCode: student.classCode,
            engagement: undefined,
            dict,
          });
          return Object.fromEntries(rm.stages.map((s) => [s.key, s.done]));
        })()}
      />
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/60 border-b border-white/60">
        <div className="max-w-6xl mobile-frame lg:max-w-6xl grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={logoAsset.url}
              alt="바른말 수호대 로고"
              className="h-10 w-auto shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <div className="font-black text-[color:var(--navy)] truncate">바른말 수호대</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {student.classCode}반 · {student.number}번 {student.name} · Lv.{lv.current.lv}{" "}
                {lv.current.name} · {state.xp} XP
              </div>
            </div>
            <HeaderAreaBadges />
          </div>
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={() => setTutorialOpen(true)}
              title="도움말 · 사용 가이드 다시 보기"
              aria-label="도움말 · 사용 가이드 다시 보기"
              className="w-9 h-9 grid place-items-center rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--mint)] text-lg"
            >
              ❓
            </button>
            <button
              onClick={() => setCodexOpen(true)}
              title="뱃지 도감 · 획득/잠금 칭호 보기"
              aria-label="뱃지 도감"
              className="w-9 h-9 grid place-items-center rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--mint)] text-lg"
            >
              🏆
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              title="내 프로필"
              className="w-9 h-9 grid place-items-center rounded-lg bg-[color:var(--muted)] hover:bg-[color:var(--mint)] text-lg"
            >
              👤
            </button>
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
        <div className="bg-gray-50 border-t border-gray-100 text-gray-500 text-xs text-center py-1 px-3">
          🖥️ 본 장학 플랫폼은 학교 PC 및 태블릿(가로 모드) 환경에 최적화되어 구동됩니다.
        </div>
      </header>

      <main className="max-w-6xl mobile-frame lg:max-w-6xl px-3 pt-2 pb-4 sm:px-4 sm:pt-3 sm:pb-6">
        {tab !== "home" &&
          (() => {
            const ctx = stageContextForTab(tab);
            return (
              <div className="mb-3 rounded-2xl bg-white/60 border border-white/70 px-3 py-2.5">
                <p className="text-[11px] sm:text-xs text-slate-600 mb-2 leading-snug">
                  디지털 언어의 뜻과 맥락을 살펴보고, 상대를 존중하는 표현을 함께 만들어 가는 학습
                  공간
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <StageChip stage={ctx.stage} />
                  <span className="text-[11px] sm:text-xs text-slate-700 min-w-0">
                    <b className="text-[color:var(--navy)]">학습 목표</b> · {ctx.goal}
                  </span>
                  {ctx.next && (
                    <span className="text-[10px] sm:text-[11px] text-slate-500 ml-auto">
                      다음 활동 → <b className="text-[color:var(--navy)]">{ctx.next}</b>
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        <div hidden={tab !== "home"}>{homeNode}</div>
        <div hidden={tab !== "analyze"}>{analyzerNode}</div>
        <div hidden={tab !== "chat"}>{chatbotNode}</div>
        <div hidden={tab !== "assist"}>{assistNode}</div>
        <div hidden={tab !== "quiz"}>{quizNode}</div>
        <div hidden={tab !== "dict"}>{dictNode}</div>
        <div hidden={tab !== "step5"}>{step5Node}</div>
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl bg-white/70 border-t border-white/60 shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.15)] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-6xl mobile-frame lg:max-w-6xl grid grid-cols-5">
          {[
            { id: "analyze", icon: "🔎", label: "밈 분석기" },
            { id: "dict", icon: "📚", label: "우리말 사전" },
            { id: "assist", icon: "🤖", label: "AI 수호비서" },
            { id: "chat", icon: "💬", label: "예절 역할극" },
            { id: "quiz", icon: "🎮", label: "스피드 퀴즈" },
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
              {tab === t.id && (
                <span className="w-8 h-1 rounded-full bg-[color:var(--mint-deep)]" />
              )}
            </button>
          ))}
        </div>
      </nav>

      {teacherView}

      {profileOpen &&
        (() => {
          const rec = roster.students.find((r) => r.id === activeId);
          if (!rec) return null;
          return (
            <ProfileModal
              student={rec}
              dict={dict}
              classState={state}
              totalRoleplayScenarios={totalScenarios}
              onClose={() => setProfileOpen(false)}
            />
          );
        })()}

      {codexOpen &&
        (() => {
          const rec = roster.students.find((r) => r.id === activeId);
          if (!rec) return null;
          return <BadgeCodexModal student={rec} dict={dict} onClose={() => setCodexOpen(false)} />;
        })()}

      {reportForId && teacherReportStudent && teacherReportClassState && (
        <ReportModal
          student={teacherReportStudent}
          dict={dict}
          classState={teacherReportClassState}
          totalRoleplayScenarios={totalScenarios}
          onClose={() => setReportForId(null)}
        />
      )}

      <Tutorial
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onTabChange={(t) => setTab(t)}
        onOpenTeacher={() => setTeacherOpen(true)}
      />

      {surveyOpen && student && (
        <WeeklySurveyModal
          classCode={student.classCode}
          studentId={activeId}
          studentName={student.name}
          dict={dict}
          onClose={() => setSurveyOpen(false)}
        />
      )}
    </div>
  );
}
