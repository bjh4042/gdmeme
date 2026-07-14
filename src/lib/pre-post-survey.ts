// 「바른말 수호」 사전·사후 검사 유틸.
// - 4영역 × 3문항 = 12문항 (일부 부정문항 역채점).
// - 리커트 1~5.
// - localStorage 에 학급/학생/단계(pre|post) 단위로 저장 (Zustand 없이 순수 유틸).
// - 익명화 옵션은 화면단에서 별도 처리.

export type SurveyStage = "pre" | "post";
export type SurveyDomain = "awareness" | "empathy" | "rewrite" | "practice";

export type SurveyItem = {
  id: string;
  domain: SurveyDomain;
  text: string;
  reverse?: boolean;
};

export const DOMAIN_META: Record<SurveyDomain, { label: string; icon: string; color: string }> = {
  awareness: { label: "언어 민감성", icon: "🔎", color: "#0ea5e9" },
  empathy: { label: "공감·존중", icon: "💗", color: "#ef4444" },
  rewrite: { label: "표현 바꾸기", icon: "✏️", color: "#f59e0b" },
  practice: { label: "실천 의지", icon: "🌱", color: "#10b981" },
};

export const SURVEY_ITEMS: SurveyItem[] = [
  { id: "a1", domain: "awareness", text: "나는 친구나 인터넷에서 쓰는 말 중 어떤 말이 상처를 줄 수 있는지 잘 알아본다." },
  { id: "a2", domain: "awareness", text: "새로운 신조어나 밈을 들으면 그 뜻과 유래를 확인해 본다." },
  { id: "a3", domain: "awareness", text: "재미있는 말이라면 뜻을 몰라도 그냥 따라 써도 된다.", reverse: true },

  { id: "e1", domain: "empathy", text: "누군가 나쁜 말을 들었을 때 그 사람의 마음이 어떨지 상상해 본다." },
  { id: "e2", domain: "empathy", text: "친구가 상처받는 말을 들으면 내 일처럼 마음이 쓰인다." },
  { id: "e3", domain: "empathy", text: "장난이라면 조금 심한 말도 괜찮다.", reverse: true },

  { id: "r1", domain: "rewrite", text: "거친 표현이 떠올라도 존중하는 표현으로 바꾸어 말할 수 있다." },
  { id: "r2", domain: "rewrite", text: "친구가 나쁜 말을 썼을 때, 어떻게 바꿔 말하면 좋을지 알려줄 수 있다." },
  { id: "r3", domain: "rewrite", text: "화가 나면 어떤 말이 나가든 어쩔 수 없다.", reverse: true },

  { id: "p1", domain: "practice", text: "교실이나 온라인에서 바른말을 쓰려고 스스로 노력한다." },
  { id: "p2", domain: "practice", text: "친구가 나쁜 말을 하면 조용히 그만하자고 말할 수 있다." },
  { id: "p3", domain: "practice", text: "나는 앞으로도 계속 바른말 수호대의 약속을 지킬 것이다." },
];

export type SurveyAnswer = {
  stage: SurveyStage;
  studentId: string;
  classCode: string;
  answers: Record<string, number>; // itemId -> 1..5 (원본, 역채점 전)
  submittedAt: string;
};

const KEY = "wtmeme:store:pre-post-survey:v1";

type StoreShape = Record<string, SurveyAnswer>; // key: `${classCode}::${studentId}::${stage}`

function safeLoad(): StoreShape {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === "object" ? (p as StoreShape) : {};
  } catch {
    return {};
  }
}
function safeSave(s: StoreShape) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
    // 변경 알림용 이벤트 (교사 대시보드 재렌더)
    window.dispatchEvent(new CustomEvent("wtmeme:survey:changed"));
  } catch {}
}
function keyOf(classCode: string, studentId: string, stage: SurveyStage) {
  return `${classCode}::${studentId}::${stage}`;
}

export function saveAnswer(a: SurveyAnswer) {
  const s = safeLoad();
  s[keyOf(a.classCode, a.studentId, a.stage)] = a;
  safeSave(s);
}

export function loadAnswer(classCode: string, studentId: string, stage: SurveyStage): SurveyAnswer | undefined {
  const s = safeLoad();
  return s[keyOf(classCode, studentId, stage)];
}

export function loadAllAnswers(): SurveyAnswer[] {
  return Object.values(safeLoad());
}

/** 원본 응답을 역채점 처리해 리커트 1..5 로 정규화 (역채점 문항: 6 - v). */
export function normalizeAnswer(itemId: string, raw: number): number {
  const item = SURVEY_ITEMS.find((x) => x.id === itemId);
  if (!item) return raw;
  return item.reverse ? 6 - raw : raw;
}

/** 응답 → 영역별 평균 점수 (1..5). */
export function scoreByDomain(answers: Record<string, number>): Record<SurveyDomain, number> {
  const sums: Record<SurveyDomain, number> = { awareness: 0, empathy: 0, rewrite: 0, practice: 0 };
  const counts: Record<SurveyDomain, number> = { awareness: 0, empathy: 0, rewrite: 0, practice: 0 };
  for (const item of SURVEY_ITEMS) {
    const raw = answers[item.id];
    if (typeof raw !== "number") continue;
    sums[item.domain] += normalizeAnswer(item.id, raw);
    counts[item.domain] += 1;
  }
  const out: Record<SurveyDomain, number> = { awareness: 0, empathy: 0, rewrite: 0, practice: 0 };
  (Object.keys(sums) as SurveyDomain[]).forEach((k) => {
    out[k] = counts[k] ? sums[k] / counts[k] : 0;
  });
  return out;
}

/** 전체 총점(20점 만점)으로 환산 — 리커트 평균×4. */
export function overallScore(answers: Record<string, number>): number {
  const d = scoreByDomain(answers);
  const arr = Object.values(d);
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.round(avg * 4 * 10) / 10; // 4..20
}

export function summarizeClass(classCode: string, students: { id: string; classCode: string; name: string }[]) {
  const scope = students.filter((s) => s.classCode === classCode);
  const perStage: Record<SurveyStage, { count: number; domains: Record<SurveyDomain, number>; overall: number }> = {
    pre: { count: 0, domains: { awareness: 0, empathy: 0, rewrite: 0, practice: 0 }, overall: 0 },
    post: { count: 0, domains: { awareness: 0, empathy: 0, rewrite: 0, practice: 0 }, overall: 0 },
  };
  const pairs: { student: (typeof students)[number]; pre?: SurveyAnswer; post?: SurveyAnswer }[] = [];
  for (const s of scope) {
    const pre = loadAnswer(s.classCode, s.id, "pre");
    const post = loadAnswer(s.classCode, s.id, "post");
    pairs.push({ student: s, pre, post });
    for (const stage of ["pre", "post"] as SurveyStage[]) {
      const a = stage === "pre" ? pre : post;
      if (!a) continue;
      const dom = scoreByDomain(a.answers);
      const bucket = perStage[stage];
      bucket.count += 1;
      bucket.overall += overallScore(a.answers);
      (Object.keys(dom) as SurveyDomain[]).forEach((k) => {
        bucket.domains[k] += dom[k];
      });
    }
  }
  (["pre", "post"] as SurveyStage[]).forEach((st) => {
    const b = perStage[st];
    if (b.count > 0) {
      b.overall = Math.round((b.overall / b.count) * 10) / 10;
      (Object.keys(b.domains) as SurveyDomain[]).forEach((k) => {
        b.domains[k] = Math.round((b.domains[k] / b.count) * 100) / 100;
      });
    }
  });
  return { pairs, perStage };
}
