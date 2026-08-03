/**
 * AI 수호비서 V2 — Intent-first 응답 엔진
 *
 * 역할: 학생 입력을 (1) 의도(Intent) → (2) 상황(Context) 순으로 해석한 뒤,
 *       (3) 공감 → 핵심 판단 → 이유 → 바른 행동 제안 → 추가 생각거리
 *       5단 구조의 답변과 (4) 의도 기반 추천 질문을 생성한다.
 *
 *   ❌ UI·DB·Cloud·데이터셋·XP·STEP·배지 로직을 변경하지 않는다.
 *   ✅ 순수 함수 모듈. React import 금지.
 */

export type AssistantIntent =
  | "slang_meaning" // ① 유행어 뜻
  | "profanity" // ② 비속어·욕설
  | "rewrite" // ③ 바른말 바꾸기
  | "friend_conflict" // ④ 친구 갈등
  | "appearance_teasing" // ⑤ 외모 놀림
  | "rumor" // ⑥ 소문
  | "cyberbullying" // ⑦ 사이버폭력
  | "group_chat" // ⑧ 단톡방 갈등
  | "game_chat" // ⑨ 게임 채팅
  | "privacy" // ⑩ 개인정보
  | "ai_usage" // ⑪ AI 사용
  | "manners" // ⑫ 예절
  | "empathy" // ⑬ 공감
  | "help_report" // ⑭ 신고·도움 요청
  | "fact_check" // ⑮ 사실 확인
  | "other"; // ⑯ 기타

export type StudentRole = "victim" | "actor" | "observer" | "unknown";
export type ActionTense = "done" | "planning" | "asking";

export type AssistantContext = {
  who: string[]; // 등장 인물 (친구, 옆반 친구, 선생님 …)
  where: string | null; // 단톡방 / 게임 / 교실 / 인터넷
  what: string | null; // 핵심 행동 요약
  role: StudentRole; // 피해자 / 가해자 / 관찰자
  tense: ActionTense; // 이미 했는지 / 하려는지 / 묻는지
  term: string | null; // 뜻을 묻는 낱말
  needsAdultHelp: boolean;
};

export type AssistantAnalysis = {
  intent: AssistantIntent;
  candidates: AssistantIntent[];
  confidence: number; // 0~1
  context: AssistantContext;
  /** 질문 목적 (정보/이유/실천/예시/상담/절차/예절/판단) */
  goal?: import("./assistant-scenario").QuestionGoal;
  /** Intent 안의 세부 상황 분기 키 */
  scenarioKey?: string;
  scenarioLabel?: string;
};

export type AssistantSuggestion = { icon: string; label: string; prompt: string };

export type AssistantComposed = {
  text: string;
  analysis: AssistantAnalysis;
  suggestions: AssistantSuggestion[];
};

// ─────────────────────────────────────────────────────────────
// 0) 전처리
// ─────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[?？!！.。,·:;()[\]{}<>"'`~@#$%^&*+=\\/|_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function has(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w.toLowerCase()));
}

function countHits(text: string, words: string[]): number {
  return words.reduce((n, w) => (text.includes(w.toLowerCase()) ? n + 1 : n), 0);
}

// ─────────────────────────────────────────────────────────────
// 1) Intent 분류 — 키워드 단독이 아니라 "행위 + 대상 + 목적" 조합으로 판단
// ─────────────────────────────────────────────────────────────

const W = {
  meaningAsk: ["무슨 뜻", "뜻이", "뜻은", "뜻 알려", "의미", "무슨말", "무슨 말", "뜻이야", "뜻이에요"],
  rewriteAsk: [
    "바꾸고 싶",
    "바꿔",
    "바꾸려",
    "고치고 싶",
    "고쳐",
    "다르게 말",
    "예쁘게 말",
    "곱게 말",
    "바른말로",
    "순화",
    "어떻게 말하면",
    "뭐라고 말",
  ],
  profanity: ["욕", "욕설", "비속어", "쌍욕", "패드립", "험한 말", "거친 말", "나쁜 말"],
  appearance: ["외모", "얼굴", "못생", "뚱뚱", "돼지", "키 작", "안경", "머리 스타일", "생김새", "외모 비하"],
  tease: ["놀리", "놀림", "비웃", "장난쳐", "따라 하며 웃", "조롱"],
  rumor: ["소문", "카더라", "그렇대", "루머", "퍼뜨", "퍼트", "말이 돌", "도둑질했다는"],
  factCheck: ["진짜인지", "사실인지", "사실 확인", "맞는지", "진실", "가짜뉴스", "확인해"],
  cyber: ["사이버", "온라인에서 괴롭", "사진 올려", "합성", "저격", "박제", "떼카", "카톡 감옥", "신상"],
  groupChat: ["단톡", "단톡방", "카톡방", "카톡", "채팅방", "오픈채팅", "대화방"],
  game: ["게임", "롤", "배그", "마크", "마인크래프트", "보이스채팅", "게임 채팅", "팀원"],
  privacy: ["개인정보", "전화번호", "주소", "비밀번호", "이름을 보내", "사진을 보내", "계정", "주민등록"],
  ai: ["ai", "인공지능", "챗봇", "gpt", "지피티", "로봇"],
  manners: ["예절", "예의", "존댓말", "인사", "정중", "부탁", "거절"],
  empathy: ["속상", "슬퍼", "슬프", "화나", "짜증", "외로", "서운", "우울", "기분이 안", "마음이 아"],
  helpReport: ["신고", "도와주세요", "도움", "어떻게 해야", "선생님께 말", "알려야", "무서워", "혼자"],
  conflict: ["싸웠", "싸움", "다퉜", "화해", "친구랑", "친구가", "사과", "미안", "삐졌", "절교"],
};

/** AI 관련 질문인지 — 단순히 'ai' 글자가 있다고 AI Intent 로 보지 않는다. */
function isAiQuestion(t: string): boolean {
  if (!has(t, W.ai)) return false;
  // 'ai' 는 2글자라 오탐이 쉬우므로 AI를 "대상"으로 묻는 표현이 함께 있어야 한다.
  return has(t, [
    "ai는",
    "ai가",
    "ai에게",
    "ai한테",
    "ai를",
    "인공지능",
    "챗봇",
    "gpt",
    "지피티",
    "로봇",
  ]);
}

type Scored = { intent: AssistantIntent; score: number };

function scoreIntents(t: string): Scored[] {
  const s: Scored[] = [];
  const push = (intent: AssistantIntent, score: number) => {
    if (score > 0) s.push({ intent, score });
  };

  const askMeaning = has(t, W.meaningAsk);
  const wantRewrite = has(t, W.rewriteAsk);

  // ⑤ 외모 놀림 — '외모' 낱말만으로는 부족, 놀림/비하 맥락이 함께여야 한다.
  const appearanceHit = has(t, W.appearance);
  const teaseHit = has(t, W.tease);
  if (appearanceHit && (teaseHit || wantRewrite || has(t, ["비하", "상처"])))
    push("appearance_teasing", 9 + countHits(t, W.appearance));
  else if (appearanceHit && !isAiQuestion(t)) push("appearance_teasing", 4);

  // ⑥ 소문 / ⑮ 사실 확인
  if (has(t, W.rumor)) push("rumor", 8 + countHits(t, W.factCheck));
  if (has(t, W.factCheck)) push("fact_check", has(t, W.rumor) ? 5 : 7);

  // ⑩ 개인정보
  if (has(t, W.privacy)) push("privacy", 9);

  // ⑦ 사이버폭력
  if (has(t, W.cyber)) push("cyberbullying", 8);

  // ⑧ 단톡방 / ⑨ 게임 채팅 — 장소는 다른 의도와 함께 오면 가중치를 낮춘다.
  if (has(t, W.groupChat)) push("group_chat", 6);
  if (has(t, W.game)) push("game_chat", 6);

  // ② 욕설
  if (has(t, W.profanity)) push("profanity", 8);

  // ① 유행어 뜻
  if (askMeaning) push("slang_meaning", 9);

  // ③ 바른말 바꾸기 — 바꾸려는 목적이 분명하면 최우선급
  if (wantRewrite) push("rewrite", 8);

  // ⑪ AI 사용
  if (isAiQuestion(t)) push("ai_usage", 8);

  // ⑭ 신고·도움
  if (has(t, W.helpReport)) push("help_report", 5);

  // ④ 친구 갈등
  if (has(t, W.conflict)) push("friend_conflict", 5);

  // ⑫ 예절
  if (has(t, W.manners)) push("manners", 4);

  // ⑬ 공감
  if (has(t, W.empathy)) push("empathy", 3);

  return s.sort((a, b) => b.score - a.score);
}

/**
 * 여러 Intent 가 동시에 잡힐 때의 우선순위.
 * 안전(개인정보·사이버폭력) > 목적(바꾸기·뜻) > 상황(외모·소문) > 장소(단톡·게임) > 감정.
 */
const PRIORITY: AssistantIntent[] = [
  "privacy",
  "cyberbullying",
  "rumor",
  "appearance_teasing",
  "rewrite",
  "slang_meaning",
  "profanity",
  "ai_usage",
  "fact_check",
  "group_chat",
  "game_chat",
  "friend_conflict",
  "help_report",
  "manners",
  "empathy",
  "other",
];

function resolveIntent(scored: Scored[], t: string): { intent: AssistantIntent; conf: number } {
  if (scored.length === 0) return { intent: "other", conf: 0.2 };
  const top = scored[0].score;
  const tied = scored.filter((x) => top - x.score <= 1).map((x) => x.intent);

  // 조합 규칙: 장소 + 행위가 함께면 행위 Intent 를 우선하되 장소는 Context 로 남긴다.
  if (tied.includes("appearance_teasing") && tied.includes("rewrite"))
    return { intent: "appearance_teasing", conf: 0.9 };
  if (tied.includes("profanity") && tied.includes("rewrite")) return { intent: "rewrite", conf: 0.85 };
  if (tied.includes("rumor") && tied.includes("fact_check")) return { intent: "rumor", conf: 0.9 };
  if (tied.includes("group_chat") && tied.includes("profanity"))
    return { intent: "group_chat", conf: 0.85 };
  if (tied.includes("game_chat") && tied.includes("profanity"))
    return { intent: "game_chat", conf: 0.85 };

  for (const p of PRIORITY) {
    if (tied.includes(p)) {
      const conf = Math.min(0.95, 0.4 + top * 0.06 + (has(t, W.meaningAsk) ? 0.1 : 0));
      return { intent: p, conf };
    }
  }
  return { intent: scored[0].intent, conf: 0.5 };
}

// ─────────────────────────────────────────────────────────────
// 2) 상황(Context) 분석
// ─────────────────────────────────────────────────────────────

const TERM_STOP = new Set([
  "무슨",
  "뜻",
  "뜻이",
  "뜻은",
  "의미",
  "이에요",
  "인가요",
  "이야",
  "뭐야",
  "알려줘",
  "알려주세요",
  "요즘",
  "이란",
  "라는",
  "말",
  "이거",
  "그거",
]);

function extractTerm(raw: string, t: string): string | null {
  const quoted = raw.match(/['"‘’“”]([^'"‘’“”]{1,12})['"‘’“”]/);
  if (quoted) return quoted[1].trim();
  const m = t.match(/([가-힣a-z0-9]{1,10})\s*(?:가|이|은|는|란|이란)?\s*무슨\s*뜻/);
  if (m && !TERM_STOP.has(m[1])) return m[1];
  const m2 = t.match(/([가-힣a-z0-9]{1,10})\s*(?:의)?\s*뜻/);
  if (m2 && !TERM_STOP.has(m2[1])) return m2[1];
  return null;
}

function analyzeContext(raw: string, t: string, intent: AssistantIntent): AssistantContext {
  const who: string[] = [];
  if (has(t, ["친구"])) who.push("친구");
  if (has(t, ["옆반", "다른 반"])) who.push("옆반 친구");
  if (has(t, ["선생님"])) who.push("선생님");
  if (has(t, ["형", "누나", "동생", "언니", "오빠"])) who.push("가족");

  const where = has(t, W.groupChat)
    ? "단톡방"
    : has(t, W.game)
      ? "게임"
      : has(t, ["학교", "교실", "복도", "운동장"])
        ? "학교"
        : has(t, ["인터넷", "댓글", "sns", "유튜브"])
          ? "인터넷"
          : null;

  // 이미 했는지 / 하려는지 / 그냥 묻는지
  const done = has(t, ["했어요", "했어", "보냈", "말했", "올렸", "알려줬", "적었", "썼어"]);
  const planning = has(t, ["하고 싶", "할까", "해도 되", "하려고", "보내도", "말할까", "바꾸고 싶"]);
  const tense: ActionTense = done ? "done" : planning ? "planning" : "asking";

  // 피해자 / 가해자 / 관찰자
  const meTarget = has(t, ["나를", "나한테", "저를", "저한테", "내가 들었", "들었어요", "당했"]);
  const iDid = has(t, ["내가", "제가", "나는 ", "저는 "]) && done;
  const role: StudentRole = meTarget
    ? "victim"
    : iDid
      ? "actor"
      : has(t, ["봤어요", "들었는데", "친구들이"])
        ? "observer"
        : "unknown";

  const needsAdultHelp =
    has(t, ["무서워", "협박", "돈을", "만나자", "죽", "때렸", "계속 괴롭"]) ||
    intent === "help_report" ||
    (intent === "cyberbullying" && role === "victim");

  return {
    who,
    where,
    what: intent === "other" ? null : intent,
    role,
    tense,
    term: extractTerm(raw, t),
    needsAdultHelp,
  };
}

// ─────────────────────────────────────────────────────────────
// 3) 말투 — 시작 표현 다양화 (같은 표현 연속 금지)
// ─────────────────────────────────────────────────────────────

const OPENERS: string[] = [
  "좋은 질문이야.",
  "그럴 수도 있겠구나.",
  "속상했겠다.",
  "먼저 함께 생각해 보자.",
  "친구 입장도 떠올려 볼까?",
  "정말 중요한 상황이네.",
  "용기 내어 물어봐 줘서 고마워.",
  "그 마음, 충분히 이해돼.",
  "이건 우리 반에서도 자주 있는 일이야.",
  "천천히 하나씩 살펴보자.",
];

const recentOpeners: string[] = [];

function pickOpener(seed: number, ctx: AssistantContext): string {
  const emotional =
    ctx.role === "victim" ? ["속상했겠다.", "그 마음, 충분히 이해돼.", "많이 힘들었겠구나."] : null;
  const pool = (emotional ?? OPENERS).filter((o) => !recentOpeners.includes(o));
  const use = pool.length > 0 ? pool : (emotional ?? OPENERS);
  const line = use[Math.abs(seed) % use.length];
  recentOpeners.push(line);
  if (recentOpeners.length > 3) recentOpeners.shift();
  return line;
}

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) + Date.now() % 7;
}

// ─────────────────────────────────────────────────────────────
// 5) 상황별 응답 본문 (② 핵심 판단 / ③ 이유 / ④ 바른 행동 / ⑤ 생각거리)
// ─────────────────────────────────────────────────────────────

type Body = {
  judgement: string;
  reason: string;
  action: string[]; // ❌ → ⭕ 예시 포함
  think: string;
};

function bodyFor(intent: AssistantIntent, ctx: AssistantContext, term: string | null): Body {
  switch (intent) {
    case "appearance_teasing":
      return {
        judgement:
          ctx.tense === "planning" && ctx.role === "actor"
            ? "외모를 놀리는 말은 장난이라도 하면 안 돼."
            : "외모를 놀리는 말은 마음에 오래 남는 상처가 돼.",
        reason:
          "생김새는 친구가 고를 수 있는 것이 아니야. 그래서 외모를 두고 하는 말은 '나는 너를 있는 그대로 존중하지 않아'라는 뜻으로 전해지기 쉬워.",
        action: [
          "❌ 너 진짜 못생겼다. / 살 좀 빼라.",
          "⭕ 오늘 머리 스타일이 달라졌네, 잘 어울린다.",
          "⭕ 같이 놀자. 네가 있어서 재미있어.",
          "⭕ 아까 그 말, 내가 실수했어. 미안해.",
        ],
        think: "내가 듣고 싶은 말과 지금 하려던 말이 얼마나 다른지 한번 비교해 볼까?",
      };

    case "profanity":
      return {
        judgement:
          ctx.role === "victim"
            ? "욕을 들으면 놀라고 화가 나는 게 당연해. 네 잘못이 아니야."
            : "화가 난 마음은 잘못이 아니지만, 욕은 그 마음을 전하지 못해.",
        reason:
          "욕설은 내 감정을 전하는 대신 상대의 마음을 공격해. 그래서 하고 싶은 말은 사라지고 싸움만 남아.",
        action: [
          "❌ 야, 진짜 짜증나 ○○아.",
          "⭕ 나 지금 화가 났어. 잠깐 쉬었다 이야기하자.",
          "⭕ 그 말을 들으니까 속상했어. 그만해 줬으면 좋겠어.",
          "⭕ (욕을 들었다면) 그렇게 말하면 기분이 나빠. 하지 말아 줘. → 그래도 계속되면 선생님께 알리기.",
        ],
        think: "화가 났을 때 쓸 나만의 문장을 미리 하나 정해 둔다면 어떤 말이 좋을까?",
      };

    case "rewrite":
      return {
        judgement: "말을 바꿔 보려는 마음이 벌써 바른말 수호대야.",
        reason:
          "같은 뜻이라도 낱말을 바꾸면 듣는 사람의 마음이 달라져. 감정은 그대로 담고, 상대를 깎아내리는 부분만 빼면 돼.",
        action: [
          "❌ 너 왜 이렇게 못해?",
          "⭕ 이 부분은 이렇게 해 보면 어떨까?",
          "❌ 재수 없어.",
          "⭕ 지금은 내 마음이 불편해. 조금 있다 이야기할래.",
        ],
        think: "바꾼 말을 소리 내어 읽어 보면 마음이 어떻게 달라지는지 느껴 볼까?",
      };

    case "rumor":
      return {
        judgement:
          ctx.tense === "done"
            ? "이미 전한 말이라도 지금 멈추면 피해를 줄일 수 있어."
            : "확인되지 않은 소문은 전하지 않는 것이 가장 안전해.",
        reason:
          "'진짜 같다'와 '진짜다'는 달라. 사실이 아니면 친구는 하지 않은 일로 오해받고, 사실이더라도 함부로 퍼뜨리면 그 친구를 다치게 해.",
        action: [
          "❌ 옆반 ○○가 도둑질했대. 진짜인 것 같아.",
          "⭕ 확인되지 않은 이야기라 전하지 않을게.",
          "⭕ (이미 말했다면) 아까 내가 한 말은 확인된 게 아니야. 더 퍼뜨리지 말아 줘.",
          "⭕ 걱정되는 일이면 선생님께 조용히 말씀드리기.",
        ],
        think: "그 소문의 주인공이 나였다면, 친구들이 어떻게 해 주길 바랐을까?",
      };

    case "fact_check":
      return {
        judgement: "먼저 '어디서 나온 말인지' 확인하는 습관이 중요해.",
        reason:
          "인터넷과 대화방에는 확인되지 않은 이야기가 빠르게 퍼져. 확인 없이 옮기면 나도 모르게 잘못된 이야기를 만든 사람이 돼.",
        action: [
          "⭕ 이 이야기는 누가, 어디서 처음 말했을까?",
          "⭕ 믿을 수 있는 곳(선생님, 교과서, 공식 누리집)에서 다시 확인하기.",
          "⭕ 확인 전에는 전하지 않기.",
        ],
        think: "확인하기 전과 후에 내 생각이 어떻게 달라졌는지 적어 볼까?",
      };

    case "cyberbullying":
      return {
        judgement: "온라인에서 반복해서 괴롭히는 일은 장난이 아니라 폭력이야.",
        reason:
          "화면 너머에도 진짜 마음이 있어. 게다가 온라인 글은 빠르게 퍼지고 오래 남아서 상처가 더 커져.",
        action: [
          "⭕ 화면을 저장(캡처)해 두기.",
          "⭕ 대꾸하지 않고 대화방에서 나오거나 차단하기.",
          "⭕ 선생님이나 보호자에게 오늘 안에 꼭 알리기.",
          "⭕ (내가 했다면) 지금 멈추고 사과하기: 내가 올린 말 때문에 네가 힘들었지. 미안해.",
        ],
        think: "지금 이 일을 가장 먼저 알려 줄 어른은 누구일까?",
      };

    case "group_chat":
      return {
        judgement: "대화방은 여러 사람이 함께 보는 곳이라 말 한마디의 힘이 더 커.",
        reason:
          "여러 명이 함께 있으면 장난이 빨리 번지고, 한 명은 크게 상처받아. 읽고도 가만히 있으면 놀림이 계속되기도 해.",
        action: [
          "❌ (놀림에 웃는 이모티콘으로 맞장구치기)",
          "⭕ 그 얘기는 그만하자.",
          "⭕ ○○아, 괜찮아? 나는 네 편이야. (따로 말 걸기)",
          "⭕ (내가 했다면) 아까 내가 한 말 미안해. 지울게.",
        ],
        think: "대화방에서 내가 할 수 있는 가장 용기 있는 한마디는 뭘까?",
      };

    case "game_chat":
      return {
        judgement: "게임에서 들은 욕설도 실제로 마음을 다치게 해.",
        reason:
          "이기고 싶은 마음이 크면 말이 거칠어지기 쉬워. 하지만 게임은 함께 즐기려고 하는 거야.",
        action: [
          "❌ 야 못하면 나가라.",
          "⭕ 다음 판은 같이 이렇게 해 보자.",
          "⭕ (욕을 들었다면) 대꾸하지 않고 신고·차단하기.",
          "⭕ 마음이 상했으면 잠깐 게임을 멈추고 쉬기.",
        ],
        think: "게임이 끝난 뒤에도 기분 좋게 남는 말은 어떤 말일까?",
      };

    case "privacy":
      return {
        judgement: "이름, 전화번호, 주소, 학교, 사진, 비밀번호는 보내면 안 돼.",
        reason:
          "개인정보는 한 번 나가면 되돌릴 수 없어. 친한 사이처럼 보여도 상대가 누구인지 확실히 알 수 없는 곳이 많아.",
        action: [
          "❌ 내 전화번호는 010-…이야.",
          "⭕ 개인정보는 알려 줄 수 없어.",
          "⭕ 누가 계속 물어보면 바로 어른께 알리기.",
          "⭕ 사진도 얼굴·교복·집 주변이 보이면 올리지 않기.",
        ],
        think: "내가 지켜야 할 정보 목록을 스스로 3가지 적어 볼까?",
      };

    case "ai_usage":
      return {
        judgement: "인공지능도 틀릴 수 있어서 항상 맞다고 믿으면 안 돼.",
        reason:
          "인공지능은 많은 글을 배워 답을 만들지만, 사실이 아닌 내용을 그럴듯하게 말하기도 해. 마음을 온전히 이해하지도 못해.",
        action: [
          "⭕ 답을 들으면 책이나 선생님께 한 번 더 확인하기.",
          "⭕ 그대로 베끼지 않고 내 말로 다시 정리하기.",
          "⭕ 개인정보는 입력하지 않기.",
          "⭕ 인공지능에게도 고운 말로 부탁하기.",
        ],
        think: "인공지능의 답에서 '확인이 필요한 부분'을 찾아낼 수 있을까?",
      };

    case "slang_meaning":
      return {
        judgement: term
          ? `'${term}'이 어떤 말인지 함께 살펴보자.`
          : "그 말이 어떤 뜻인지 함께 살펴보자.",
        reason:
          "유행어는 뜻보다 '어디서, 누구에게' 쓰는지가 더 중요해. 친구끼리 웃으며 쓴 말도 교실에서는 놀림이 될 수 있어.",
        action: [
          "⭕ 뜻을 먼저 알아보고, 누군가를 낮추는 말이면 쓰지 않기.",
          "⭕ 교실·발표·어른과의 대화에서는 우리말 표현으로 바꿔 쓰기.",
          "⭕ 예: 대박이다 → 정말 놀랍다 / 굿잡 → 정말 잘했어.",
        ],
        think: "이 말을 선생님이나 가족 앞에서도 그대로 쓸 수 있을까?",
      };

    case "friend_conflict":
      return {
        judgement: "친구와 부딪히는 일은 누구에게나 있어. 중요한 건 그다음이야.",
        reason:
          "다툼이 커지는 이유는 대부분 '무엇이 속상했는지'를 말하지 못해서야. 마음을 먼저 말하면 풀 수 있어.",
        action: [
          "❌ 네가 먼저 그랬잖아.",
          "⭕ 아까 그 말을 들었을 때 나는 속상했어.",
          "⭕ 네 이야기도 듣고 싶어. 어떤 마음이었어?",
          "⭕ 내가 잘못한 부분은 미안해.",
        ],
        think: "친구는 그때 어떤 마음이었을지 한 문장으로 상상해 볼까?",
      };

    case "help_report":
      return {
        judgement: "혼자 참지 않고 도움을 요청하는 건 아주 용기 있는 일이야.",
        reason: "어른에게 알리는 건 고자질이 아니라, 나와 친구를 지키는 방법이야.",
        action: [
          "⭕ 선생님, 드릴 말씀이 있어요. 잠깐 시간 괜찮으세요?",
          "⭕ 언제·어디서·무슨 일이 있었는지 순서대로 말하기.",
          "⭕ 증거(화면 저장)가 있으면 함께 보여 주기.",
        ],
        think: "지금 가장 믿고 이야기할 수 있는 어른은 누구야?",
      };

    case "manners":
      return {
        judgement: "예절은 상대를 존중하는 마음을 말로 보여 주는 거야.",
        reason: "같은 부탁도 말투에 따라 기분 좋게 들리기도, 명령처럼 들리기도 해.",
        action: [
          "❌ 이거 해 줘.",
          "⭕ 미안한데 이것 좀 도와줄 수 있을까?",
          "❌ 싫어.",
          "⭕ 지금은 어려울 것 같아. 대신 다음에 도와줄게.",
        ],
        think: "오늘 하루 중 한 번, 부탁의 말을 바꿔 써 본다면 언제가 좋을까?",
      };

    case "empathy":
      return {
        judgement: "그런 마음이 드는 건 자연스러운 일이야.",
        reason: "마음에 이름을 붙여 말하면, 그 마음이 조금 가벼워지고 다른 사람도 도와줄 수 있어.",
        action: [
          "⭕ 나는 지금 ○○해서 속상해.",
          "⭕ 이야기 좀 들어 줄래?",
          "⭕ 오늘 있었던 일을 한 줄로 적어 두기.",
        ],
        think: "지금 내 마음을 낱말 하나로 표현하면 무엇일까?",
      };

    default:
      return {
        judgement: "무엇이 궁금한지 조금만 더 알려 주면 정확하게 도와줄 수 있어.",
        reason:
          "같은 낱말도 상황에 따라 뜻이 달라져서, 누가·언제·어디서 있었던 일인지 알면 더 잘 도울 수 있어.",
        action: [
          "⭕ 예: 친구가 단톡방에서 나를 놀려요.",
          "⭕ 예: '○○'는 무슨 뜻이에요?",
          "⭕ 예: 이 말을 바른말로 바꾸고 싶어요.",
        ],
        think: "그 일이 있었을 때 네 마음은 어땠어?",
      };
  }
}

// ─────────────────────────────────────────────────────────────
// 7) Intent 기반 추천 질문
// ─────────────────────────────────────────────────────────────

const SUGGESTIONS: Record<AssistantIntent, AssistantSuggestion[]> = {
  profanity: [
    { icon: "🛡️", label: "욕을 들었을 때", prompt: "친구에게 욕을 들었을 때 어떻게 해야 하나요?" },
    { icon: "💗", label: "예쁘게 말하기", prompt: "친구에게 예쁘게 말하는 방법을 알려 주세요." },
    { icon: "🙋", label: "선생님께 도움 요청", prompt: "선생님께 도움을 요청하려면 어떻게 말해요?" },
  ],
  appearance_teasing: [
    { icon: "🌟", label: "칭찬하는 말", prompt: "친구를 기분 좋게 칭찬하는 말을 알려 주세요." },
    { icon: "💞", label: "공감 표현", prompt: "친구 마음에 공감하는 말은 어떻게 하나요?" },
    { icon: "🤝", label: "친구 마음 이해", prompt: "놀림을 받은 친구의 마음은 어떨까요?" },
  ],
  rumor: [
    { icon: "🔎", label: "사실 확인 방법", prompt: "소문이 사실인지 확인하려면 어떻게 해요?" },
    { icon: "📰", label: "가짜뉴스", prompt: "가짜뉴스는 왜 위험한가요?" },
    { icon: "💬", label: "단톡방 예절", prompt: "단톡방에서 지켜야 할 예절은 무엇인가요?" },
  ],
  fact_check: [
    { icon: "🔎", label: "확인하는 습관", prompt: "인터넷 정보를 확인하는 방법을 알려 주세요." },
    { icon: "📰", label: "가짜뉴스", prompt: "가짜뉴스는 왜 위험한가요?" },
    { icon: "🤖", label: "AI 답도 확인", prompt: "AI가 알려 준 답은 어떻게 확인해요?" },
  ],
  slang_meaning: [
    { icon: "🌱", label: "우리말 표현", prompt: "이 말을 우리말 표현으로 바꾸면 뭐라고 해요?" },
    { icon: "🏫", label: "교실에서 써도 될까?", prompt: "이 말을 교실에서 사용해도 되나요?" },
    { icon: "🔍", label: "다른 유행어 뜻", prompt: "요즘 유행어 중에 조심해야 할 말은 뭐가 있어요?" },
  ],
  rewrite: [
    { icon: "💗", label: "부드럽게 말하기", prompt: "화난 마음을 부드럽게 말하려면 어떻게 해요?" },
    { icon: "🌱", label: "순화어 알아보기", prompt: "거친 말을 대신할 순화어를 알려 주세요." },
    { icon: "🙏", label: "사과하는 말", prompt: "친구에게 진심으로 사과하는 말을 알려 주세요." },
  ],
  cyberbullying: [
    { icon: "🙋", label: "도움 요청하기", prompt: "선생님께 도움을 요청하려면 어떻게 말해요?" },
    { icon: "📸", label: "증거 남기기", prompt: "온라인에서 괴롭힘을 당하면 무엇을 남겨 둬야 해요?" },
    { icon: "💬", label: "단톡방 예절", prompt: "단톡방에서 지켜야 할 예절은 무엇인가요?" },
  ],
  group_chat: [
    { icon: "💬", label: "단톡방 예절", prompt: "단톡방에서 지켜야 할 예절은 무엇인가요?" },
    { icon: "🤝", label: "친구 편들어 주기", prompt: "단톡방에서 놀림받는 친구를 어떻게 도와줘요?" },
    { icon: "🙏", label: "사과하는 말", prompt: "단톡방에서 한 말을 사과하려면 어떻게 해요?" },
  ],
  game_chat: [
    { icon: "🎮", label: "게임 예절", prompt: "게임에서 지켜야 할 채팅 예절은 무엇인가요?" },
    { icon: "🛡️", label: "욕을 들었을 때", prompt: "게임에서 욕을 들으면 어떻게 해야 하나요?" },
    { icon: "💗", label: "팀원 칭찬하기", prompt: "게임에서 팀원을 칭찬하는 말을 알려 주세요." },
  ],
  privacy: [
    { icon: "🔒", label: "지켜야 할 정보", prompt: "인터넷에서 알려 주면 안 되는 정보는 뭐예요?" },
    { icon: "📸", label: "사진 올리기", prompt: "내 사진을 올려도 되는지 어떻게 판단해요?" },
    { icon: "🙋", label: "이상한 요청", prompt: "모르는 사람이 개인정보를 물어보면 어떻게 해요?" },
  ],
  ai_usage: [
    { icon: "🤖", label: "AI 대화 예절", prompt: "인공지능과 대화할 때 지켜야 할 예절은 무엇인가요?" },
    { icon: "🔎", label: "답 확인하기", prompt: "AI가 알려 준 답은 어떻게 확인해요?" },
    { icon: "🔒", label: "AI에 개인정보", prompt: "AI 챗봇에게 이름이나 전화번호를 알려 줘도 되나요?" },
  ],
  friend_conflict: [
    { icon: "🙏", label: "사과하는 말", prompt: "친구에게 진심으로 사과하는 말을 알려 주세요." },
    { icon: "💞", label: "공감 표현", prompt: "친구 마음에 공감하는 말은 어떻게 하나요?" },
    { icon: "🤝", label: "화해하는 방법", prompt: "다툰 친구와 화해하려면 어떻게 말해요?" },
  ],
  help_report: [
    { icon: "🙋", label: "선생님께 말하기", prompt: "선생님께 도움을 요청하려면 어떻게 말해요?" },
    { icon: "📸", label: "증거 남기기", prompt: "온라인에서 괴롭힘을 당하면 무엇을 남겨 둬야 해요?" },
    { icon: "💬", label: "친구에게 알리기", prompt: "힘든 일을 친구에게 이야기하려면 어떻게 시작해요?" },
  ],
  manners: [
    { icon: "🙏", label: "부탁하는 말", prompt: "친구에게 정중하게 부탁하는 말을 알려 주세요." },
    { icon: "🙅", label: "거절하는 말", prompt: "부탁을 예의 있게 거절하고 싶어요." },
    { icon: "💗", label: "칭찬하는 말", prompt: "친구를 기분 좋게 칭찬하는 말을 알려 주세요." },
  ],
  empathy: [
    { icon: "💞", label: "공감 표현", prompt: "친구 마음에 공감하는 말은 어떻게 하나요?" },
    { icon: "🗒️", label: "마음 적어 보기", prompt: "속상한 마음을 한 줄로 적으려면 어떻게 써요?" },
    { icon: "🙋", label: "도움 요청하기", prompt: "선생님께 도움을 요청하려면 어떻게 말해요?" },
  ],
  other: [
    { icon: "🔍", label: "유행어 뜻 묻기", prompt: "'알빠노'는 무슨 뜻이에요?" },
    { icon: "💗", label: "바른말로 바꾸기", prompt: "친구에게 한 거친 말을 바른말로 바꾸고 싶어요." },
    { icon: "💬", label: "단톡방 고민", prompt: "단톡방에서 친구가 나를 놀려요." },
  ],
};

// ─────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────

export function analyzeStudentQuestion(raw: string): AssistantAnalysis {
  const t = norm(raw);
  const scored = scoreIntents(t);
  let { intent, conf } = resolveIntent(scored, t);
  // 장소 맥락 보정: 게임/단톡방에서 벌어진 말 문제는 장소 Intent로 다룬다.
  if (intent === "profanity") {
    if (has(t, W.game)) intent = "game_chat";
    else if (has(t, W.groupChat)) intent = "group_chat";
  }
  return {
    intent,
    candidates: scored.map((s) => s.intent),
    confidence: conf,
    context: analyzeContext(raw, t, intent),
  };
}

export type ComposeOptions = {
  /** 데이터셋에서 찾은 낱말 뜻 (있으면 ③ 이유 앞에 덧붙인다). */
  termMeaning?: string | null;
  /** 데이터셋에서 찾은 대체 표현 */
  alternatives?: string[];
};

/** 3단계 답변 구조: 공감 → 핵심 판단 → 이유 → 바른 행동 제안 → 추가 생각거리 */
export function composeAssistantReply(raw: string, opts: ComposeOptions = {}): AssistantComposed {
  const analysis = analyzeStudentQuestion(raw);
  const { intent, context } = analysis;
  const body = bodyFor(intent, context, context.term);
  const opener = pickOpener(seedOf(raw), context);

  const lines: string[] = [];
  lines.push(`${opener}`);
  lines.push("");
  lines.push(`✅ ${body.judgement}`);

  const meaning = opts.termMeaning?.trim();
  lines.push("");
  lines.push(meaning ? `📖 ${meaning}\n\n${body.reason}` : body.reason);

  const actions = [...body.action];
  if (opts.alternatives && opts.alternatives.length > 0) {
    actions.push(`⭕ 이렇게 바꿔 쓸 수 있어: ${opts.alternatives.slice(0, 3).join(" / ")}`);
  }
  lines.push("");
  lines.push("🌱 이렇게 말해 보자");
  lines.push(actions.join("\n"));

  // 8단계 — 확실히 판단할 수 없거나 위험한 상황이면 어른과 함께
  if (context.needsAdultHelp || analysis.confidence < 0.4) {
    lines.push("");
    lines.push(
      "🙋 이 일은 혼자 판단하기 어려워. 오늘 안에 선생님이나 보호자와 함께 이야기해 보자.",
    );
  }

  lines.push("");
  lines.push(`🤔 함께 생각해 볼까? ${body.think}`);

  return {
    text: lines.join("\n"),
    analysis,
    suggestions: SUGGESTIONS[intent] ?? SUGGESTIONS.other,
  };
}