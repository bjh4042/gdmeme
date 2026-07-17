import { useEffect, useMemo, useRef, useState } from "react";
import { Search, BookOpen, Lightbulb, NotebookPen, Flag, Sparkles } from "lucide-react";
import logoAsset from "@/assets/logo-v2.webp.asset.json";
import heroIllustration from "@/assets/hero-illustration.png.asset.json";
import type { DictEntry } from "@/lib/literacy-types";
import { useEngagementStore } from "@/stores/engagement";
import { RoadmapCard } from "./RoadmapCard";
import { DailyMissionCard } from "./DailyMissionCard";
import { EmptyState } from "./ui/primitives";

type QuickTab = "analyze" | "chat" | "assist" | "quiz" | "dict";

type Props = {
  studentName: string;
  classCode: string;
  studentNumber: string;
  activeId: string;
  dict: DictEntry[];
  onJump: (tab: QuickTab) => void;
  onXP?: (delta: number, kind: string, note?: string) => void;
};

export function HomeTab({
  studentName,
  classCode,
  studentNumber,
  activeId,
  dict,
  onJump,
  onXP,
}: Props) {
  const engagement = useEngagementStore((s) => s.byStudent[activeId]);

  const stats = useMemo(() => {
    const registered = dict.filter((d) => d.suggested_by === activeId).length;
    const reflections = engagement?.journals?.length ?? 0;
    const badges = engagement?.unlockedBadges?.length ?? 0;
    const roleplay = engagement?.roleplayCleared?.length ?? 0;
    return { registered, reflections, badges, roleplay };
  }, [dict, engagement, activeId]);

  // 새 배지 획득 시 가벼운 축하 애니메이션 (scale + fade). 이전 카운트 대비 증가만 트리거.
  const prevBadges = useRef<number | null>(null);
  const [badgeCelebrate, setBadgeCelebrate] = useState(false);
  useEffect(() => {
    if (prevBadges.current !== null && stats.badges > prevBadges.current) {
      setBadgeCelebrate(true);
      const t = window.setTimeout(() => setBadgeCelebrate(false), 900);
      return () => window.clearTimeout(t);
    }
    prevBadges.current = stats.badges;
  }, [stats.badges]);

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
    iconBg: string;
    btn: string;
    btnText: string;
  }[] = [
    {
      key: "analyze",
      title: "표현 찾아보기",
      desc: "궁금한 디지털 언어를 검색하고 뜻을 확인해요.",
      icon: <Search className="h-6 w-6 text-primary" />,
      iconBg: "bg-primary/10",
      btn: "bg-primary hover:bg-primary/90 focus:ring-primary/40",
      btnText: "text-primary-foreground",
    },
    {
      key: "dict",
      title: "참여 사전",
      desc: "새로운 표현을 직접 등록하고 사전을 함께 만들어요.",
      icon: <BookOpen className="h-6 w-6 text-secondary" />,
      iconBg: "bg-secondary/10",
      btn: "bg-secondary hover:bg-secondary/90 focus:ring-secondary/40",
      btnText: "text-secondary-foreground",
    },
    {
      key: "quiz",
      title: "퀴즈 놀이터",
      desc: "재미있는 퀴즈를 풀며 실력을 쌓아요.",
      icon: <Lightbulb className="h-6 w-6 text-accent" />,
      iconBg: "bg-accent/10",
      btn: "bg-accent hover:bg-accent/90 focus:ring-accent/40",
      btnText: "text-accent-foreground",
    },
    {
      key: "assist",
      title: "나의 표현 돌아보기",
      desc: "나의 생각과 성찰을 기록하며 돌아봐요.",
      icon: <NotebookPen className="h-6 w-6 text-purple" />,
      iconBg: "bg-purple/10",
      btn: "bg-purple hover:bg-purple/90 focus:ring-purple/40",
      btnText: "text-white",
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

            {/* Hero illustration — 바른말 수호대 학생 일러스트 */}
            <div className="mt-2 w-full max-w-md">
              <img
                src={heroIllustration.url}
                alt="태블릿과 책으로 바른말을 배우는 두 학생 일러스트"
                width={1600}
                height={1024}
                fetchPriority="high"
                decoding="async"
                className="w-full h-auto select-none"
              />
            </div>

            {/* 오늘의 미션 */}
            <div className="mt-4 w-full max-w-md rounded-2xl border border-rose-100 bg-white/80 backdrop-blur px-4 py-3 text-left">
              <div className="flex items-center gap-2 text-[11px] font-black text-rose-600 uppercase tracking-wider">
                <Flag className="h-3.5 w-3.5" />
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

        {/* 오늘의 상황 미션 */}
        <DailyMissionCard activeId={activeId} onXP={onXP} />

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
          className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-soft)]"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-black text-navy">바로 시작하기</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quicks.map((q) => (
              <div
                key={q.key}
                className="group flex flex-col rounded-[20px] border border-border bg-white p-4 sm:p-5 shadow-[var(--shadow-soft)] transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
              >
                <div
                  className={`grid h-12 w-12 place-items-center rounded-2xl ${q.iconBg} mb-3 transition-transform duration-200 group-hover:scale-105`}
                >
                  {q.icon}
                </div>
                <div className="font-black text-sm text-navy">{q.title}</div>
                <div className="mt-1 flex-1 text-[11px] leading-snug text-muted-foreground">
                  {q.desc}
                </div>
                <button
                  type="button"
                  onClick={() => onJump(q.key)}
                  className={`mt-4 w-full rounded-xl px-3 py-2.5 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background ${q.btnText} ${q.btn}`}
                >
                  시작하기
                </button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
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
            <StatRow
              label="등록한 표현"
              value={`${stats.registered}개`}
              accent="text-emerald-600"
            />
            <StatRow label="완료한 역할극" value={`${stats.roleplay}개`} accent="text-orange-600" />
            <StatRow
              label="작성한 성찰"
              value={`${stats.reflections}개`}
              accent="text-purple-600"
            />
            <StatRow
              label="받은 배지"
              value={`${stats.badges}개`}
              accent="text-amber-600"
              pulse={badgeCelebrate}
            />
          </ul>
        </section>

        <section
          aria-label="최근 활동"
          className="rounded-3xl border border-slate-200 bg-white p-4"
        >
          <h3 className="text-sm font-black text-[color:var(--navy)] mb-3">최근 활동</h3>
          {recent.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="아직 활동 기록이 없어요"
              description={
                <>
                  왼쪽 <b>바로 시작하기</b> 에서 첫 활동을 시작해 보세요!
                </>
              }
            />
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
  pulse,
}: {
  label: string;
  value: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="text-slate-600">{label}</span>
      <span
        className={`font-black ${accent} ${pulse ? "animate-scale-in" : ""}`}
        aria-live={pulse ? "polite" : undefined}
      >
        {value}
        {pulse && (
          <span className="ml-1 inline-block animate-fade-in" aria-hidden>
            ✨
          </span>
        )}
      </span>
    </li>
  );
}
