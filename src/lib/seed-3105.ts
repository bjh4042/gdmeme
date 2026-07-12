// 20인 더미데이터 시드 · 학급 3105
// 최초 진입 시 1회 실행 → localStorage 플래그로 재시드 방지.
// 기존 학급별 격리(classCode) · 유저별 세션(ID) 분리 아키텍처 준수.

import { useRosterStore } from "@/stores/roster";
import { useClassStore } from "@/stores/class";
import { useEngagementStore, EMPTY_ENGAGEMENT } from "@/stores/engagement";
import { useDictStore } from "@/stores/dict";
import { derivedUnlocked, type BadgeStats } from "@/lib/badges";
import type { DictEntry, StudentRecord } from "@/lib/literacy-types";

const SEED_FLAG = "wtmeme:seed:3105:v5";
const CLASS_CODE = "3105";

type Row = {
  number: string;
  name: string;
  xp: number;
  approvedWords: number;
  voted: number;
  streak: number;
  roleplay: Record<"damim" | "mom" | "friend" | "librarian" | "jinwoo", number>;
  recent: string;
};

const ROWS: Row[] = [
  { number: "01", name: "강민준", xp: 340, approvedWords: 3, voted: 8, streak: 4, roleplay: { damim: 3, mom: 3, friend: 2, librarian: 0, jinwoo: 0 }, recent: "우리말 사전 공감 획득" },
  { number: "02", name: "고태양", xp: 720, approvedWords: 11, voted: 55, streak: 14, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 3 }, recent: "예절 역할극 최종 마스터 달성" },
  { number: "03", name: "김서연", xp: 45, approvedWords: 0, voted: 1, streak: 1, roleplay: { damim: 1, mom: 0, friend: 0, librarian: 0, jinwoo: 0 }, recent: "오늘의 성찰 저널 최초 작성" },
  { number: "04", name: "문채원", xp: 490, approvedWords: 6, voted: 22, streak: 8, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 2, jinwoo: 0 }, recent: "도서관 선생님 역할극 2단계 통과" },
  { number: "05", name: "박도현", xp: 185, approvedWords: 1, voted: 4, streak: 2, roleplay: { damim: 3, mom: 1, friend: 0, librarian: 0, jinwoo: 0 }, recent: "담임 선생님 역할극 최종 통과" },
  { number: "06", name: "백시은", xp: 310, approvedWords: 2, voted: 7, streak: 3, roleplay: { damim: 3, mom: 2, friend: 1, librarian: 0, jinwoo: 0 }, recent: "처음 본 친구 역할극 1단계 통과" },
  { number: "07", name: "서진우", xp: 520, approvedWords: 4, voted: 24, streak: 5, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 1 }, recent: "유행어 마스터 진우 역할극 진입" },
  { number: "08", name: "송민성", xp: 210, approvedWords: 2, voted: 6, streak: 0, roleplay: { damim: 2, mom: 2, friend: 0, librarian: 0, jinwoo: 0 }, recent: "엄마 역할극 2단계 통과" },
  { number: "09", name: "신재희", xp: 95, approvedWords: 0, voted: 3, streak: 2, roleplay: { damim: 2, mom: 0, friend: 0, librarian: 0, jinwoo: 0 }, recent: "오늘의 성찰 저널 2일 연속 작성" },
  { number: "10", name: "안소율", xp: 615, approvedWords: 7, voted: 35, streak: 9, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 2 }, recent: "우리말 사전 신규 단어 승인 대기" },
  { number: "11", name: "양현우", xp: 385, approvedWords: 3, voted: 12, streak: 4, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 0, jinwoo: 0 }, recent: "처음 본 친구 역할극 최종 통과" },
  { number: "12", name: "오유나", xp: 140, approvedWords: 1, voted: 5, streak: 1, roleplay: { damim: 2, mom: 1, friend: 0, librarian: 0, jinwoo: 0 }, recent: "친구 글에 선플 공감 참여" },
  { number: "13", name: "윤아인", xp: 475, approvedWords: 5, voted: 21, streak: 7, roleplay: { damim: 3, mom: 3, friend: 2, librarian: 2, jinwoo: 0 }, recent: "성찰 저널 7일 스트레이트 달성" },
  { number: "14", name: "이하은", xp: 290, approvedWords: 2, voted: 6, streak: 3, roleplay: { damim: 3, mom: 1, friend: 1, librarian: 1, jinwoo: 0 }, recent: "도서관 선생님 역할극 1단계 통과" },
  { number: "15", name: "임지훈", xp: 60, approvedWords: 0, voted: 2, streak: 0, roleplay: { damim: 1, mom: 1, friend: 0, librarian: 0, jinwoo: 0 }, recent: "엄마 역할극 1단계 진입" },
  { number: "16", name: "정지우", xp: 540, approvedWords: 4, voted: 28, streak: 6, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 1 }, recent: "칭호 변경 적용 완료" },
  { number: "17", name: "조윤서", xp: 225, approvedWords: 2, voted: 9, streak: 3, roleplay: { damim: 3, mom: 2, friend: 0, librarian: 0, jinwoo: 0 }, recent: "성찰 저널 3일 연속 달성" },
  { number: "18", name: "최우진", xp: 365, approvedWords: 3, voted: 14, streak: 5, roleplay: { damim: 3, mom: 3, friend: 1, librarian: 0, jinwoo: 0 }, recent: "우리말 사전 뱃지 도감 해금 완료" },
  { number: "19", name: "한준우", xp: 30, approvedWords: 0, voted: 0, streak: 1, roleplay: { damim: 1, mom: 0, friend: 0, librarian: 0, jinwoo: 0 }, recent: "시스템 회원 가입 및 최초 로그인" },
  { number: "20", name: "황주원", xp: 780, approvedWords: 12, voted: 52, streak: 15, roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 3 }, recent: "학부모 공유용 최종 성장 리포트 이미지 저장" },
];

const ROLEPLAY_MAP: Record<keyof Row["roleplay"], string> = {
  damim: "teacher-late",
  mom: "parent-phone",
  friend: "new-friend",
  librarian: "librarian",
  jinwoo: "slang-master",
};

// 학생별 사전 기여를 실체화(진척도 · 리포트 통계 일치용).
// 기존 SEED_DICT id 는 1~100 범위, Date.now() 도 큰 값이므로 200000 대역 사용해 충돌 방지.
// 20인 학급 사전 카드용 다양성 확보 풀 — 초등 눈높이 밈/신조어와 1:1 대응하는 뜻·대안 표현
const APPROVED_SAMPLES: { word: string; def: string; alt: string[]; source: string; score: number }[] = [
  { word: "어쩔티비", def: "'어쩌라고, 저리 가'라는 뜻으로 상대를 무시할 때 쓰는 유행어", alt: ["그렇구나", "네 생각을 존중해"], source: "유튜브 쇼츠", score: 42 },
  { word: "누칼협", def: "'누가 칼 들고 협박했냐'의 줄임말로 상대의 상황을 비꼬는 말", alt: ["네가 선택한 일이잖아", "스스로 정한 거지"], source: "인터넷 커뮤니티", score: 46 },
  { word: "핑프", def: "'핑거 프린세스/프린스'의 줄임말로 검색 안 하고 물어보는 사람을 비꼼", alt: ["먼저 찾아보고 물어봐 줘", "같이 검색해 볼까"], source: "카카오톡 단톡방", score: 38 },
  { word: "킹받네", def: "매우 화가 난다는 뜻을 재미있게 표현한 유행어", alt: ["정말 속상해", "많이 답답해"], source: "인스타 릴스", score: 34 },
  { word: "뇌절", def: "같은 말이나 행동을 계속 반복해서 질리게 한다는 뜻", alt: ["같은 이야기 그만", "한 번이면 충분해"], source: "유튜브 댓글", score: 30 },
  { word: "중꺾마", def: "'중요한 건 꺾이지 않는 마음'의 줄임말로 포기하지 않는 태도", alt: ["끝까지 해보는 마음", "포기하지 않는 용기"], source: "e스포츠 중계", score: 18 },
  { word: "알잘딱깔센", def: "'알아서 잘 딱 깔끔하고 센스 있게'의 줄임말", alt: ["스스로 잘 정리해서", "센스 있게 알아서"], source: "숏폼", score: 26 },
  { word: "점메추", def: "'점심 메뉴 추천'의 줄임말", alt: ["점심 뭐 먹을지 골라줘"], source: "학교 대화", score: 20 },
  { word: "오운완", def: "'오늘 운동 완료'의 줄임말로 운동을 마쳤다는 자랑", alt: ["오늘 운동 다 했어요"], source: "인스타 스토리", score: 16 },
  { word: "쿠쿠루삥뽕", def: "상대를 놀리듯 약 올릴 때 쓰는 유행어", alt: ["그만 놀리자", "친구가 속상해할 수 있어"], source: "틱톡", score: 44 },
  { word: "킹리적갓심", def: "'합리적 의심'을 과장한 유행어", alt: ["합리적인 의심", "그럴듯한 추측"], source: "유튜브 예능", score: 24 },
  { word: "갓생", def: "부지런하고 성실하게 살아가는 삶", alt: ["성실한 생활", "부지런한 삶"], source: "인스타 릴스", score: 20 },
];

function todayIso() { return new Date().toISOString(); }

export function seedClass3105IfNeeded() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_FLAG)) return;
  } catch {
    return;
  }

  const roster = useRosterStore.getState();
  const cls = useClassStore.getState();
  const eng = useEngagementStore.getState();
  const dictStore = useDictStore.getState();

  const now = todayIso();

  // 1) 로스터: 이미 존재하면 덮어쓰지 않음(현재 접속 학생 데이터 보호).
  const existing = new Set(roster.students.map((r) => r.id));
  const nextRoster: StudentRecord[] = [...roster.students];
  const newDictEntries: DictEntry[] = [];
  const engagementUpdates: Record<string, ReturnType<typeof buildEngagement>> = {};
  let classXpSum = 0;
  let dictId = 200000;

  for (const row of ROWS) {
    const id = `${CLASS_CODE}_${row.number}`;
    if (!existing.has(id)) {
      nextRoster.unshift({
        id,
        classCode: CLASS_CODE,
        number: row.number,
        name: row.name,
        xp: row.xp,
        joinedAt: now,
        lastActiveAt: now,
      });
      classXpSum += row.xp;
    }

    // 2) 사전 기여: 학생별 approvedWords 만큼 승인된 항목 생성.
    // 학생 번호(row.number)를 오프셋으로 사용해 학생별로 서로 다른 단어가 배정되도록 보장
    const offset = parseInt(row.number, 10) || 0;
    for (let i = 0; i < row.approvedWords; i++) {
      const s = APPROVED_SAMPLES[(offset + i) % APPROVED_SAMPLES.length];
      newDictEntries.push({
        id: dictId++,
        word: s.word,
        student_definition: s.def,
        suggested_by: id,
        source: s.source,
        evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
        total_harmful_score: s.score,
        status: "approved",
        grade: "안전/순화 필요",
        alternatives: s.alt,
        curriculum_code: "4국05-02",
        timestamp: now.slice(0, 19).replace("T", " "),
        vote_count: 1,
      });
    }

    // 3) 참여도 · 뱃지 · 저널 · 역할극
    engagementUpdates[id] = buildEngagement(row);
  }

  // 로스터 커밋
  roster.write(nextRoster);

  // 사전 병합: 기존 seed + 신규 학생 기여
  const mergedDict = [...dictStore.entries, ...newDictEntries];
  dictStore.persist(mergedDict);

  // 참여도 병합
  const nextByStudent = { ...eng.byStudent };
  for (const [id, patch] of Object.entries(engagementUpdates)) {
    const prev = nextByStudent[id] ?? EMPTY_ENGAGEMENT;
    nextByStudent[id] = {
      ...prev,
      ...patch,
      // 이미 획득 뱃지·역할극은 절대 재잠금 하지 않음.
      unlockedBadges: Array.from(new Set([...(prev.unlockedBadges ?? []), ...patch.unlockedBadges])),
      roleplayCleared: Array.from(new Set([...(prev.roleplayCleared ?? []), ...patch.roleplayCleared])),
    };
  }
  useEngagementStore.setState({ byStudent: nextByStudent });

  // 학급 공유 XP: 신규 학생 xp 합산 (기존 값 보존)
  if (classXpSum > 0) {
    cls.addXP(CLASS_CODE, classXpSum, "20인 더미 시드", "seed", "학급 초기 데이터 반영");
  }

  try {
    window.localStorage.setItem(SEED_FLAG, "1");
  } catch {}
}

function buildEngagement(row: Row) {
  const stats: BadgeStats = {
    approvedWords: row.approvedWords,
    totalXP: row.xp,
    votedCount: row.voted,
    journalStreak: row.streak,
  };
  const unlockedBadges = derivedUnlocked(stats);
  const roleplayCleared = (Object.entries(row.roleplay) as [keyof Row["roleplay"], number][])
    .filter(([, v]) => v >= 3)
    .map(([k]) => ROLEPLAY_MAP[k]);
  const today = new Date();
  const journals = Array.from({ length: Math.min(row.streak, 5) }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (row.streak - 1 - i));
    return { date: d.toISOString().slice(0, 10), text: `오늘도 고운 우리말 한마디를 실천했어요. (${row.recent})` };
  });
  const lastJournalDate = row.streak > 0 ? today.toISOString().slice(0, 10) : undefined;
  return {
    likesGivenCount: row.voted,
    likesReceivedCount: Math.round(row.voted * 0.6),
    journals,
    streak: row.streak,
    lastJournalDate,
    unlockedBadges,
    roleplayCleared,
  };
}