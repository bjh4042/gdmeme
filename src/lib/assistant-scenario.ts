/**
 * AI 수호비서 응답 품질 고도화 레이어
 *
 *  Intent(대분류) → Scenario(세부 상황) → Goal(질문 목적) 3단 해석과
 *  목적별 응답 구성(순서·길이·생략), 공감 문장 그룹, 순화 표현 은행,
 *  학습 흐름형 추천 질문을 제공한다.
 *
 *  ❌ UI·DB·Cloud·XP·STEP·배지 로직을 변경하지 않는다.
 *  ✅ 순수 함수 모듈 (React import 금지)
 */

import type { AssistantIntent, AssistantContext, AssistantSuggestion } from "./assistant-intent";

// ─────────────────────────────────────────────────────────────
// 1) 질문 목적 (Intent Goal)
// ─────────────────────────────────────────────────────────────

export type QuestionGoal =
  | "definition" // 뜻·정보 요청        → 짧게
  | "reason" // 왜 안 되나요        → 설명 중심
  | "practice" // 어떻게 하지         → 체크리스트
  | "example" // 예시 문장 요청       → 문장 중심
  | "counsel" // 고민 상담           → 공감 중심
  | "procedure" // 신고·위기 절차       → 행동 절차 중심
  | "etiquette" // 예절·규칙 목록       → 목록형
  | "permission"; // 해도 되나요         → 판단 중심

const G = {
  definition: ["무슨 뜻", "뜻이", "뜻은", "뜻 알려", "의미", "뭐예요", "뭔가요", "뭐야", "이란", "이 뭐"],
  reason: ["왜", "이유", "안 되나요", "안돼요", "안 돼요", "나쁜가요", "위험한가요", "문제가"],
  practice: ["어떻게 해", "어떻게 하", "방법", "실천", "하려면", "무엇을 해", "뭘 해", "어떡해", "어떻게 도와"],
  example: ["뭐라고 말", "어떻게 말", "예시", "문장", "말해 주세요", "말을 알려", "표현 알려", "대신"],
  counsel: ["속상", "슬퍼", "힘들", "고민", "괴로", "무서", "싫어요", "당했", "나를", "저를", "울었"],
  procedure: ["신고", "선생님께", "알려야", "도와주세요", "학교폭력", "협박", "계속 괴롭", "차단"],
  etiquette: ["예절", "예의", "규칙", "지켜야", "매너"],
  permission: ["해도 되", "써도 되", "괜찮나요", "괜찮아요", "보내도 되", "올려도 되"],
};

const GOAL_ORDER: QuestionGoal[] = [
  "procedure",
  "definition",
  "permission",
  "reason",
  "etiquette",
  "example",
  "practice",
  "counsel",
];

export function detectGoal(t: string, ctx: AssistantContext): QuestionGoal {
  const hit = (arr: string[]) => arr.some((w) => t.includes(w));
  const found = new Set<QuestionGoal>();
  (Object.keys(G) as QuestionGoal[]).forEach((k) => {
    if (hit(G[k as keyof typeof G])) found.add(k);
  });

  // 뜻 질문 + 상담 표현이 함께면 상담이 우선한다.
  if (found.has("counsel") && ctx.role === "victim") return "counsel";
  if (ctx.needsAdultHelp) return "procedure";
  for (const g of GOAL_ORDER) if (found.has(g)) return g;
  return ctx.role === "victim" || ctx.role === "observer" ? "counsel" : "practice";
}

export const GOAL_LABEL: Record<QuestionGoal, string> = {
  definition: "정보 요청",
  reason: "이유 설명",
  practice: "실천 방법",
  example: "예시 문장 요청",
  counsel: "고민 상담",
  procedure: "행동 절차",
  etiquette: "예절 안내",
  permission: "판단 요청",
};

// ─────────────────────────────────────────────────────────────
// 2) 공감 문장 그룹 (질문 유형별 고정 그룹 · 그룹 내 2~5개 순환)
// ─────────────────────────────────────────────────────────────

const EMPATHY: Record<QuestionGoal, string[]> = {
  definition: ["좋은 질문이야.", "궁금해하는 마음이 참 좋아.", "그 말, 함께 알아보자.", "잘 물어봤어."],
  reason: ["왜 그런지 묻는 건 정말 중요한 태도야.", "이유를 알면 훨씬 잘 지킬 수 있어.", "생각이 깊구나."],
  practice: ["함께 해결 방법을 생각해 보자.", "실천하려는 마음이 벌써 멋져.", "하나씩 같이 해 보자."],
  example: ["어떤 말을 할지 고민했구나.", "함께 문장을 만들어 보자.", "말을 고르려는 마음이 고마워."],
  counsel: ["많이 속상했겠다.", "그 마음, 충분히 이해돼.", "혼자 참느라 힘들었겠구나.", "말해 줘서 고마워."],
  procedure: ["많이 놀랐겠구나. 지금부터 하나씩 하자.", "혼자 두지 않을게.", "잘 이야기해 줬어. 바로 도와줄게."],
  etiquette: ["예절을 챙기려는 마음이 좋아.", "함께 지킬 약속을 살펴보자.", "좋은 질문이야."],
  permission: ["망설여졌구나. 잘 물어봤어.", "먼저 물어본 게 아주 잘한 일이야.", "함께 판단해 보자."],
};

const APOLOGY_EMPATHY = ["용기 내어 말해 줘서 고마워.", "잘못을 알아차린 것부터가 큰 걸음이야."];
const CONFLICT_EMPATHY = ["많이 당황했겠구나.", "마음이 복잡했겠다.", "그 상황이면 누구나 힘들어."];

const recent: string[] = [];

export function pickEmpathy(
  goal: QuestionGoal,
  ctx: AssistantContext,
  scenarioKey: string,
  seed: number,
): string {
  let pool = EMPATHY[goal];
  if (scenarioKey.includes("apology") || ctx.role === "actor") pool = APOLOGY_EMPATHY.concat(pool.slice(0, 2));
  else if (scenarioKey.includes("conflict") || scenarioKey.includes("exclusion"))
    pool = CONFLICT_EMPATHY.concat(pool.slice(0, 2));

  const fresh = pool.filter((p) => !recent.includes(p));
  const use = fresh.length > 0 ? fresh : pool;
  const line = use[Math.abs(seed) % use.length];
  recent.push(line);
  if (recent.length > 4) recent.shift();
  return line;
}

// ─────────────────────────────────────────────────────────────
// 3) 순화 표현 은행 (학생이 그대로 사용할 수 있는 문장)
// ─────────────────────────────────────────────────────────────

export const EXPRESSION_BANK: Record<string, string[]> = {
  욕설: [
    "지금 화가 많이 났어. 잠깐 쉬었다 이야기하자.",
    "그 말은 나한테 상처가 됐어.",
    "네가 그렇게 말하면 속상해. 그만해 줘.",
    "나는 이렇게 하고 싶었어. 네 생각도 말해 줄래?",
    "마음이 복잡해. 조금만 기다려 줄래?",
  ],
  놀림: [
    "그건 장난이라도 기분이 나빠. 하지 말아 줘.",
    "○○아, 나는 네 편이야.",
    "그 얘기는 그만하자.",
    "너는 너대로 멋져.",
    "오늘 네 이야기 재미있었어.",
  ],
  사과: [
    "아까 내가 한 말 미안해. 다시 생각해 보니 네가 속상했겠어.",
    "내가 잘못했어. 앞으로는 그렇게 말하지 않을게.",
    "미안해. 내가 어떻게 하면 좋을지 말해 줄래?",
    "네 마음을 늦게 알아서 미안해.",
  ],
  공감: [
    "많이 속상했겠다.",
    "그럴 수 있어. 내가 들어 줄게.",
    "혼자 힘들었겠구나. 같이 있어 줄게.",
    "네 마음이 이해돼.",
  ],
  거절: [
    "미안한데 지금은 어려울 것 같아.",
    "그건 하고 싶지 않아. 다른 걸로 하면 어때?",
    "오늘은 안 될 것 같아. 다음에 같이 하자.",
    "그건 내가 지키고 싶은 거라 알려 줄 수 없어.",
  ],
  칭찬: [
    "오늘 발표 목소리가 또렷해서 잘 들렸어.",
    "네가 도와줘서 정말 고마웠어.",
    "그 부분 아이디어가 좋았어.",
    "같이 하니까 훨씬 재미있어.",
  ],
  부탁: [
    "미안한데 이것 좀 도와줄 수 있을까?",
    "혹시 시간 될 때 같이 해 줄래?",
    "부탁해도 될까? 고마워.",
  ],
  단톡방: [
    "그 얘기는 그만하자.",
    "○○아, 괜찮아? 따로 이야기할래?",
    "여기서는 서로 기분 좋은 말만 하자.",
    "아까 내가 쓴 말 지울게. 미안해.",
  ],
  게임: [
    "괜찮아, 다음 판에 같이 해 보자.",
    "잘했어! 방금 그거 멋졌어.",
    "지금은 힘들면 잠깐 쉬어도 돼.",
    "좋은 경기였어. 고마워.",
  ],
  도움요청: [
    "선생님, 드릴 말씀이 있어요. 잠깐 시간 괜찮으세요?",
    "혼자 해결하기 어려워서 도와주셨으면 해요.",
    "이런 일이 있었어요. 언제, 어디서 있었는지 말씀드릴게요.",
  ],
};

// ─────────────────────────────────────────────────────────────
// 4) Scenario 분기 — 기존 Intent 안에서 상황을 나눈다
// ─────────────────────────────────────────────────────────────

export type Scenario = {
  key: string;
  label: string;
  judgement?: string;
  reason?: string;
  actions?: string[];
  steps?: string[];
  think?: string;
  bank?: string; // EXPRESSION_BANK 키
};

const any = (t: string, ws: string[]) => ws.some((w) => t.includes(w));

const SCEN: Partial<Record<AssistantIntent, (t: string, ctx: AssistantContext) => Scenario>> = {
  group_chat: (t, ctx) => {
    if (any(t, ["초대", "들어오래", "부르는데", "초대 거절"]))
      return {
        key: "group_chat.invite_decline",
        label: "단톡방 초대 거절",
        judgement: "들어가고 싶지 않은 대화방은 거절해도 괜찮아.",
        reason: "대화방에 들어가면 그 안의 말과 분위기에 계속 노출돼. 내가 편하지 않은 곳은 안 들어가도 돼.",
        bank: "거절",
        think: "거절할 때 내 마음을 다치지 않게 말하는 방법은 뭘까?",
      };
    if (any(t, ["신고", "선생님께", "알려야", "너무 심해"]))
      return {
        key: "group_chat.report",
        label: "단톡방 신고",
        judgement: "대화방에서 벌어진 일도 어른께 알릴 수 있어.",
        steps: [
          "1) 화면을 저장(캡처)해 둔다.",
          "2) 대꾸하지 않고 대화방에서 나오거나 알림을 끈다.",
          "3) 오늘 안에 선생님이나 보호자에게 화면을 보여 준다.",
          "4) 언제·어디서·누가 한 일인지 순서대로 말한다.",
        ],
        bank: "도움요청",
      };
    if (any(t, ["미안", "사과", "내가 한 말", "지울"]))
      return {
        key: "group_chat.apology",
        label: "단톡방 사과",
        judgement: "여러 명이 본 말일수록 사과도 그 자리에서 하는 게 좋아.",
        bank: "사과",
        think: "사과 뒤에 내가 바꿀 행동 한 가지는 뭘까?",
      };
    if (any(t, ["도와", "편들", "친구가 놀림", "친구를 돕"]))
      return {
        key: "group_chat.help_friend",
        label: "단톡방에서 친구 돕기",
        judgement: "한 사람만 말려도 놀림은 멈출 수 있어.",
        bank: "단톡방",
        think: "내가 그 친구였다면 누가 어떤 말을 해 주길 바랐을까?",
      };
    if (any(t, ["가만히", "보고만", "아무 말", "구경", "방관"]))
      return {
        key: "group_chat.bystander",
        label: "단톡방 방관",
        judgement: "읽고 가만히 있는 것도 놀림을 이어지게 할 수 있어.",
        reason: "웃는 이모티콘 하나도 '괜찮다'는 신호로 보여. 반대로 짧은 한마디는 분위기를 바꿔.",
        bank: "단톡방",
      };
    if (any(t, ["따돌", "나만 빼", "초대 안", "혼자 남", "나가라"]) || ctx.role === "victim")
      return {
        key: "group_chat.exclusion",
        label: "단톡방 따돌림",
        judgement: "여러 명이 한 사람을 빼놓는 건 장난이 아니라 따돌림이야. 네 잘못이 아니야.",
        steps: [
          "1) 화면을 저장해 둔다.",
          "2) 혼자 참지 말고 오늘 안에 선생님이나 보호자에게 말한다.",
          "3) 그 방에 계속 있을 필요는 없어. 나와도 괜찮아.",
        ],
        bank: "도움요청",
      };
    if (any(t, ["예절", "지켜야", "규칙"]))
      return {
        key: "group_chat.etiquette",
        label: "단톡방 예절",
        judgement: "대화방에는 여러 사람이 함께 있어서 지킬 약속이 필요해.",
        actions: [
          "• 늦은 밤에는 메시지를 보내지 않기",
          "• 친구 사진·이야기는 허락 없이 올리지 않기",
          "• 읽고 답이 늦어도 재촉하지 않기",
          "• 장난도 한 사람만 대상이 되면 멈추기",
          "• 나가는 친구를 붙잡거나 놀리지 않기",
        ],
        bank: "단톡방",
      };
    return { key: "group_chat.general", label: "단톡방 대화", bank: "단톡방" };
  },

  profanity: (t, ctx) => {
    if (any(t, ["왜 욕", "왜 나쁜", "왜 하면 안"]))
      return {
        key: "profanity.reason",
        label: "욕이 나쁜 이유",
        judgement: "욕은 내 마음을 전하지 못하고 상대를 공격해 버려.",
        bank: "욕설",
      };
    if (any(t, ["대신", "바꾸", "뭐라고"]))
      return { key: "profanity.rewrite", label: "욕 대신 쓸 말", bank: "욕설" };
    if (ctx.role === "actor")
      return {
        key: "profanity.i_said",
        label: "내가 욕했을 때",
        judgement: "이미 한 말은 되돌릴 수 없지만, 지금 사과하면 마음은 돌릴 수 있어.",
        bank: "사과",
      };
    if (ctx.role === "victim" || any(t, ["들었", "친구가 욕"]))
      return {
        key: "profanity.heard",
        label: "욕을 들었을 때",
        judgement: "욕을 들으면 놀라고 화가 나는 게 당연해. 네 잘못이 아니야.",
        bank: "욕설",
      };
    if (any(t, ["뜻", "무슨 말"]))
      return { key: "profanity.meaning", label: "욕의 뜻", bank: "욕설" };
    return { key: "profanity.general", label: "욕설", bank: "욕설" };
  },

  appearance_teasing: (t, ctx) => {
    if (ctx.role === "victim" || any(t, ["나를", "저를", "놀림받", "들었"]))
      return {
        key: "appearance.victim",
        label: "외모 놀림을 당함",
        judgement: "네 생김새는 놀림의 이유가 될 수 없어. 잘못은 놀린 쪽에 있어.",
        bank: "놀림",
      };
    if (ctx.role === "actor" || any(t, ["내가 놀", "미안", "사과"]))
      return { key: "appearance.apology", label: "외모 놀림 사과", bank: "사과" };
    if (any(t, ["봤어", "친구들이", "구경", "도와"]))
      return { key: "appearance.bystander", label: "놀림을 목격함", bank: "놀림" };
    return { key: "appearance.general", label: "외모 놀림", bank: "놀림" };
  },

  friend_conflict: (t, ctx) => {
    if (any(t, ["사과", "미안", "용서"]))
      return { key: "conflict.apology", label: "사과하기", bank: "사과" };
    if (any(t, ["화해", "다시 친해", "풀고 싶"]))
      return {
        key: "conflict.reconcile",
        label: "화해하기",
        judgement: "먼저 손 내미는 건 지는 게 아니라 용기야.",
        bank: "사과",
      };
    if (any(t, ["오해", "안 그랬", "억울"]))
      return {
        key: "conflict.misunderstanding",
        label: "오해 풀기",
        judgement: "오해는 '무슨 일이 있었는지'를 차분히 나누면 풀 수 있어.",
        bank: "공감",
      };
    if (any(t, ["절교", "안 놀아", "빼고", "따돌"]))
      return {
        key: "conflict.exclusion",
        label: "따돌림·절교",
        judgement: "누군가를 빼놓는 약속은 장난이 아니라 상처가 돼.",
        bank: "공감",
      };
    return { key: "conflict.general", label: "친구 갈등", bank: "공감" };
  },

  game_chat: (t) => {
    if (any(t, ["예절", "규칙", "지켜야"]))
      return {
        key: "game.etiquette",
        label: "게임 채팅 예절",
        actions: [
          "• 지고 있는 팀원에게 탓하는 말 하지 않기",
          "• 'ez', '못한다' 같은 말 대신 응원하기",
          "• 화가 나면 채팅 대신 잠깐 쉬기",
          "• 개인정보(이름·학교·전화번호) 말하지 않기",
        ],
        bank: "게임",
      };
    if (any(t, ["욕", "들었", "탓", "화내"]))
      return { key: "game.heard_abuse", label: "게임에서 욕을 들음", bank: "게임" };
    if (any(t, ["칭찬", "응원"]))
      return { key: "game.praise", label: "팀원 칭찬", bank: "칭찬" };
    return { key: "game.general", label: "게임 채팅", bank: "게임" };
  },

  cyberbullying: (t, ctx) =>
    ctx.role === "actor"
      ? { key: "cyber.actor", label: "내가 한 경우", bank: "사과" }
      : any(t, ["봤", "친구가 당", "도와"])
        ? { key: "cyber.bystander", label: "목격했을 때", bank: "도움요청" }
        : { key: "cyber.victim", label: "피해를 입었을 때", bank: "도움요청" },

  manners: (t) =>
    any(t, ["거절"])
      ? { key: "manners.decline", label: "예의 있게 거절", bank: "거절" }
      : any(t, ["칭찬"])
        ? { key: "manners.praise", label: "칭찬하기", bank: "칭찬" }
        : any(t, ["부탁"])
          ? { key: "manners.request", label: "부탁하기", bank: "부탁" }
          : { key: "manners.general", label: "예절", bank: "부탁" },

  empathy: (t) =>
    any(t, ["친구", "위로", "도와"])
      ? { key: "empathy.comfort_friend", label: "친구 위로하기", bank: "공감" }
      : { key: "empathy.my_feeling", label: "내 마음 표현", bank: "공감" },

  rewrite: (t) =>
    any(t, ["사과"])
      ? { key: "rewrite.apology", label: "사과 문장 만들기", bank: "사과" }
      : any(t, ["거절"])
        ? { key: "rewrite.decline", label: "거절 문장 만들기", bank: "거절" }
        : { key: "rewrite.general", label: "바른말로 바꾸기", bank: "욕설" },

  help_report: () => ({
    key: "help.report",
    label: "도움 요청",
    steps: [
      "1) 지금 안전한지 먼저 확인한다.",
      "2) 언제·어디서·누가·무슨 일이 있었는지 메모한다.",
      "3) 증거(화면 저장)가 있으면 함께 준비한다.",
      "4) 오늘 안에 선생님이나 보호자에게 말한다.",
      "5) 혼자 해결하려고 하지 않는다.",
    ],
    bank: "도움요청",
  }),
};

export function detectScenario(
  intent: AssistantIntent,
  t: string,
  ctx: AssistantContext,
): Scenario {
  const fn = SCEN[intent];
  return fn ? fn(t, ctx) : { key: `${intent}.general`, label: intent };
}

// ─────────────────────────────────────────────────────────────
// 5) 목적별 응답 구성 (순서·생략·길이)
// ─────────────────────────────────────────────────────────────

export type SectionKey = "empathy" | "judgement" | "meaning" | "reason" | "examples" | "steps" | "think";

export const LAYOUT: Record<QuestionGoal, SectionKey[]> = {
  definition: ["meaning", "judgement", "examples", "think"],
  reason: ["empathy", "judgement", "reason", "think"],
  practice: ["empathy", "steps", "examples", "think"],
  example: ["empathy", "examples", "judgement", "think"],
  counsel: ["empathy", "judgement", "reason", "examples", "steps", "think"],
  procedure: ["empathy", "judgement", "steps", "examples", "think"],
  etiquette: ["judgement", "examples", "think"],
  permission: ["empathy", "judgement", "reason", "examples"],
};

/** 목적별 예시 문장 개수 (길이 다양화) */
export const EXAMPLE_COUNT: Record<QuestionGoal, number> = {
  definition: 2,
  reason: 2,
  practice: 4,
  example: 5,
  counsel: 3,
  procedure: 3,
  etiquette: 5,
  permission: 2,
};

// ─────────────────────────────────────────────────────────────
// 6) 학습 흐름형 추천 질문
// ─────────────────────────────────────────────────────────────

const Q = (icon: string, label: string, prompt: string): AssistantSuggestion => ({ icon, label, prompt });

const FLOW: Record<string, AssistantSuggestion[]> = {
  "profanity.reason": [
    Q("🌱", "욕 대신 쓸 말", "욕 대신 어떻게 말하면 좋아요?"),
    Q("🛡️", "친구가 계속 욕하면", "친구가 계속 욕을 하면 어떻게 해요?"),
    Q("🙏", "사과하는 말", "내가 욕한 친구에게 어떻게 사과해요?"),
  ],
  "profanity.rewrite": [
    Q("🤔", "왜 욕을 쓰게 될까", "사람들은 왜 욕을 쓰게 되나요?"),
    Q("🛡️", "욕을 들었을 때", "친구에게 욕을 들었을 때 어떻게 해야 하나요?"),
    Q("🙏", "사과하는 말", "친구에게 진심으로 사과하는 말을 알려 주세요."),
  ],
  "profanity.heard": [
    Q("🙋", "선생님께 말하기", "선생님께 도움을 요청하려면 어떻게 말해요?"),
    Q("💗", "내 마음 말하기", "속상한 마음을 친구에게 어떻게 말해요?"),
    Q("🌱", "욕 대신 쓸 말", "욕 대신 어떻게 말하면 좋아요?"),
  ],
  "profanity.i_said": [
    Q("🙏", "사과 문장", "친구에게 진심으로 사과하는 말을 알려 주세요."),
    Q("🤝", "화해하는 방법", "다툰 친구와 화해하려면 어떻게 말해요?"),
    Q("🌱", "다음엔 이렇게", "화가 났을 때 어떻게 말하면 좋아요?"),
  ],
  "group_chat.exclusion": [
    Q("🙋", "선생님께 말하기", "선생님께 도움을 요청하려면 어떻게 말해요?"),
    Q("🤝", "친구 도와주기", "단톡방에서 놀림받는 친구를 어떻게 도와줘요?"),
    Q("🚪", "초대 거절하기", "들어가기 싫은 단톡방 초대를 어떻게 거절해요?"),
  ],
  "group_chat.bystander": [
    Q("🤝", "친구 도와주기", "단톡방에서 놀림받는 친구를 어떻게 도와줘요?"),
    Q("💬", "단톡방 예절", "단톡방에서 지켜야 할 예절은 무엇인가요?"),
    Q("🙋", "선생님께 알리기", "단톡방 일을 선생님께 어떻게 말씀드려요?"),
  ],
  "group_chat.etiquette": [
    Q("🤝", "친구 도와주기", "단톡방에서 놀림받는 친구를 어떻게 도와줘요?"),
    Q("🙏", "단톡방 사과", "단톡방에서 한 말을 사과하려면 어떻게 해요?"),
    Q("🚪", "초대 거절하기", "들어가기 싫은 단톡방 초대를 어떻게 거절해요?"),
  ],
  "group_chat.apology": [
    Q("💞", "친구 마음 알기", "놀림을 받은 친구의 마음은 어떨까요?"),
    Q("💬", "단톡방 예절", "단톡방에서 지켜야 할 예절은 무엇인가요?"),
    Q("🌱", "다음엔 이렇게", "화가 났을 때 어떻게 말하면 좋아요?"),
  ],
  "appearance.victim": [
    Q("💗", "내 마음 말하기", "속상한 마음을 친구에게 어떻게 말해요?"),
    Q("🙋", "선생님께 말하기", "선생님께 도움을 요청하려면 어떻게 말해요?"),
    Q("🌟", "칭찬하는 말", "친구를 기분 좋게 칭찬하는 말을 알려 주세요."),
  ],
  "appearance.apology": [
    Q("🙏", "사과 문장", "친구에게 진심으로 사과하는 말을 알려 주세요."),
    Q("💞", "친구 마음 알기", "놀림을 받은 친구의 마음은 어떨까요?"),
    Q("🌟", "칭찬하는 말", "친구를 기분 좋게 칭찬하는 말을 알려 주세요."),
  ],
  "conflict.apology": [
    Q("🤝", "화해하는 방법", "다툰 친구와 화해하려면 어떻게 말해요?"),
    Q("💞", "공감 표현", "친구 마음에 공감하는 말은 어떻게 하나요?"),
    Q("🤔", "친구 마음", "친구는 그때 어떤 마음이었을까요?"),
  ],
  "conflict.reconcile": [
    Q("🙏", "사과 문장", "친구에게 진심으로 사과하는 말을 알려 주세요."),
    Q("💬", "대화 시작하기", "다툰 친구에게 어떻게 먼저 말을 걸어요?"),
    Q("💞", "공감 표현", "친구 마음에 공감하는 말은 어떻게 하나요?"),
  ],
  "game.etiquette": [
    Q("🛡️", "욕을 들었을 때", "게임에서 욕을 들으면 어떻게 해야 하나요?"),
    Q("💗", "팀원 칭찬하기", "게임에서 팀원을 칭찬하는 말을 알려 주세요."),
    Q("🔒", "게임 개인정보", "게임에서 이름이나 학교를 말해도 되나요?"),
  ],
  "help.report": [
    Q("📸", "증거 남기기", "온라인에서 괴롭힘을 당하면 무엇을 남겨 둬야 해요?"),
    Q("💬", "무슨 말부터 할까", "선생님께 무슨 말부터 시작하면 좋아요?"),
    Q("💞", "마음 돌보기", "속상한 마음을 어떻게 달래요?"),
  ],
  "manners.decline": [
    Q("🙏", "부탁하는 말", "친구에게 정중하게 부탁하는 말을 알려 주세요."),
    Q("💗", "칭찬하는 말", "친구를 기분 좋게 칭찬하는 말을 알려 주세요."),
    Q("🤝", "거절 뒤 관계", "거절한 뒤에 친구와 어색하면 어떻게 해요?"),
  ],
};

/** 목적에 따라 다음 학습 단계를 이어 주는 추천 질문 */
const GOAL_NEXT: Partial<Record<QuestionGoal, AssistantSuggestion>> = {
  definition: Q("🤔", "왜 조심해야 할까", "이 말은 왜 조심해서 써야 하나요?"),
  reason: Q("🌱", "그럼 어떻게 말할까", "그럼 대신 어떻게 말하면 좋아요?"),
  practice: Q("🙏", "사과가 필요하면", "친구에게 진심으로 사과하는 말을 알려 주세요."),
  example: Q("🎯", "직접 연습하기", "방금 배운 말을 언제 써 보면 좋을까요?"),
  counsel: Q("🙋", "도움 요청하기", "선생님께 도움을 요청하려면 어떻게 말해요?"),
  procedure: Q("💞", "마음 돌보기", "속상한 마음을 어떻게 달래요?"),
};

export function flowSuggestions(
  scenarioKey: string,
  goal: QuestionGoal,
  fallback: AssistantSuggestion[],
): AssistantSuggestion[] {
  const base = FLOW[scenarioKey] ?? fallback;
  const next = GOAL_NEXT[goal];
  const out = [...base];
  if (next && !out.some((s) => s.prompt === next.prompt)) out.push(next);
  return out.slice(0, 4);
}
