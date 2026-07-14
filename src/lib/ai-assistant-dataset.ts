/**
 * AI 수호비서 — 데이터 주도형 지식 데이터셋 & 추론 엔진.
 *
 * UI/UX(대화 형식)와 데이터(대화 콘텐츠)를 완벽히 분리하기 위해
 * 이 파일은 순수 데이터 + 순수 함수만 포함한다. React import 금지.
 *
 * 교사는 아래 `AI_KNOWLEDGE` 배열에 새 객체를 추가하는 것만으로
 * 챗봇의 응답 지식을 실시간 확장할 수 있다.
 */

export type AssistantPatternTag =
  | "패턴C" // 도덕[AI윤리] — 최우선 가중치
  | "패턴A" // 국어[어원/비속어]
  | "패턴B" // 도덕[사이버괴롭힘]
  | "일반"; // 기타

export type AssistantEntry = {
  keywords: string[];
  category: string; // 예: "국어[매체]-패턴A"
  bot_reply: string; // \n 개행 포함 가능
};

import { AI_KNOWLEDGE_EXTRA } from "./ai-assistant-dataset-extra";

/**
 * 마스터 데이터셋. 교사가 새 객체를 push 하면 즉시 챗봇에 반영된다.
 */
export const AI_KNOWLEDGE: AssistantEntry[] = [
  {
    keywords: ["알빠노", "알빠", "상관", "안물", "어쩔"],
    category: "국어[매체]-패턴A",
    bot_reply:
      "🤖 [매체 예절 진단 완료!]\n'알빠노'나 '안물'은 상대방의 의견을 가치 없다고 깎아내리며 소통을 단절하는 냉소적 밈이에요. 도덕의 '협동'과 국어의 '상호 존중' 가치에 어긋납니다.\n\n💡 순화어 대안:\n'그 일에 대해 내 의견은 조금 달라' 또는 '내가 더 도와줄 부분이 있을까?'라고 상대방의 마음을 존중하며 부드럽게 대화를 이어가 보세요.",
  },
  {
    keywords: ["존맛", "존예", "존멋", "존못", "존나", "핵존맛", "개이득", "개꿀"],
    category: "국어[어원]-패턴A",
    bot_reply:
      "🤖 [어원 오염 심층 분석!]\n'존-' 시리즈의 앞글자는 원래 남성의 신체를 상스럽게 비하하는 아주 부끄럽고 거친 욕설('남성의 중요 신체 부위')에서 유래했어요. 뜻을 모르고 강조 부사처럼 쓰더라도 결국 욕을 섞어 상대를 칭찬하는 꼴이 된답니다.\n\n💡 순화어 대안:\n'정말 예쁘다', '진짜 맛있다', '무척 멋지다'처럼 한글 고유의 아름답고 깨끗한 형용사를 사용해 보세요.",
  },
  {
    keywords: ["단톡방", "싸움", "뒷담", "저격", "놀려", "소외", "왕따"],
    category: "도덕[사이버]-패턴B",
    bot_reply:
      "🤖 [토닥토닥 사이버 감정 코칭]\n단톡방에서 친구들이 밈으로 나를 저격하거나 소외시켜 많이 속상했겠구나. 이때 감정적으로 대응하며 똑같이 비속어(밈)를 쓰면 사이버 언어폭력의 나쁜 순환이 일어나요.\n\n💡 바른말 실천 방법:\n국어 시간에 배운 '나-전송법(I-Message)'을 적용해 보세요. '너희가 단톡방에서 그렇게 밈으로 말하니까 내 마음이 조금 슬퍼. 장난을 멈춰줬으면 좋겠어'라고 정중하지만 단호하게 내 감정을 전송하는 것이 도덕적 용기랍니다.",
  },
  {
    keywords: ["바보", "멍청이", "개새", "미친", "새끼", "짜증", "새끼야"],
    category: "도덕[AI윤리]-패턴C",
    bot_reply:
      "🤖 [인공지능 윤리 수호 경고]\n앗! 저에게 거친 비속어나 정제되지 않은 유행어를 입력하셨네요. 도덕과에서 배우는 '인공지능 윤리'의 핵심은 사람이 아닌 AI 비서를 대할 때도 존중과 책임의 태도를 유지하는 것입니다.\n\n인공지능에게 함부로 대하는 언어 습관은 결국 친구를 대하는 습관으로 이어지며, 나의 언어 신경망을 오염시킵니다. 올바른 매체 리터러시를 위해 고운 말로 다시 질문해 주실 거죠?",
  },
  {
    keywords: ["인공지능", "챗봇", "AI", "ai", "로봇", "gpt"],
    category: "도덕[AI윤리]-패턴C",
    bot_reply:
      "🤖 [인공지능 대화 예절 안내]\n인공지능(챗봇)과 대화할 때도 사람과 이야기하듯 존중하는 태도가 중요해요. ①고운 말과 표준어 사용하기 ②명령이 아닌 부탁의 말투 쓰기 ③받은 답변을 그대로 베끼지 않고 스스로 다시 생각해 보기 — 이 세 가지가 도덕과 '인공지능 윤리'의 핵심 약속이랍니다.",
  },
  {
    keywords: ["인터넷", "댓글", "익명", "악플", "게시판", "누리망"],
    category: "도덕[사이버]-일반",
    bot_reply:
      "🤖 [누리망 에티켓 안내]\n가상 공간에서 익명성에 숨어 무심코 던진 한 줄의 댓글이나 인터넷 밈은 다른 사람의 마음에 깊은 칼날이 되어 돌아옵니다. 도덕적인 '시민 책임'을 다하기 위해, 글을 전송하기 전 '내가 이 말을 눈앞에서 친구에게 직접 할 수 있는가?'를 꼭 점검해 보세요.",
  },
  ...AI_KNOWLEDGE_EXTRA,
];

// 돌발 질문 대응 랜덤 풀 — 단일 반복 답변 방지, 자연스러운 대화 흐름 연출.
export const ASSISTANT_FALLBACK_POOL: string[] = [
  "🤖 음~ 그 말도 흥미롭지만, 우리 방금 배운 바른말 대안 표현으로 다시 이야기해 볼까?",
  "🤖 친구야, 방금 사용한 단어는 우리 반 유해 점수를 올릴 수 있어! 고운 말로 물어봐 줄래?",
  "🤖 수호비서는 방금 한 말을 분석 중이야! 혹시 '사전 등록'이나 '바른말 실천'에 대해 궁금한 건 없어?",
  "🤖 거친 밈이나 신조어 대신, 서로의 마음에 공감해 주는 말을 건네면 기상도가 맑아질 거야!",
  "🤖 무슨 뜻인지 이해했어요! 하지만 우리 조금 더 예쁜 문장으로 대화를 이어 나가봐요.",
];

export function pickFallback(): string {
  return ASSISTANT_FALLBACK_POOL[Math.floor(Math.random() * ASSISTANT_FALLBACK_POOL.length)];
}

// 하위 호환 — 기존 import 를 유지하기 위해 첫 항목을 노출.
export const ASSISTANT_FALLBACK = ASSISTANT_FALLBACK_POOL[0];

export const ASSISTANT_GREETING =
  "🤖 안녕! 나는 바른말 수호비서야.\n요즘 유행어·밈이 궁금하거나, 단톡방에서 속상한 일이 있다면 편하게 물어봐. 아래 가이드 질문을 눌러도 좋아!";

export type QuickReply = { icon: string; label: string; prompt: string };

export const QUICK_REPLIES: QuickReply[] = [
  {
    icon: "🔍",
    label: "'존멋'·'개이득' 같은 말",
    prompt: "요즘 유행하는 '존멋', '개이득' 같은 말은 왜 쓰면 안 되나요?",
  },
  {
    icon: "💡",
    label: "단톡방에서 놀림 받을 때",
    prompt: "단톡방에서 친구가 밈으로 놀릴 때 어떻게 대처해요?",
  },
  {
    icon: "🤖",
    label: "AI 챗봇과의 대화 예절",
    prompt: "인공지능(챗봇)과 대화할 때 지켜야 할 예절은 무엇인가요?",
  },
  {
    icon: "🌱",
    label: "인터넷 댓글 도덕",
    prompt: "인터넷 게시판에 댓글을 달 때 도덕적으로 주의할 점은?",
  },
];

/** 패턴 태그의 우선순위 가중치. 숫자가 클수록 먼저 매칭된다. */
const PATTERN_WEIGHT: Record<AssistantPatternTag, number> = {
  패턴C: 3,
  패턴A: 2,
  패턴B: 1,
  일반: 0,
};

function detectPattern(category: string): AssistantPatternTag {
  if (category.includes("패턴C")) return "패턴C";
  if (category.includes("패턴A")) return "패턴A";
  if (category.includes("패턴B")) return "패턴B";
  return "일반";
}

export type AssistantMatch = {
  entry: AssistantEntry;
  pattern: AssistantPatternTag;
  matchedKeywords: string[];
} | null;

/**
 * 지능형 키워드 토큰 검색 + 패턴 우선순위 매칭.
 * 1) 문장 전체에 대해 모든 데이터셋 항목의 keywords 배열을 스크리닝
 * 2) 매칭된 항목들 중 패턴 가중치(C > A > B > 일반) 최상위 항목을 채택
 * 3) 동률이면 매칭 키워드 개수 → 데이터셋 등장 순서로 결정
 */
export function matchAssistantReply(
  userText: string,
  knowledge: AssistantEntry[] = AI_KNOWLEDGE,
): AssistantMatch {
  const haystack = userText.toLowerCase();
  const hits: {
    entry: AssistantEntry;
    pattern: AssistantPatternTag;
    matchedKeywords: string[];
    order: number;
  }[] = [];

  knowledge.forEach((entry, order) => {
    const matched = entry.keywords.filter((k) => haystack.includes(k.toLowerCase()));
    if (matched.length > 0) {
      hits.push({
        entry,
        pattern: detectPattern(entry.category),
        matchedKeywords: matched,
        order,
      });
    }
  });

  if (hits.length === 0) return null;

  hits.sort((a, b) => {
    const w = PATTERN_WEIGHT[b.pattern] - PATTERN_WEIGHT[a.pattern];
    if (w !== 0) return w;
    const k = b.matchedKeywords.length - a.matchedKeywords.length;
    if (k !== 0) return k;
    return a.order - b.order;
  });

  const top = hits[0];
  return { entry: top.entry, pattern: top.pattern, matchedKeywords: top.matchedKeywords };
}

export function assistantReplyFor(
  userText: string,
  knowledge?: AssistantEntry[],
): {
  reply: string;
  match: AssistantMatch;
} {
  const match = matchAssistantReply(userText, knowledge);
  return {
    reply: match ? match.entry.bot_reply : ASSISTANT_FALLBACK,
    match,
  };
}
