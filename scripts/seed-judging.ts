/**
 * 교육연구대회 심사용 데이터셋 생성기 (일회성 스크립트, 앱 런타임과 무관).
 * 학생 활동 → XP → STEP → 배지 → 칭호 → 리포트가 프로젝트 실제 로직으로 연결되도록
 * 활동 이벤트를 먼저 만들고, 그 결과를 각 스토어 스냅샷으로 직렬화한다.
 */
import { writeFileSync, readFileSync } from "node:fs";
import { derivedUnlocked, representativeBadge, type BadgeStats } from "../src/lib/badges";
import { computeTotal, gradeOf, type DictEntry, type StudentRecord } from "../src/lib/literacy-types";
import { DEFAULT_DICT_CURRICULUM_CODE, DEFAULT_DICT_CURRICULUM_CODES } from "../src/lib/curriculum-standards";

const CLASS = "3105";
const SCENARIOS = ["teacher-late", "parent-phone", "new-friend", "librarian", "slang-master"];

function rngOf(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const iso = (d: Date) => d.toISOString();
const dstr = (d: Date) => d.toISOString().slice(0, 10);
function at(dateStr: string, h: number, m: number) {
  return new Date(`${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`);
}
function weekdaysBetween(a: string, b: string) {
  const out: string[] = [];
  const d = new Date(a + "T00:00:00.000Z");
  const end = new Date(b + "T00:00:00.000Z");
  while (d <= end) {
    const w = d.getUTCDay();
    if (w >= 1 && w <= 5) out.push(dstr(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const SCHOOL_DAYS = weekdaysBetween("2026-04-06", "2026-07-31");

type Ev = { at: string; who: string; kind: string; delta: number; note?: string; classCode: string };

const WORD_POOL = [
  "어쩔티비", "저쩔티비", "노잼", "핵노잼", "개이득", "갑분싸", "인싸", "아싸", "국룰",
  "낄끼빠빠", "삼귀다", "반모", "어그로", "발컨", "버스탄다", "캐리", "트롤", "문찐",
  "뇌절", "극혐", "노답", "씹덕", "관종", "억텐", "실화냐", "지린다", "오지고요",
  "손절", "정색", "고인물", "찍먹", "부먹", "혼틈", "알잘딱", "머선129", "삐끼삐끼",
  "중2병", "느좋", "완내스", "럭키비키",
];
const DEFS = [
  "게임 채팅에서 친구를 놀릴 때 자주 쓰는 말이에요.",
  "유튜브 댓글에서 보고 뜻도 모른 채 따라 쓰게 되는 말이에요.",
  "학원 단톡방에서 친구들이 자주 쓰는 유행어예요.",
  "쉬는 시간에 친구들끼리 장난치며 쓰는 말이에요.",
  "숏폼 영상에서 유행해서 우리 반에서도 많이 들려요.",
];
const CONTEXTS = ["게임 채팅", "학급 단톡방", "쉬는 시간 교실", "온라인 학습방", "학원 가는 길"];
const SOURCES = ["유튜브 숏폼", "온라인 게임 채팅", "친구들 대화", "SNS 댓글", "학원 단톡방"];
const LISTENER = [
  "듣는 친구는 무시당하는 기분이 들 것 같아요.",
  "장난이어도 마음이 상할 수 있어요.",
  "여러 번 들으면 자신감이 떨어질 것 같아요.",
  "친구 사이가 멀어질 수 있어요.",
];
const ALTS = [
  ["그렇게 생각했구나", "다시 말해줄래?"],
  ["같이 하자", "괜찮아"],
  ["고마워", "네 말도 맞아"],
  ["조금 아쉬웠어", "다음엔 잘하자"],
];
const JOURNALS = [
  "오늘은 친구에게 화를 참고 '괜찮아'라고 말했다.",
  "게임에서 진 친구에게 놀리는 말을 하지 않았다.",
  "단톡방에서 줄임말 대신 바른 말로 썼다.",
  "친구가 속상해할 때 '그랬구나' 하고 들어주었다.",
  "나쁜 말을 쓰고 싶었지만 참고 다른 말로 바꿨다.",
  "오늘 배운 낱말의 뜻을 찾아보고 안 쓰기로 했다.",
  "동생에게 짜증 대신 부드럽게 말했다.",
  "친구 칭찬을 한 번 더 해 보았다.",
  "댓글을 쓰기 전에 한 번 더 읽어보았다.",
  "선생님께 감사 인사를 드렸다.",
  "오늘 처음 알았어요. 이 말이 나쁜 뜻이었어요.",
  "친구 말을 듣고 내 말투를 고쳤어요.",
  "다음에는 예쁜 말을 쓰고 싶어요.",
  "친구와 사이좋게 이야기했어요.",
  "화가 났지만 크게 숨을 쉬고 말했어요.",
  "줄임말을 쓰지 않고 끝까지 말해 보았어요.",
  "모둠 활동에서 친구 말을 끝까지 들었어요.",
  "게임 채팅에서 욕을 보고 신고했어요.",
  "엄마한테 고맙다고 말했어요.",
  "친구가 실수했을 때 괜찮다고 말해 주었어요.",
  "오늘은 말하기 전에 세 번 생각했어요.",
  "짝꿍에게 먼저 인사했어요.",
  "나쁜 말을 들었지만 따라 하지 않았어요.",
  "친구를 별명 대신 이름으로 불렀어요.",
  "속상한 마음을 말로 잘 이야기했어요.",
  "SNS에 착한 댓글을 하나 남겼어요.",
  "형에게 짜증내지 않고 부탁했어요.",
  "오늘 배운 바른 말을 하나 외웠어요.",
  "친구가 웃어줘서 기분이 좋았어요.",
  "다투고 나서 먼저 미안하다고 했어요.",
];
const CH_REFLECT = [
  "고운 말을 쓰니 친구가 웃어주었다.",
  "뜻을 찾아보니 함부로 쓸 말이 아니었다.",
  "채팅에서도 예의를 지켰다.",
  "친구 마음을 알아주는 말을 했다.",
  "나쁜 말 대신 바른 말로 바꿔 말했다.",
  "AI가 알려준 걸 사전에서 다시 확인했다.",
  "이번 주에 화를 참은 게 가장 잘한 일이다.",
];
const MISSION_NOTES = ["언어예절", "사이버예절", "존중표현", "정보판별"];
const SEARCH_NOTES = ["신조어 탐색", "밈 표현 분석", "줄임말 뜻 찾기", "혐오 표현 확인"];

// ── 학생별 활동 강도 프로필 (17명 모두 상이) ──────────────────────
type Profile = {
  n: number;
  sessions: number;
  proposals: number;
  approveRate: number;
  reactions: number;
  journalCount: number;
  streakRun: number;
  roleplay: number;
  practice: number;
  challenge: number;
  quizzes: number;
  missions: number;
  searches: number;
};
const PROFILES: Profile[] = [
  // ── STEP5 완료(10명): 제안·공감3+·저널·실천기록 모두 충족 ─────────
  { n: 1, sessions: 32, proposals: 5, approveRate: 1, reactions: 62, journalCount: 18, streakRun: 15, roleplay: 5, practice: 9, challenge: 7, quizzes: 18, missions: 13, searches: 18 },
  { n: 2, sessions: 26, proposals: 3, approveRate: 1, reactions: 34, journalCount: 12, streakRun: 8, roleplay: 4, practice: 6, challenge: 7, quizzes: 9, missions: 8, searches: 11 },
  { n: 3, sessions: 22, proposals: 3, approveRate: 0.67, reactions: 24, journalCount: 9, streakRun: 7, roleplay: 4, practice: 4, challenge: 6, quizzes: 7, missions: 6, searches: 9 },
  { n: 4, sessions: 18, proposals: 2, approveRate: 1, reactions: 21, journalCount: 7, streakRun: 5, roleplay: 3, practice: 3, challenge: 5, quizzes: 6, missions: 5, searches: 8 },
  { n: 5, sessions: 16, proposals: 2, approveRate: 0.5, reactions: 18, journalCount: 6, streakRun: 4, roleplay: 4, practice: 3, challenge: 4, quizzes: 5, missions: 4, searches: 7 },
  { n: 6, sessions: 15, proposals: 2, approveRate: 1, reactions: 12, journalCount: 5, streakRun: 3, roleplay: 3, practice: 2, challenge: 4, quizzes: 5, missions: 4, searches: 6 },
  { n: 7, sessions: 20, proposals: 3, approveRate: 1, reactions: 27, journalCount: 8, streakRun: 6, roleplay: 4, practice: 5, challenge: 7, quizzes: 8, missions: 7, searches: 10 },
  { n: 10, sessions: 24, proposals: 3, approveRate: 1, reactions: 31, journalCount: 10, streakRun: 7, roleplay: 5, practice: 5, challenge: 6, quizzes: 8, missions: 7, searches: 10 },
  { n: 14, sessions: 19, proposals: 2, approveRate: 1, reactions: 20, journalCount: 7, streakRun: 5, roleplay: 4, practice: 4, challenge: 5, quizzes: 6, missions: 6, searches: 8 },
  { n: 16, sessions: 28, proposals: 4, approveRate: 0.75, reactions: 44, journalCount: 13, streakRun: 10, roleplay: 5, practice: 7, challenge: 7, quizzes: 10, missions: 9, searches: 12 },
  // ── STEP4 진행(4명): 실천 기록 없음 + 연속 저널 3일 미만 ──────────
  { n: 8, sessions: 12, proposals: 1, approveRate: 1, reactions: 9, journalCount: 4, streakRun: 2, roleplay: 2, practice: 0, challenge: 5, quizzes: 5, missions: 4, searches: 6 },
  { n: 9, sessions: 10, proposals: 1, approveRate: 0, reactions: 6, journalCount: 3, streakRun: 1, roleplay: 3, practice: 0, challenge: 4, quizzes: 4, missions: 3, searches: 5 },
  { n: 12, sessions: 14, proposals: 2, approveRate: 0.5, reactions: 14, journalCount: 5, streakRun: 2, roleplay: 3, practice: 0, challenge: 6, quizzes: 5, missions: 4, searches: 6 },
  { n: 15, sessions: 11, proposals: 1, approveRate: 1, reactions: 8, journalCount: 3, streakRun: 1, roleplay: 2, practice: 0, challenge: 4, quizzes: 4, missions: 3, searches: 5 },
  // ── STEP3 진행(2명): 공감 3회 미만 ────────────────────────────────
  { n: 11, sessions: 9, proposals: 1, approveRate: 1, reactions: 2, journalCount: 2, streakRun: 1, roleplay: 2, practice: 0, challenge: 4, quizzes: 4, missions: 3, searches: 5 },
  { n: 13, sessions: 7, proposals: 1, approveRate: 0, reactions: 1, journalCount: 1, streakRun: 1, roleplay: 1, practice: 0, challenge: 3, quizzes: 4, missions: 3, searches: 5 },
  // ── STEP2 진행(1명): 저널·실천 없음, 공감 1회 ─────────────────────
  { n: 17, sessions: 6, proposals: 1, approveRate: 0, reactions: 1, journalCount: 0, streakRun: 0, roleplay: 1, practice: 0, challenge: 3, quizzes: 4, missions: 3, searches: 4 },
];

// ── ① 학생 명단 / 계정 ────────────────────────────────────────────
const roster: StudentRecord[] = [
  {
    id: `${CLASS}_00`, classCode: CLASS, number: "00", name: "선생님",
    password: "3105", xp: 0,
    joinedAt: "2026-04-06T00:00:00.000Z", lastActiveAt: "2026-07-31T09:00:00.000Z",
  },
  ...PROFILES.map((p) => ({
    id: `${CLASS}_${String(p.n).padStart(2, "0")}`,
    classCode: CLASS,
    number: String(p.n).padStart(2, "0"),
    name: `학생${p.n}`,
    password: String(1000 + p.n),
    group: p.n % 4 === 0 ? "4모둠" : p.n % 3 === 0 ? "3모둠" : p.n % 2 === 0 ? "2모둠" : "1모둠",
    xp: 0,
    joinedAt: "2026-04-06T09:00:00.000Z",
    lastActiveAt: "2026-04-06T09:00:00.000Z",
  })),
];

// ── ② 활동 데이터 생성 ────────────────────────────────────────────
const events: Ev[] = [];
const dictNew: DictEntry[] = [];
const engagement: Record<string, any> = {};
const likesByEntry: Record<number, Record<string, string[]>> = {};
const challenge: Record<string, any> = {};
const receivedByStudent: Record<string, number> = {};
let wordCursor = 0;
let dictId = 900001;

type StudentPlan = {
  id: string; who: string; p: Profile; r: () => number;
  days: string[]; myEntries: number[]; xp: number;
};
const plans: StudentPlan[] = [];

for (const p of PROFILES) {
  const id = `${CLASS}_${String(p.n).padStart(2, "0")}`;
  const who = `${id} 학생${p.n}`;
  const r = rngOf(31050 + p.n * 977);
  // 수업일 표본 — 4~7월 평일에 고르게 분포
  const days: string[] = [];
  const step = SCHOOL_DAYS.length / p.sessions;
  for (let i = 0; i < p.sessions; i++) {
    const idx = Math.min(SCHOOL_DAYS.length - 1, Math.floor(i * step + r() * step * 0.7));
    const d = SCHOOL_DAYS[idx];
    if (!days.includes(d)) days.push(d);
  }
  if (p.n <= 8) days.push("2026-07-31"); // 오늘 현황 표본
  days.sort();
  plans.push({ id, who, p, r, days, myEntries: [], xp: 0 });
  engagement[id] = {
    likesGivenCount: 0, likesReceivedCount: 0, journals: [], streak: 0,
    unlockedBadges: [], roleplayCleared: [], practiceLogs: [],
  };
  receivedByStudent[id] = 0;
}

function sessionTime(pl: StudentPlan, day: string) {
  const h = 9 + Math.floor(pl.r() * 6); // 09~14시
  const m = Math.floor(pl.r() * 50);
  return at(day, Math.min(h, 14), m);
}
function push(pl: StudentPlan, when: Date, kind: string, delta: number, note?: string, who?: string) {
  events.push({ at: iso(when), who: who ?? pl.who, kind, delta, note, classCode: CLASS });
  pl.xp += delta;
}

// 사전 제안 + 승인 (STEP1·2 근거)
for (const pl of plans) {
  for (let i = 0; i < pl.p.proposals; i++) {
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    const when = sessionTime(pl, day);
    const word = WORD_POOL[wordCursor++ % WORD_POOL.length];
    const evaluations = {
      aggression: Math.floor(pl.r() * 6),
      bullying: Math.floor(pl.r() * 6),
      discrimination: Math.floor(pl.r() * 5),
      violence: Math.floor(pl.r() * 4),
      grammar_destruction: Math.floor(pl.r() * 6),
    };
    const total = Math.min(100, Math.round(computeTotal(evaluations)));
    const approved = pl.r() < pl.p.approveRate;
    const eid = dictId++;
    dictNew.push({
      id: eid,
      word,
      student_definition: pick(pl.r, DEFS),
      suggested_by: pl.id,
      source: pick(pl.r, SOURCES),
      context_note: pick(pl.r, CONTEXTS),
      listener_effect: pick(pl.r, LISTENER),
      evaluations,
      total_harmful_score: total,
      status: approved ? "approved" : "pending",
      grade: gradeOf(total).label,
      alternatives: pick(pl.r, ALTS),
      curriculum_code: DEFAULT_DICT_CURRICULUM_CODE,
      curriculum_codes: [...DEFAULT_DICT_CURRICULUM_CODES],
      timestamp: iso(when).slice(0, 19).replace("T", " "),
      vote_count: 1,
    });
    pl.myEntries.push(eid);
    push(pl, when, "proposal", 5, word); // 제안 +5
    if (approved) {
      const aw = new Date(when.getTime() + 26 * 3600 * 1000);
      const awd = dstr(aw);
      const wd = SCHOOL_DAYS.includes(awd) ? awd : "2026-07-31";
      push(pl, at(wd, 13, 10), "word-approved", 5, word, `승인 · 학생${pl.p.n}`); // 승인 +5
    }
  }
}

// 선플 공감 (주는 쪽 +1 / 받는 쪽 +1)
const allEntries = dictNew.map((d) => ({ id: d.id, author: d.suggested_by, word: d.word }));
const KINDS = ["bravo", "learned", "cheer"];
for (const pl of plans) {
  const targets = allEntries.filter((e) => e.author !== pl.id);
  const used = new Set<string>();
  let given = 0;
  let guard = 0;
  while (given < pl.p.reactions && guard++ < 2000) {
    const t = pick(pl.r, targets);
    const k = pick(pl.r, KINDS);
    const key = `${t.id}:${k}`;
    if (used.has(key)) continue;
    used.add(key);
    given++;
    likesByEntry[t.id] = likesByEntry[t.id] ?? {};
    likesByEntry[t.id][pl.id] = [...(likesByEntry[t.id][pl.id] ?? []), k];
    receivedByStudent[t.author] += 1;
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    push(pl, sessionTime(pl, day), "reaction", 1, `${t.word} · ${k}`, `${pl.who}`);
  }
  engagement[pl.id].likesGivenCount = given;
}
// 공감받음 XP 반영
for (const pl of plans) {
  const got = receivedByStudent[pl.id];
  engagement[pl.id].likesReceivedCount = got;
  for (let i = 0; i < got; i++) {
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    push(pl, sessionTime(pl, day), "reaction", 1, "공감받음", `공감받음 · 학생${pl.p.n}`);
  }
}

// 성찰 저널 (+2, 3연속마다 +10) — 마지막 streakRun 은 연속일로 배치
for (const pl of plans) {
  const dates: string[] = [];
  const endBase = new Date("2026-07-31T00:00:00.000Z");
  for (let i = 0; i < pl.p.streakRun; i++) {
    const d = new Date(endBase);
    d.setUTCDate(d.getUTCDate() - i);
    dates.unshift(dstr(d));
  }
  const earlier = pl.p.journalCount - pl.p.streakRun;
  for (let i = 0; i < earlier; i++) {
    const d = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * Math.max(1, pl.days.length - 3)))];
    if (!dates.includes(d)) dates.unshift(d);
  }
  dates.sort();
  let streak = 0;
  let prev: string | null = null;
  const usedJournals = new Set<string>();
  const nextJournal = () => {
    for (let t = 0; t < 60; t++) {
      const s = pick(pl.r, JOURNALS);
      if (!usedJournals.has(s)) {
        usedJournals.add(s);
        return s;
      }
    }
    return JOURNALS.find((s) => !usedJournals.has(s)) ?? JOURNALS[0];
  };
  for (const d of dates) {
    const yd = prev ? new Date(new Date(prev + "T00:00:00Z").getTime() + 86400000) : null;
    streak = yd && dstr(yd) === d ? streak + 1 : 1;
    prev = d;
    const wd = SCHOOL_DAYS.includes(d);
    const when = wd ? sessionTime(pl, d) : at(d, 19, 20);
    engagement[pl.id].journals.push({ date: d, text: nextJournal() });
    push(pl, when, "journal", 2, "성찰 저널", pl.who);
    if (streak % 3 === 0) push(pl, when, "journal-streak", 10, "저널 3일 연속!", pl.who);
  }
  engagement[pl.id].streak = streak;
  engagement[pl.id].lastJournalDate = prev ?? undefined;
}

// 역할극 / 실천 기록 / 7일 챌린지 / 퀴즈 / 미션 / 디지털 언어 탐색
for (const pl of plans) {
  for (let i = 0; i < pl.p.roleplay; i++) {
    const sc = SCENARIOS[i];
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    engagement[pl.id].roleplayCleared.push(sc);
    push(pl, sessionTime(pl, day), "roleplay", 24, `${sc} · 완료`, pl.who);
  }
  if (pl.p.practice > 0) {
    const first = pl.days[0];
    push(pl, sessionTime(pl, first), "step5-plan", 10, "실천 계획 등록", pl.who);
    for (let i = 0; i < pl.p.practice; i++) {
      const d = new Date("2026-07-31T00:00:00.000Z");
      d.setUTCDate(d.getUTCDate() - (pl.p.practice - i));
      const ds = dstr(d);
      engagement[pl.id].practiceLogs.push({ date: ds, note: pick(pl.r, CH_REFLECT) });
      const when = SCHOOL_DAYS.includes(ds) ? sessionTime(pl, ds) : at(ds, 19, 40);
      push(pl, when, "step5-day", 4, `DAY${i + 1} 실천`, pl.who);
    }
    if (pl.p.practice >= 7) push(pl, at("2026-07-30", 13, 30), "step5-complete", 30, "7일 실천 완료", pl.who);
  }
  if (pl.p.challenge > 0) {
    const days: any[] = [];
    for (let d = 1; d <= pl.p.challenge; d++) {
      const dt = new Date("2026-07-20T00:00:00.000Z");
      dt.setUTCDate(dt.getUTCDate() + (d - 1));
      const ds = dstr(dt);
      days.push({ day: d, date: ds, completedAt: iso(at(ds, 13, 5)), reflection: CH_REFLECT[d - 1] });
      const when = SCHOOL_DAYS.includes(ds) ? at(ds, 13, 5) : at(ds, 19, 5);
      push(pl, when, "challenge7-day", 5, `DAY${d} 실천`, pl.who);
      if (d === 7) push(pl, when, "challenge7-complete", 20, "7일 실천 챌린지 완료", pl.who);
    }
    challenge[pl.id] = {
      days,
      ...(pl.p.challenge >= 6
        ? { teacherFeedback: "꾸준히 실천한 모습이 훌륭해요!", teacherFeedbackAt: "2026-07-29T05:00:00.000Z" }
        : {}),
    };
  }
  for (let i = 0; i < pl.p.quizzes; i++) {
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    push(pl, sessionTime(pl, day), "quiz", 10 + Math.floor(pl.r() * 6), "바른말 퀴즈", pl.who);
  }
  for (let i = 0; i < pl.p.missions; i++) {
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    push(pl, sessionTime(pl, day), "daily-mission", 3, pick(pl.r, MISSION_NOTES), pl.who);
  }
  for (let i = 0; i < pl.p.searches; i++) {
    const day = pl.days[Math.min(pl.days.length - 1, Math.floor(pl.r() * pl.days.length))];
    push(pl, sessionTime(pl, day), "assistant-hit", 2, pick(pl.r, SEARCH_NOTES), pl.who);
  }
}

// ── ④ XP 집계 ────────────────────────────────────────────────────
for (const pl of plans) {
  const rec = roster.find((s) => s.id === pl.id)!;
  rec.xp = pl.xp;
  const mine = events.filter((e) => e.who.includes(`학생${pl.p.n}`) || e.who === pl.who);
  const last = mine.map((e) => e.at).sort().at(-1);
  rec.joinedAt = at(pl.days[0], 9, 5).toISOString();
  rec.lastActiveAt = last ?? rec.joinedAt;
}
const classXP = plans.reduce((s, p) => s + p.xp, 0);

// ── ⑥⑦ 배지 · 칭호 (프로젝트 계산 함수 사용) ─────────────────────
const titles: Record<string, string> = {};
let badgeCount = 0;
for (const pl of plans) {
  const approvedWords = dictNew.filter((d) => d.suggested_by === pl.id && d.status === "approved").length;
  const stats: BadgeStats = {
    approvedWords,
    totalXP: pl.xp,
    votedCount: engagement[pl.id].likesGivenCount,
    journalStreak: engagement[pl.id].streak,
  };
  const keys = derivedUnlocked(stats);
  engagement[pl.id].unlockedBadges = keys;
  badgeCount += keys.length;
  const rep = representativeBadge(keys);
  if (rep) titles[pl.id] = rep.name;
}

// ── ⑩ 저장 페이로드 ──────────────────────────────────────────────
const activityLog = events.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 100);
const existingDict = JSON.parse(readFileSync("/tmp/seed/dict-current.json", "utf8")).state.entries as DictEntry[];
const keptDict = existingDict.filter((d) => !d.suggested_by.startsWith("3105_"));
const dictAll = [...dictNew, ...keptDict];

const out = {
  "wtmeme:store:roster:v1": { state: { students: roster }, version: 0 },
  "wtmeme:store:class:v1": { state: { byClass: { [CLASS]: { xp: classXP, activityLog } } }, version: 0 },
  "wtmeme:store:engagement:v1": { state: { byStudent: engagement, likesByEntry }, version: 0 },
  "wtmeme:store:dict:v1": { state: { entries: dictAll }, version: 0 },
  bmsd_challenge7_v1: { state: { byStudent: challenge }, version: 0 },
};
for (const [k, v] of Object.entries(out)) {
  writeFileSync(`/tmp/seed/${k.replace(/[:]/g, "_")}.json`, JSON.stringify(v));
}

// ── 검증 리포트 ──────────────────────────────────────────────────
const summary = {
  students: plans.length,
  teacher: 1,
  events: events.length,
  journals: plans.reduce((s, p) => s + engagement[p.id].journals.length, 0),
  roleplay: plans.reduce((s, p) => s + engagement[p.id].roleplayCleared.length, 0),
  proposals: dictNew.length,
  approved: dictNew.filter((d) => d.status === "approved").length,
  likes: plans.reduce((s, p) => s + engagement[p.id].likesGivenCount, 0),
  practice: plans.reduce((s, p) => s + engagement[p.id].practiceLogs.length, 0),
  challengeDays: Object.values(challenge).reduce((s: number, c: any) => s + c.days.length, 0),
  badges: badgeCount,
  titles: Object.keys(titles).length,
  classXP,
  perStudent: plans.map((p) => ({
    id: p.id,
    xp: p.xp,
    badges: engagement[p.id].unlockedBadges.length,
    title: titles[p.id] ?? "-",
    streak: engagement[p.id].streak,
    likes: engagement[p.id].likesGivenCount,
  })),
};
writeFileSync("/tmp/seed/summary.json", JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
