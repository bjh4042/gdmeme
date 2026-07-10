import type { DictEntry } from "./literacy-types";

export const SEED_DICT: DictEntry[] = [
  {
    id: 1,
    word: "핑프",
    student_definition: "스스로 찾아보지 않고 남에게 무조건 물어보는 사람을 비꼬는 말",
    suggested_by: "3105_14",
    source: "온라인 커뮤니티(디시인사이드 등)",
    evaluations: { aggression: 3, bullying: 4, discrimination: 1, violence: 1, grammar_destruction: 4 },
    total_harmful_score: 52,
    status: "approved",
    grade: "주의/경고",
    alternatives: ["의존적인 사람", "스스로 찾아보지 않는 습관"],
    curriculum_code: "4국01-02",
    timestamp: "2026-07-10 10:00:00",
  },
  {
    id: 2,
    word: "누칼협",
    student_definition: "누가 칼 들고 협박함의 줄임말로 타인의 힘든 상황을 비웃는 말",
    suggested_by: "3105_02",
    source: "온라인 커뮤니티, 유튜브 댓글",
    evaluations: { aggression: 5, bullying: 5, discrimination: 2, violence: 4, grammar_destruction: 4 },
    total_harmful_score: 80,
    status: "approved",
    grade: "위험/사용 금지",
    alternatives: ["너의 선택이었지만 속상하겠구나", "많이 힘들었겠네"],
    curriculum_code: "6국01-02",
    timestamp: "2026-07-10 11:20:00",
  },
  {
    id: 3,
    word: "어쩔티비",
    student_definition: "어쩌라고 티비나 봐라 라는 뜻으로 상대방의 말을 무시하는 표현",
    suggested_by: "3105_07",
    source: "틱톡, 유튜브 쇼츠",
    evaluations: { aggression: 4, bullying: 4, discrimination: 1, violence: 1, grammar_destruction: 5 },
    total_harmful_score: 60,
    status: "approved",
    grade: "주의/경고",
    alternatives: ["네 생각을 존중해", "그렇게 생각할 수도 있겠구나"],
    curriculum_code: "4국01-02",
    timestamp: "2026-07-10 09:10:00",
  },
  {
    id: 4,
    word: "억텐",
    student_definition: "억지 텐션의 줄임말로 무리하게 밝은 척하는 모습",
    suggested_by: "3105_11",
    source: "유튜브 예능 채널",
    evaluations: { aggression: 2, bullying: 2, discrimination: 1, violence: 1, grammar_destruction: 4 },
    total_harmful_score: 40,
    status: "approved",
    grade: "안전/순화 필요",
    alternatives: ["일부러 활기찬 척", "무리해서 밝은 척"],
    curriculum_code: "4국01-02",
    timestamp: "2026-07-10 12:00:00",
  },
  {
    id: 5,
    word: "찐",
    student_definition: "진짜의 줄임말",
    suggested_by: "3105_04",
    source: "일상 대화, SNS",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
    total_harmful_score: 28,
    status: "approved",
    grade: "안전/순화 필요",
    alternatives: ["진짜", "정말로"],
    curriculum_code: "4국01-02",
    timestamp: "2026-07-10 13:00:00",
  },
  {
    id: 6,
    word: "GG",
    student_definition: "게임을 포기한다는 뜻으로 쓰이는 표현",
    suggested_by: "3105_09",
    source: "온라인 게임(롤, 배그 등)",
    evaluations: { aggression: 2, bullying: 2, discrimination: 1, violence: 1, grammar_destruction: 3 },
    total_harmful_score: 36,
    status: "approved",
    grade: "안전/순화 필요",
    alternatives: ["포기할게", "잘했어 (Good Game)"],
    curriculum_code: "4국01-02",
    timestamp: "2026-07-10 14:20:00",
  },
];

export const MEME_TRIGGERS = ["어쩔티비", "저쩔티비", "누칼협", "핑프", "억텐", "찐따", "노잼", "꺼져", "존버", "ㅅㅂ", "ㅄ", "ㅈㄴ", "빡친다", "개짜증"];

export type Scenario = {
  id: string;
  npc: string;
  emoji: string;
  opening: string;
  goodExampleHint: string;
  guide: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "teacher-late",
    npc: "담임 선생님",
    emoji: "👩‍🏫",
    opening: "○○아, 오늘 왜 지각했니? 무슨 일 있었어?",
    goodExampleHint: "죄송합니다. 늦잠을 자서 늦었습니다. 앞으로 조심하겠습니다.",
    guide: "선생님께 죄송한 마음을 담아 상황을 설명해 보세요. '죄송합니다'로 문장을 시작해 볼까요?",
  },
  {
    id: "parent-phone",
    npc: "엄마",
    emoji: "👩",
    opening: "핸드폰만 보고 있네? 숙제는 다 했어?",
    goodExampleHint: "죄송해요, 조금만 더 보고 바로 숙제할게요.",
    guide: "부모님을 존중하는 마음으로, 앞으로 어떻게 할지 계획을 담아 답해 보세요.",
  },
  {
    id: "new-friend",
    npc: "처음 본 친구",
    emoji: "🧒",
    opening: "안녕! 나는 옆 반 하늘이야. 너 이름이 뭐야?",
    goodExampleHint: "안녕! 나는 ○○이야. 만나서 반가워.",
    guide: "밝게 인사한 뒤, 자신의 이름을 소개하고 반가운 마음을 표현해 보세요.",
  },
  {
    id: "librarian",
    npc: "도서관 선생님",
    emoji: "📚",
    opening: "얘야, 도서관에서는 조용히 해야 한단다.",
    goodExampleHint: "네, 죄송합니다. 조용히 하겠습니다.",
    guide: "규칙을 지키지 못한 점을 인정하고 앞으로의 행동을 약속하는 문장으로 답해 보세요.",
  },
];

export type QuizItem = {
  q: string;
  choices: string[];
  answer: number;
  explain: string;
};

export const QUIZZES: QuizItem[] = [
  {
    q: "'어쩔티비'를 바른 말로 바꾸면?",
    choices: ["네 생각을 존중해", "저리 가라", "됐거든", "몰라"],
    answer: 0,
    explain: "상대방을 존중하는 말로 바꾸면 대화가 부드러워져요.",
  },
  {
    q: "'누칼협'에 담긴 태도는?",
    choices: ["공감과 위로", "친구를 놀리고 비웃음", "칭찬과 격려", "사과와 반성"],
    answer: 1,
    explain: "상대의 힘든 상황을 조롱하는 표현으로 사용을 피해야 합니다.",
  },
  {
    q: "'핑프'와 반대되는 좋은 태도는?",
    choices: ["아무 것도 안 하기", "스스로 찾아보고 질문하기", "친구 답 베끼기", "선생님만 믿기"],
    answer: 1,
    explain: "먼저 스스로 찾아본 뒤 질문하는 태도가 바람직합니다.",
  },
  {
    q: "친구가 실수했을 때 바른 말은?",
    choices: ["개웃겨 ㅋㅋ", "괜찮아, 누구나 실수할 수 있어", "핑프 아니야?", "노잼"],
    answer: 1,
    explain: "친구를 배려하는 말은 관계를 따뜻하게 만듭니다.",
  },
  {
    q: "'억텐'의 뜻은?",
    choices: ["억지로 밝은 척", "억울한 텐션", "억센 팀장", "억센 텐트"],
    answer: 0,
    explain: "'억지 텐션'의 줄임말이에요.",
  },
];