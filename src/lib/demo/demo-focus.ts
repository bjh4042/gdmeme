// 시연 데이터가 참조하는 언어 표현 · 상황 연결표.
// 모든 id 는 Language Data Pack / Language Scenario Pack 의 실제 항목이다.

import type { DemoPersona, DemoTrend } from "./demo-types";

export type DemoFocusItem = {
  key: string;
  /** src/data/language/datasets 의 LanguageEntry.id */
  languageId: string;
  /** src/data/language-scenarios/datasets 의 LanguageScenario.id */
  scenarioId: string;
  /** 시연 시나리오 라벨(교사 설명용) */
  situation: string;
  online: boolean;
  /** 학생이 실제로 입력했다고 가정하는 문장 */
  studentInput: string;
  /** 학생이 고른 대체 표현 */
  alternative: string;
  reflection: string;
  /** 자주 나타나는 오개념 (없으면 undefined) */
  misconception?: string;
};

/**
 * 요구된 10가지 대표 상황 + 카테고리 커버리지(비속어·은어·신조어·밈·줄임말·
 * 게임채팅·SNS·단톡방·비꼼·책임전가·배제·사과·공감·대체표현)를 모두 포함한다.
 */
export const DEMO_FOCUS_ITEMS: DemoFocusItem[] = [
  {
    key: "game-anger",
    languageId: "slang_bbagchinda",
    scenarioId: "gc_anger_swear",
    situation: "게임 중 화가 나서 공격적인 말을 함",
    online: true,
    studentInput: "야 진짜 빡친다 너 때문에 졌잖아",
    alternative: "아 아쉽다, 다음 판은 다시 해보자",
    reflection: "화가 났을 때 바로 말하지 않고 한 번 멈춰야겠다.",
    misconception: "게임 안에서는 심한 말도 괜찮다고 생각함",
  },
  {
    key: "game-taunt",
    languageId: "game_ez",
    scenarioId: "gc_lose_blame_team",
    situation: "이기고 나서 상대를 무시하는 채팅",
    online: true,
    studentInput: "ez ㅋㅋ 실력 차이 인정?",
    alternative: "좋은 경기였어, 다음에 또 하자",
    reflection: "이겼을 때 하는 말이 더 오래 기억에 남는 것 같다.",
  },
  {
    key: "kakao-read",
    languageId: "abbr_ㅇㅋ",
    scenarioId: "kt_read_no_reply",
    situation: "단톡방에서 읽고 답하지 않아 생긴 오해",
    online: true,
    studentInput: "ㅇㅋ 하고 답 안 하길래 나 무시한 줄 알았음",
    alternative: "지금 바빠서 이따가 답할게",
    reflection: "짧은 답장이 차갑게 느껴질 수 있다는 걸 알았다.",
    misconception: "답이 없으면 무조건 나를 싫어하는 것이라고 생각함",
  },
  {
    key: "comment-tease",
    languageId: "sns_jaljin",
    scenarioId: "yt_appearance_comment",
    situation: "영상 댓글에서 친구를 놀리는 표현",
    online: true,
    studentInput: "저격은 아니고 그냥 웃기려고 쓴 건데",
    alternative: "영상 잘 봤어요, 다음 편도 기대돼요",
    reflection: "장난으로 쓴 댓글도 남는다는 걸 생각하게 됐다.",
    misconception: "이름을 안 쓰면 저격이 아니라고 생각함",
  },
  {
    key: "meme-misread",
    languageId: "meme_gwiyomi",
    scenarioId: "kt_meme_share",
    situation: "밈의 뜻을 몰라 생긴 갈등",
    online: true,
    studentInput: "어쩔티비라고 했는데 왜 화내는지 모르겠어",
    alternative: "네 말 끝까지 들어볼게, 다시 말해줄래?",
    reflection: "유행어라도 상대가 상처받으면 멈춰야 한다.",
    misconception: "유행어라서 뜻이 없다고 생각함",
  },
  {
    key: "share-consent",
    languageId: "sns_share",
    scenarioId: "kt_screenshot_share",
    situation: "허락 없이 사진·대화를 공유함",
    online: true,
    studentInput: "그냥 웃겨서 캡처해서 박제했지",
    alternative: "올리기 전에 먼저 물어볼게",
    reflection: "내 사진이 그렇게 돌아다니면 나도 싫었을 것 같다.",
    misconception: "재밌으면 공유해도 된다고 생각함",
  },
  {
    key: "nickname",
    languageId: "nw_ttukbaegi",
    scenarioId: "school_nickname_hurt",
    situation: "장난이라며 상처 주는 별명을 반복함",
    online: false,
    studentInput: "뚝배기라고 부른 건 그냥 별명인데",
    alternative: "미안해, 앞으로 이름으로 부를게",
    reflection: "별명은 부르는 사람이 아니라 듣는 사람이 정한다.",
    misconception: "장난이면 상처가 아니라고 생각함",
  },
  {
    key: "blame",
    languageId: "blame_youfault",
    scenarioId: "cf_blame_first",
    situation: "친구가 먼저 했다며 책임을 돌림",
    online: false,
    studentInput: "쟤가 먼저 시작했으니까 내 잘못 아님",
    alternative: "내가 한 부분은 내가 미안해",
    reflection: "먼저인지 따지는 동안 문제는 그대로였다.",
    misconception: "먼저 한 사람만 잘못이라고 생각함",
  },
  {
    key: "offline-slang",
    languageId: "slang_gaejjaejeung",
    scenarioId: "cls_answer_wrong_laugh",
    situation: "온라인 비속어를 교실에서 그대로 사용함",
    online: false,
    studentInput: "개짜증 나게 왜 웃냐고",
    alternative: "지금 좀 속상해, 그만 웃어줄래?",
    reflection: "채팅에서 쓰던 말이 교실에서도 튀어나왔다.",
    misconception: "말버릇이라 바꿀 수 없다고 생각함",
  },
  {
    key: "sarcasm",
    languageId: "sarc_wellwell",
    scenarioId: "cls_group_free_rider",
    situation: "비꼬는 말투로 상대를 깎아내림",
    online: false,
    studentInput: "잘~ 한다 진짜",
    alternative: "이 부분은 같이 나눠서 하면 좋겠어",
    reflection: "비꼬는 말은 칭찬처럼 들려도 마음에 남는다.",
  },
  {
    key: "exclusion",
    languageId: "cyber_kick",
    scenarioId: "cf_group_isolation",
    situation: "단톡방에서 특정 친구를 배제함",
    online: true,
    studentInput: "쟤만 빼고 새 방 팔까",
    alternative: "빼는 대신 규칙을 같이 정해보자",
    reflection: "빠진 친구 마음을 한 번도 생각 못 했다.",
    misconception: "여러 명이 동의하면 괜찮다고 생각함",
  },
  {
    key: "apology",
    languageId: "apology_plan",
    scenarioId: "ap_action_plan",
    situation: "사과하거나 표현을 고쳐 말함",
    online: false,
    studentInput: "미안하다고 했는데 왜 안 풀리지",
    alternative: "아까 그렇게 말해서 미안해, 다음엔 이렇게 말할게",
    reflection: "사과에는 다음 약속이 있어야 한다는 걸 배웠다.",
    misconception: "'미안'이라는 단어만 말하면 끝이라고 생각함",
  },
  {
    key: "empathy",
    languageId: "emp_feel",
    scenarioId: "pg_left_out",
    situation: "친구 마음을 헤아려 공감 표현하기",
    online: false,
    studentInput: "그냥 놀자고 하면 되는 거 아니야?",
    alternative: "많이 속상했겠다, 같이 하자",
    reflection: "먼저 마음을 알아주는 말이 필요했다.",
  },
  {
    key: "self-reflect",
    languageId: "conf_i_message",
    scenarioId: "ap_mutual",
    situation: "자기 언어 습관을 성찰하고 실천 계획 세우기",
    online: false,
    studentInput: "나도 모르게 세게 말할 때가 많은 것 같아",
    alternative: "나는 그때 서운했어, 다음엔 미리 말해줘",
    reflection: "'너 때문에' 대신 '나는'으로 시작해보기로 했다.",
  },
  {
    key: "alt-swap",
    languageId: "alt_gaejjaejeung",
    scenarioId: "gc_smurf_frustration",
    situation: "습관적 비속어를 대체 표현으로 바꾸기",
    online: true,
    studentInput: "짜증날 때 다른 말이 안 떠올라",
    alternative: "속상해 / 답답해 / 아쉬워",
    reflection: "감정을 정확히 부르면 덜 화가 났다.",
  },
  {
    key: "newword",
    languageId: "nw_bbunhaejyeo",
    scenarioId: "school_exclude_lunch",
    situation: "사람을 분류하는 신조어 사용",
    online: false,
    studentInput: "쟤는 분리수거 대상임ㅋㅋ",
    alternative: "우리 자리 하나 더 만들자",
    reflection: "사람에게 쓰면 안 되는 말이 있다는 걸 알았다.",
    misconception: "유행하는 말이라 괜찮다고 생각함",
  },
  {
    key: "threat",
    languageId: "game_report",
    scenarioId: "gc_report_threat",
    situation: "사소한 일로 신고하겠다고 위협함",
    online: true,
    studentInput: "너 신고각이야 진짜",
    alternative: "다음 판은 위치 먼저 알려줄래?",
    reflection: "위협하는 말은 문제를 더 키웠다.",
  },
  {
    key: "abbr-polite",
    languageId: "abbr_ㅈㅅ",
    scenarioId: "ap_online",
    situation: "온라인에서 줄임말로 사과함",
    online: true,
    studentInput: "ㅈㅅ 이러고 넘어갔는데 왜 서운해해",
    alternative: "아까 일 정말 미안해, 내가 성급했어",
    reflection: "짧은 사과는 성의 없게 느껴질 수 있다.",
    misconception: "줄임말 사과도 똑같은 사과라고 생각함",
  },
];

export type DemoProfileSpec = {
  number: string;
  persona: DemoPersona;
  trend: DemoTrend;
  participation: "high" | "mid" | "low";
  /** DEMO_FOCUS_ITEMS 의 key 목록 */
  focus: string[];
  /** 완료 단계 수 (1~5) */
  stagesDone: 1 | 2 | 3 | 4 | 5;
  /** 7일 챌린지에서 실제 체크한 날 수 */
  challengeDone: number;
  challengeStopAfter?: number;
  assistantTurns: number;
  note: string;
};

/** 학생01~학생17 — 참여도·성장 곡선이 서로 다른 17명. */
export const DEMO_PROFILE_SPECS: DemoProfileSpec[] = [
  { number: "01", persona: "confident", trend: "improving", participation: "high", focus: ["game-anger", "apology", "self-reflect", "empathy"], stagesDone: 5, challengeDone: 7, assistantTurns: 5, note: "꾸준히 참여하며 대체 표현을 스스로 제안" },
  { number: "02", persona: "curious", trend: "improving", participation: "high", focus: ["meme-misread", "share-consent", "alt-swap"], stagesDone: 5, challengeDone: 6, assistantTurns: 4, note: "밈의 유래를 끝까지 확인하려는 태도" },
  { number: "03", persona: "defensive", trend: "stable", participation: "mid", focus: ["blame", "offline-slang", "apology"], stagesDone: 3, challengeDone: 3, challengeStopAfter: 4, assistantTurns: 4, note: "책임 전가 반응이 반복되어 공감 단계에서 정체" },
  { number: "04", persona: "shy", trend: "improving", participation: "mid", focus: ["kakao-read", "empathy"], stagesDone: 4, challengeDone: 5, assistantTurns: 3, note: "말수는 적지만 성찰 글이 구체적" },
  { number: "05", persona: "emotional", trend: "declining", participation: "mid", focus: ["game-anger", "game-taunt", "threat"], stagesDone: 3, challengeDone: 2, challengeStopAfter: 3, assistantTurns: 5, note: "감정 격해질 때 표현이 거칠어짐" },
  { number: "06", persona: "quiet", trend: "stable", participation: "low", focus: ["nickname"], stagesDone: 2, challengeDone: 1, challengeStopAfter: 2, assistantTurns: 1, note: "참여 빈도가 낮아 추가 안내 필요" },
  { number: "07", persona: "confident", trend: "improving", participation: "high", focus: ["exclusion", "empathy", "apology", "self-reflect"], stagesDone: 5, challengeDone: 7, assistantTurns: 4, note: "배제 상황에서 중재 표현을 시도" },
  { number: "08", persona: "curious", trend: "stable", participation: "mid", focus: ["newword", "meme-misread"], stagesDone: 3, challengeDone: 4, assistantTurns: 3, note: "신조어 뜻 찾기에 관심이 높음" },
  { number: "09", persona: "defensive", trend: "improving", participation: "mid", focus: ["comment-tease", "share-consent", "apology"], stagesDone: 4, challengeDone: 5, assistantTurns: 5, note: "초기 방어 반응 후 사과 표현으로 전환" },
  { number: "10", persona: "shy", trend: "stable", participation: "low", focus: ["kakao-read", "abbr-polite"], stagesDone: 2, challengeDone: 2, assistantTurns: 2, note: "온라인 오해 상황에서 도움 요청이 적음" },
  { number: "11", persona: "emotional", trend: "improving", participation: "high", focus: ["offline-slang", "alt-swap", "self-reflect"], stagesDone: 4, challengeDone: 6, assistantTurns: 4, note: "감정 어휘를 늘리며 비속어 사용이 감소" },
  { number: "12", persona: "confident", trend: "stable", participation: "mid", focus: ["sarcasm", "empathy"], stagesDone: 3, challengeDone: 3, assistantTurns: 2, note: "비꼬는 말투를 인식하기 시작" },
  { number: "13", persona: "curious", trend: "improving", participation: "high", focus: ["share-consent", "exclusion", "apology", "empathy"], stagesDone: 5, challengeDone: 7, assistantTurns: 5, note: "온라인 권리 개념을 또래에게 설명함" },
  { number: "14", persona: "quiet", trend: "declining", participation: "low", focus: ["nickname", "blame"], stagesDone: 2, challengeDone: 1, challengeStopAfter: 2, assistantTurns: 2, note: "최근 참여가 줄어 개별 상담 권장" },
  { number: "15", persona: "shy", trend: "improving", participation: "mid", focus: ["empathy", "abbr-polite", "apology"], stagesDone: 4, challengeDone: 5, assistantTurns: 3, note: "공감 표현을 문장으로 연습 중" },
  { number: "16", persona: "defensive", trend: "stable", participation: "mid", focus: ["threat", "blame", "offline-slang"], stagesDone: 3, challengeDone: 3, challengeStopAfter: 5, assistantTurns: 4, note: "위협 표현의 무게를 다루는 지도 필요" },
  { number: "17", persona: "emotional", trend: "improving", participation: "high", focus: ["game-anger", "alt-swap", "self-reflect", "apology"], stagesDone: 5, challengeDone: 6, assistantTurns: 5, note: "멈추고 말하기 전략을 스스로 사용" },
];