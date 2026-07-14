import { useMemo } from "react";
import { Search, BookOpen, Gamepad2, NotebookPen, Target, Sparkles } from "lucide-react";
import logoAsset from "@/assets/logo-v2.webp.asset.json";
import type { DictEntry } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import { RoadmapCard } from "./RoadmapCard";

type QuickTab = "analyze" | "chat" | "assist" | "quiz" | "dict";

type Props = {
  studentName: string;
  classCode: string;
  studentNumber: string;
  activeId: string;
  dict: DictEntry[];
  onJump: (tab: QuickTab) => void;
};

export function HomeTab({
  studentName,
  classCode,
  studentNumber,
  activeId,
  dict,
  onJump,
}: Props) {
  const engagement = useEngagementStore((s) => s.byStudent[activeId]);

  const stats = useMemo(() => {
    const registered = dict.filter((d) => d.suggested_by === activeId).length;
    const reflections = engagement?.journals?.length ?? 0;
    const badges = engagement?.unlockedBadges?.length ?? 0;
    const roleplay = engagement?.roleplayCleared?.length ?? 0;
    return { registered, reflections, badges, roleplay };
  }, [dict, engagement, activeId]);

  const recent = useMemo(() => {
    const items: { tag: string; tagColor: string; text: string }[] = [];
    const myWords = dict
      .filter((d) => d.suggested_by === activeId)
      .slice(-1)
      .map((d) => ({
        tag: "참여 사전",
        tagColor: "bg-emerald-100 text-emerald-700",
        text: `"${d.word}" 표현을 등록했어요!`,
      }));
    items.push(...myWords);
    if (stats.roleplay > 0) {
      items.push({
        tag: "역할극",
        tagColor: "bg-pink-100 text-pink-700",
        text: `역할극 ${stats.roleplay}개 시나리오를 완료했어요!`,
      });
    }
    if (stats.reflections > 0) {
      items.push({
        tag: "성찰",
        tagColor: "bg-purple-100 text-purple-700",
        text: `성찰 ${stats.reflections}개를 작성했어요!`,
      });
    }
    if (stats.badges > 0) {
      items.push({
        tag: "배지",
        tagColor: "bg-amber-100 text-amber-700",
        text: `배지 ${stats.badges}개를 받았어요!`,
      });
    }
    return items.slice(0, 4);
  }, [dict, activeId, stats]);

  const quicks: {
    key: QuickTab;
    title: string;
    desc: string;
    icon: React.ReactNode;
    tone: string;
    btn: string;
  }[] = [
    {
      key: "analyze",
      title: "표현 찾아보기",
      desc: "궁금한 디지털 언어를 검색해요.",
      icon: <Search className="h-6 w-6 text-blue-600" />,
      tone: "bg-blue-50 border-blue-100",
      btn: "bg-blue-600 hover:bg-blue-700",
    },
    {
      key: "dict",
      title: "참여 사전",
      desc: "새로운 표현을 등록해요.",
      icon: <BookOpen className="h-6 w-6 text-emerald-600" />,
      tone: "bg-emerald-50 border-emerald-100",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      key: "quiz",
      title: "퀴즈 놀이터",
      desc: "퀴즈를 풀며 실력을 쌓아요.",
      icon: <Gamepad2 className="h-6 w-6 text-orange-600" />,
      tone: "bg-orange-50 border-orange-100",
      btn: "bg-orange-500 hover:bg-orange-600",
    },
    {
      key: "assist",
      title: "나의 표현 돌아보기",
      desc: "나의 생각과 성찰을 기록해요.",
      icon: <NotebookPen className="h-6 w-6 text-purple-600" />,
      tone: "bg-purple-50 border-purple-100",
      btn: "bg-purple-600 hover:bg-purple-700",
    },
  ];

  const missionGoal = 3;
  const missionDone = Math.min(missionGoal, stats.registered);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4 min-w-0">
        {/* Hero */}
        <section
          aria-label="바른말 수호대 소개"
          className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-b from-sky-50 via-white to-white p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-100/70 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-4 inset-x-0 h-16 bg-gradient-to-t from-emerald-50 to-transparent"
          />
          <div className="relative flex flex-col items-center text-center gap-3">
            <img
              src={logoAsset.url}
              alt="바른말 수호대 로고"
              className="h-14 w-14 rounded-2xl shadow-[var(--shadow-soft)]"
            />
            <h1 className="text-2xl sm:text-3xl font-black text-[color:var(--navy)] tracking-tight">
              바른말 수호대
            </h1>
            <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
              디지털 언어의 뜻과 맥락을 살펴보고,
              <br className="hidden sm:block" />
              상대를 존중하는 표현을 함께 만들어 가는 학습 공간
            </p>

            {/* characters row (emoji placeholders — 과도한 애니메이션 없음) */}
            <div className="mt-2 flex items-center justify-center gap-6 text-4xl sm:text-5xl select-none">
              <span aria-label="생각하는 학생" role="img">
                🧑‍🎓
              </span>
              <span aria-label="탐구하는 학생" role="img">
                🔎
              </span>
              <span aria-label="쓰는 학생" role="img">
                👩‍🎓
              </span>
            </div>

            {/* 오늘의 미션 */}
            <div className="mt-4 w-full max-w-md rounded-2xl border border-rose-100 bg-white/80 backdrop-blur px-4 py-3 text-left">
              <div className="flex items-center gap-2 text-[11px] font-black text-rose-600 uppercase tracking-wider">
                <Target className="h-3.5 w-3.5" />
                오늘의 미션
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="text-sm font-bold text-[color:var(--navy)]">
                  존중하는 표현 {missionGoal}개 찾기
                </div>
                <div className="text-xs font-bold text-slate-500 shrink-0">
                  {missionDone} / {missionGoal}
                </div>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-rose-400"
                  style={{ width: `${(missionDone / missionGoal) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <RoadmapCard
          studentId={activeId}
          classCode={classCode}
          dict={dict}
          onStageJump={(t) => onJump(t)}
        />

        {/* Quick Actions */}
        <section
          aria-label="바로 시작하기"
          className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-[color:var(--navy)]">바로 시작하기</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quicks.map((q) => (
              <div
                key={q.key}
                className={`rounded-2xl border ${q.tone} p-4 flex flex-col gap-2 transition-transform duration-200 hover:-translate-y-0.5`}
              >
                <div>{q.icon}</div>
                <div className="font-black text-sm text-[color:var(--navy)]">{q.title}</div>
                <div className="text-[11px] leading-snug text-slate-600 min-h-[2.4em]">
                  {q.desc}
                </div>
                <button
                  type="button"
                  onClick={() => onJump(q.key)}
                  className={`mt-1 rounded-xl px-3 py-2 text-xs font-bold text-white transition ${q.btn}`}
                >
                  시작하기
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            💡 TIP · 모르는 표현이 있을 때는 <b>표현 찾아보기</b>부터 시작해 보세요!
          </p>
        </section>
      </div>

      {/* Right column: Activity */}
      <aside className="flex flex-col gap-4 min-w-0">
        <section
          aria-label="나의 활동 현황"
          className="rounded-3xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-black text-[color:var(--navy)] mb-3">나의 활동 현황</h3>
          <ul className="text-sm divide-y divide-slate-100">
            <StatRow label="등록한 표현" value={`${stats.registered}개`} accent="text-emerald-600" />
            <StatRow label="완료한 역할극" value={`${stats.roleplay}개`} accent="text-orange-600" />
            <StatRow label="작성한 성찰" value={`${stats.reflections}개`} accent="text-purple-600" />
            <StatRow label="받은 배지" value={`${stats.badges}개`} accent="text-amber-600" />
          </ul>
        </section>

        <section
          aria-label="최근 활동"
          className="rounded-3xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-black text-[color:var(--navy)] mb-3">최근 활동</h3>
          {recent.length === 0 ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              아직 기록된 활동이 없어요. 왼쪽 <b>바로 시작하기</b>에서 첫 활동을 시작해 보세요!
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.tagColor}`}
                  >
                    {r.tag}
                  </span>
                  <span className="text-slate-700 leading-snug">{r.text}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 text-[11px] text-slate-500">
            학급 {classCode} · {studentNumber}번 {studentName}
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="text-slate-600">{label}</span>
      <span className={`font-black ${accent}`}>{value}</span>
    </li>
  );
}