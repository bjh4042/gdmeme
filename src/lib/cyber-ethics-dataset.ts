import raw from "./cyber-ethics-dataset.json";

export type CyberEthicsSolution = {
  title: string;
  context: string;
  action_guide: string;
};

export type CyberEthicsEntry = {
  category: string;
  keywords: string[];
  student_question: string;
  bot_response: CyberEthicsSolution;
};

export const CYBER_ETHICS_DATASET: CyberEthicsEntry[] = raw as CyberEthicsEntry[];

/**
 * 사용자가 입력한 문장에서 사이버 행동 윤리 데이터셋의 keywords 중
 * 하나라도 매칭되면 가장 많이 겹친 엔트리를 돌려준다.
 * (동률이면 데이터셋 등장 순서 우선)
 */
export function matchCyberEthics(userText: string): {
  entry: CyberEthicsEntry;
  matched: string[];
} | null {
  const haystack = userText.toLowerCase().replace(/\s+/g, "");
  type Hit = { entry: CyberEthicsEntry; matched: string[]; order: number };
  const hits: Hit[] = [];
  CYBER_ETHICS_DATASET.forEach((entry, order) => {
    const matched = entry.keywords.filter((k) =>
      haystack.includes(k.toLowerCase().replace(/\s+/g, "")),
    );
    if (matched.length > 0) hits.push({ entry, matched, order });
  });
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.matched.length - a.matched.length || a.order - b.order);
  return { entry: hits[0].entry, matched: hits[0].matched };
}