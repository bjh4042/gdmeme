// 각 탭이 로드맵 어느 단계와 연결되는지, 이 탭에서 배우는 내용과 다음 활동을
// 한 곳에서 정의하는 SSOT. 화면 상단 배너에서만 참조하여 중복 안내를 방지한다.
import { STAGES, type StageKey } from "./roadmap";

export type LiteracyTab = "analyze" | "chat" | "assist" | "quiz" | "dict";

export type StageContext = {
  stage: StageKey;
  stageOrder: number;
  stageTitle: string;
  icon: string;
  goal: string;
  next?: string;
};

const TAB_GOALS: Record<LiteracyTab, { goal: string; nextTab?: LiteracyTab }> = {
  analyze: {
    goal: "댓글·채팅 속 표현을 살펴보고 뜻과 유래를 함께 찾아봐요.",
    nextTab: "dict",
  },
  dict: {
    goal: "표현의 뜻·출처·유해 요소를 자세히 파헤쳐 봐요.",
    nextTab: "assist",
  },
  assist: {
    goal: "그 말을 들은 친구의 기분과 상황을 함께 생각해 봐요.",
    nextTab: "chat",
  },
  chat: {
    goal: "상황에 맞는 더 존중하는 표현으로 바꾸어 말해 봐요.",
    nextTab: "quiz",
  },
  quiz: {
    goal: "배운 내용을 확인하고 오늘 실천할 한 가지를 정해 봐요.",
    nextTab: undefined,
  },
};

const NEXT_LABEL: Record<LiteracyTab, string> = {
  analyze: "밈 분석기",
  dict: "우리말 사전",
  assist: "AI 수호비서",
  chat: "예절 역할극",
  quiz: "스피드 퀴즈",
};

export function stageContextForTab(tab: LiteracyTab): StageContext {
  const meta = STAGES.find((s) => s.tabHint === tab) ?? STAGES[0];
  const g = TAB_GOALS[tab];
  return {
    stage: meta.key,
    stageOrder: meta.order,
    stageTitle: meta.title,
    icon: meta.icon,
    goal: g.goal,
    next: g.nextTab ? NEXT_LABEL[g.nextTab] : undefined,
  };
}