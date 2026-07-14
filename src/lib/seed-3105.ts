// 20인 더미데이터 시드 · 학급 3105
// 최초 진입 시 1회 실행 → localStorage 플래그로 재시드 방지.
// 기존 학급별 격리(classCode) · 유저별 세션(ID) 분리 아키텍처 준수.

import { useRosterStore } from "@/stores/roster";
import { useClassStore } from "@/stores/class";
import { useEngagementStore, EMPTY_ENGAGEMENT } from "@/stores/engagement";
import { useDictStore } from "@/stores/dict";
import { derivedUnlocked, type BadgeStats } from "@/lib/badges";
import type { DictEntry, StudentRecord } from "@/lib/literacy-types";

const SEED_FLAG = "wtmeme:seed:3105:v7";
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
  {
    number: "01",
    name: "강민준",
    xp: 340,
    approvedWords: 2,
    voted: 8,
    streak: 4,
    roleplay: { damim: 3, mom: 3, friend: 2, librarian: 0, jinwoo: 0 },
    recent: "우리말 사전 공감 획득",
  },
  {
    number: "02",
    name: "고태양",
    xp: 720,
    approvedWords: 2,
    voted: 55,
    streak: 14,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 3 },
    recent: "예절 역할극 최종 마스터 달성",
  },
  {
    number: "03",
    name: "김서연",
    xp: 45,
    approvedWords: 2,
    voted: 1,
    streak: 1,
    roleplay: { damim: 1, mom: 0, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "오늘의 성찰 저널 최초 작성",
  },
  {
    number: "04",
    name: "문채원",
    xp: 490,
    approvedWords: 2,
    voted: 22,
    streak: 8,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 2, jinwoo: 0 },
    recent: "도서관 선생님 역할극 2단계 통과",
  },
  {
    number: "05",
    name: "박도현",
    xp: 185,
    approvedWords: 2,
    voted: 4,
    streak: 2,
    roleplay: { damim: 3, mom: 1, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "담임 선생님 역할극 최종 통과",
  },
  {
    number: "06",
    name: "백시은",
    xp: 310,
    approvedWords: 2,
    voted: 7,
    streak: 3,
    roleplay: { damim: 3, mom: 2, friend: 1, librarian: 0, jinwoo: 0 },
    recent: "처음 본 친구 역할극 1단계 통과",
  },
  {
    number: "07",
    name: "서진우",
    xp: 520,
    approvedWords: 2,
    voted: 24,
    streak: 5,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 1 },
    recent: "유행어 마스터 진우 역할극 진입",
  },
  {
    number: "08",
    name: "송민성",
    xp: 210,
    approvedWords: 2,
    voted: 6,
    streak: 0,
    roleplay: { damim: 2, mom: 2, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "엄마 역할극 2단계 통과",
  },
  {
    number: "09",
    name: "신재희",
    xp: 95,
    approvedWords: 2,
    voted: 3,
    streak: 2,
    roleplay: { damim: 2, mom: 0, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "오늘의 성찰 저널 2일 연속 작성",
  },
  {
    number: "10",
    name: "안소율",
    xp: 615,
    approvedWords: 2,
    voted: 35,
    streak: 9,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 2 },
    recent: "우리말 사전 신규 단어 승인 대기",
  },
  {
    number: "11",
    name: "양현우",
    xp: 385,
    approvedWords: 1,
    voted: 12,
    streak: 4,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 0, jinwoo: 0 },
    recent: "처음 본 친구 역할극 최종 통과",
  },
  {
    number: "12",
    name: "오유나",
    xp: 140,
    approvedWords: 1,
    voted: 5,
    streak: 1,
    roleplay: { damim: 2, mom: 1, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "친구 글에 선플 공감 참여",
  },
  {
    number: "13",
    name: "윤아인",
    xp: 475,
    approvedWords: 1,
    voted: 21,
    streak: 7,
    roleplay: { damim: 3, mom: 3, friend: 2, librarian: 2, jinwoo: 0 },
    recent: "성찰 저널 7일 스트레이트 달성",
  },
  {
    number: "14",
    name: "이하은",
    xp: 290,
    approvedWords: 1,
    voted: 6,
    streak: 3,
    roleplay: { damim: 3, mom: 1, friend: 1, librarian: 1, jinwoo: 0 },
    recent: "도서관 선생님 역할극 1단계 통과",
  },
  {
    number: "15",
    name: "임지훈",
    xp: 60,
    approvedWords: 1,
    voted: 2,
    streak: 0,
    roleplay: { damim: 1, mom: 1, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "엄마 역할극 1단계 진입",
  },
  {
    number: "16",
    name: "정지우",
    xp: 540,
    approvedWords: 1,
    voted: 28,
    streak: 6,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 1 },
    recent: "칭호 변경 적용 완료",
  },
  {
    number: "17",
    name: "조윤서",
    xp: 225,
    approvedWords: 1,
    voted: 9,
    streak: 3,
    roleplay: { damim: 3, mom: 2, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "성찰 저널 3일 연속 달성",
  },
  {
    number: "18",
    name: "최우진",
    xp: 365,
    approvedWords: 1,
    voted: 14,
    streak: 5,
    roleplay: { damim: 3, mom: 3, friend: 1, librarian: 0, jinwoo: 0 },
    recent: "우리말 사전 뱃지 도감 해금 완료",
  },
  {
    number: "19",
    name: "한준우",
    xp: 30,
    approvedWords: 1,
    voted: 0,
    streak: 1,
    roleplay: { damim: 1, mom: 0, friend: 0, librarian: 0, jinwoo: 0 },
    recent: "시스템 회원 가입 및 최초 로그인",
  },
  {
    number: "20",
    name: "황주원",
    xp: 780,
    approvedWords: 1,
    voted: 52,
    streak: 15,
    roleplay: { damim: 3, mom: 3, friend: 3, librarian: 3, jinwoo: 3 },
    recent: "학부모 공유용 최종 성장 리포트 이미지 저장",
  },
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
const APPROVED_SAMPLES: {
  word: string;
  def: string;
  alt: string[];
  source: string;
  score: number;
  suggested_by: string;
  evaluations: {
    aggression: number;
    bullying: number;
    discrimination: number;
    violence: number;
    grammar_destruction: number;
  };
}[] = [
  {
    word: "꾸안꾸",
    def: "'꾸민 듯 안 꾸민 듯'의 줄임말로, 과하게 치장하지 않고 자연스럽게 멋을 낸 스타일",
    alt: ["자연스러운 멋", "수수한 차림"],
    source: "인스타그램 릴스",
    score: 28,
    suggested_by: "3105_01",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
  },
  {
    word: "완내스",
    def: "'완전 내 스타일이다'의 줄임말로, 물건이나 상황이 자신의 취향에 완벽하게 일치할 때 쓰는 말",
    alt: ["내 취향에 딱 맞다"],
    source: "유튜브 쇼츠",
    score: 28,
    suggested_by: "3105_01",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
  },
  {
    word: "무물",
    def: "'무엇이든 물어보세요'의 줄임말로, SNS에서 다른 사람들의 질문을 받을 때 사용하는 기능이나 글",
    alt: ["질문 받습니다", "무엇이든 물어보세요"],
    source: "인스타그램 스토리",
    score: 24,
    suggested_by: "3105_02",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "노잼",
    def: "영어 'No(없다)'와 한글 '재미'의 합성어로, 어떤 상황이나 농담이 지루하고 재미없음을 뜻하는 말",
    alt: ["재미가 없다", "지루하다"],
    source: "학교 운동장",
    score: 24,
    suggested_by: "3105_02",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "반모",
    def: "'반말 모드'의 줄임말로, 온라인에서 서로 친해지기 위해 존댓말 대신 반말을 쓰기로 합의한 상태",
    alt: ["편하게 말하기"],
    source: "학생 단톡방",
    score: 24,
    suggested_by: "3105_03",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "넘사벽",
    def: "'넘을 수 없는 4차원의 벽'의 줄임말로, 둘의 실력 차이가 너무 커서 도저히 비교할 수 없을 때 쓰는 극찬",
    alt: ["비교할 수 없을 만큼 뛰어나다"],
    source: "온라인 게임",
    score: 28,
    suggested_by: "3105_03",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
  },
  {
    word: "웃참",
    def: "'웃음 참기'의 줄임말로, 너무 웃긴 상황이지만 소리 내어 웃지 못하고 억지로 참는 행동",
    alt: ["웃음 참기"],
    source: "유튜브 쇼츠",
    score: 24,
    suggested_by: "3105_04",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "뉴비",
    def: "새로 시작한 초보자(Newbie)를 친근하게 이르는 말로, 주로 게임이나 특정 취미 모임에서 신입을 부를 때 사용됨",
    alt: ["초보자", "신규 가입자"],
    source: "온라인 게임",
    score: 22,
    suggested_by: "3105_04",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 1.5 },
  },
  {
    word: "인생샷",
    def: "자신의 인생에 영원히 남길 만큼 아주 잘 나온 멋진 사진",
    alt: ["최고의 사진", "멋진 사진"],
    source: "인스타그램 릴스",
    score: 24,
    suggested_by: "3105_05",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "고인물",
    def: "한 가지 게임이나 분야를 아주 오랫동안 즐겨서 그 분야의 지식과 실력이 매우 뛰어난 고수를 비유하는 말",
    alt: ["실력자", "전문가"],
    source: "인터넷 커뮤니티",
    score: 24,
    suggested_by: "3105_05",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "먹방",
    def: "'먹는 방송'의 줄임말로, 다량의 음식이나 맛있는 음식을 먹는 모습을 보여주는 영상 콘텐츠",
    alt: ["음식 먹는 방송"],
    source: "유튜브 채널",
    score: 24,
    suggested_by: "3105_06",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "마상",
    def: "'마음의 상처'를 줄여서 부르는 말로, 누군가의 말이나 행동에 서운함을 느꼈을 때 가볍게 투정 부리는 표현",
    alt: ["속상하다", "마음이 아프다"],
    source: "학생 단톡방",
    score: 24,
    suggested_by: "3105_06",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "얼죽아",
    def: "'얼어 죽어도 아이스 아메리카노'의 줄임말로, 한겨울에도 항상 차가운 음료만 마시는 취향",
    alt: ["차가운 음료 선호"],
    source: "웹툰",
    score: 28,
    suggested_by: "3105_07",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
  },
  {
    word: "스포",
    def: "'스포일러'의 줄임말로, 아직 영화나 책을 보지 않은 사람에게 중요한 줄거리나 결말을 미리 말해버리는 행동",
    alt: ["내용 미리 말하기"],
    source: "유튜브 리뷰 영상",
    score: 24,
    suggested_by: "3105_07",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "혼밥",
    def: "다른 사람과 어울리지 않고 혼자서 밥을 먹는 행위",
    alt: ["혼자 밥 먹기", "1인 식사"],
    source: "인터넷 커뮤니티",
    score: 24,
    suggested_by: "3105_08",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "TMI",
    def: "'Too Much Information'의 약자로, 굳이 알고 싶지 않거나 알 필요가 없는 너무 사소한 정보",
    alt: ["과한 정보", "사소한 사실"],
    source: "TV 예능 프로그램",
    score: 22,
    suggested_by: "3105_08",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 1.5 },
  },
  {
    word: "본캐",
    def: "게임의 '본래 캐릭터'에서 유래하여, 현실에서의 자신의 진짜 직업이나 원래 성격",
    alt: ["진짜 모습", "원래 성격"],
    source: "온라인 게임",
    score: 24,
    suggested_by: "3105_09",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "인싸",
    def: "'인사이더(Insider)'의 줄임말로, 사람들과 잘 어울리며 유행에 밝고 무리에서 인기가 많은 성격의 소유자",
    alt: ["사교적인 사람", "인기 있는 사람"],
    source: "유튜브 쇼츠",
    score: 24,
    suggested_by: "3105_09",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "부캐",
    def: "'부 캐릭터'의 줄임말로, 평소의 진짜 모습(본캐)과 다른 새로운 성격이나 취미를 가질 때 쓰는 말",
    alt: ["또 다른 모습", "새로운 매력"],
    source: "TV 예능 프로그램",
    score: 24,
    suggested_by: "3105_10",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "꿀팁",
    def: "매우 유용하고 좋은 조언이나 정보라는 뜻으로, 달콤한 꿀과 팁(정보)을 합친 단어",
    alt: ["유용한 정보", "좋은 조언"],
    source: "인스타그램 릴스",
    score: 24,
    suggested_by: "3105_10",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "케미",
    def: "화학반응(Chemistry)에서 유래하여, 사람 사이의 호흡이나 조화가 아주 잘 맞는 상태",
    alt: ["좋은 궁합", "환상의 호흡"],
    source: "TV 드라마",
    score: 22,
    suggested_by: "3105_11",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 1.5 },
  },
  {
    word: "국룰",
    def: "'국민 룰(규칙)'의 줄임말로, 법으로 정해진 것은 아니지만 누구나 인정하고 지키는 보편적 행동 양식",
    alt: ["보편적 규칙", "암묵적 합의"],
    source: "학교 교실",
    score: 26,
    suggested_by: "3105_12",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2.5 },
  },
  {
    word: "득템",
    def: "얻을 득(得)과 아이템(Item)의 합성어로, 원하던 좋은 물건을 우연히 또는 싸게 얻었을 때 기뻐하며 쓰는 말",
    alt: ["좋은 물건을 얻다"],
    source: "온라인 게임",
    score: 24,
    suggested_by: "3105_13",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "눈팅",
    def: "눈과 채팅의 합성어로, 인터넷 게시판에서 글이나 댓글을 쓰지 않고 남의 글을 읽기만 하는 행동",
    alt: ["지켜보기", "읽기만 하기"],
    source: "학생 단톡방",
    score: 24,
    suggested_by: "3105_14",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "어덕행덕",
    def: "'어차피 덕질(취미활동)할 거 행복하게 덕질하자'는 뜻으로, 스트레스 받지 않고 건전하게 취미를 즐기자는 의미",
    alt: ["행복한 취미 생활"],
    source: "인터넷 팬카페",
    score: 32,
    suggested_by: "3105_15",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 4 },
  },
  {
    word: "스라밸",
    def: "'스터디 앤 라이프 밸런스'의 줄임말로, 학생들의 과도한 학업 부담을 줄이고 휴식과 공부의 균형을 맞추자는 말",
    alt: ["공부와 휴식의 균형"],
    source: "인터넷 뉴스 기사",
    score: 28,
    suggested_by: "3105_16",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 3 },
  },
  {
    word: "쩝쩝박사",
    def: "음식을 아주 맛있게 먹거나 남들이 모르는 훌륭한 음식 조합을 잘 찾아내는 사람을 칭찬하는 말",
    alt: ["음식 조합의 달인"],
    source: "유튜브 먹방",
    score: 26,
    suggested_by: "3105_17",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2.5 },
  },
  {
    word: "빵지순례",
    def: "빵과 성지순례의 합성어로, 전국 각지의 유명하고 맛있는 빵집을 여행하듯 찾아다니는 취미 생활",
    alt: ["유명 빵집 탐방"],
    source: "인스타그램 릴스",
    score: 24,
    suggested_by: "3105_18",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "불금",
    def: "'불타는 금요일'의 줄임말로, 다음 날 학교나 직장에 가지 않으므로 금요일 저녁을 신나게 보내자는 의미",
    alt: ["신나는 금요일"],
    source: "가족 대화",
    score: 24,
    suggested_by: "3105_19",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
  {
    word: "홈트",
    def: "'홈 트레이닝'의 줄임말로, 체육관에 가지 않고 집 안에서 기구 없이 가볍게 하는 운동",
    alt: ["집에서 하는 운동"],
    source: "유튜브 쇼츠",
    score: 24,
    suggested_by: "3105_20",
    evaluations: { aggression: 1, bullying: 1, discrimination: 1, violence: 1, grammar_destruction: 2 },
  },
];

function todayIso() {
  return new Date().toISOString();
}

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

  // 0) 기존 사전 데이터 정제: `#02-06`, `#13-2` 형태의 임시 꼬리표 제거 후
  //    동일 단어(word) 중복 항목은 내용이 가장 풍부한 1개만 남기고 하드 삭제.
  //    이후 절대 중복되지 않도록 순차 ID 재부여.
  const stripTag = (w: string) => w.replace(/\s*#\d+[-–]?\d*\s*$/g, "").trim();
  const beforeClean = dictStore.entries.map((d) => ({ ...d, word: stripTag(d.word) }));
  const richness = (d: DictEntry) =>
    (d.student_definition?.length ?? 0) +
    (d.alternatives?.join("").length ?? 0) +
    (d.source?.length ?? 0);
  const bestByWord = new Map<string, DictEntry>();
  for (const d of beforeClean) {
    const key = d.word;
    if (!key) continue;
    const prev = bestByWord.get(key);
    if (!prev || richness(d) > richness(prev)) bestByWord.set(key, d);
  }
  let reindex = 1;
  const cleanedExisting: DictEntry[] = Array.from(bestByWord.values()).map((d) => ({
    ...d,
    id: reindex++,
  }));

  // 1) 로스터: 이미 존재하면 덮어쓰지 않음(현재 접속 학생 데이터 보호).
  const existing = new Set(roster.students.map((r) => r.id));
  const nextRoster: StudentRecord[] = [...roster.students];
  const newDictEntries: DictEntry[] = [];
  const engagementUpdates: Record<string, ReturnType<typeof buildEngagement>> = {};
  let classXpSum = 0;
  // 신규 학생 기여 카드도 기존 재부여 ID 이후로 계속 이어지도록 오프셋 지정.
  let dictId = 100000;
  const takenWords = new Set(cleanedExisting.map((d) => d.word));

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

    // 2) 사전 기여: 업로드 데이터의 proposer를 suggested_by로 직접 매핑.
    //    학생별 제안한 단어를 그대로 등재하며, 이미 원본 프리셋에 있는 단어는 중복 스킵.
    const samplesForStudent = APPROVED_SAMPLES.filter((s) => s.suggested_by === id);
    for (const s of samplesForStudent) {
      if (takenWords.has(s.word)) continue;
      takenWords.add(s.word);
      newDictEntries.push({
        id: dictId++,
        word: s.word,
        student_definition: s.def,
        suggested_by: id,
        source: s.source,
        evaluations: s.evaluations,
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

  // 사전 병합: 정제된 기존 프리셋 + 신규 학생 기여 (모든 word 유일 보장)
  const mergedDict = [...cleanedExisting, ...newDictEntries];
  dictStore.persist(mergedDict);

  // 참여도 병합
  const nextByStudent = { ...eng.byStudent };
  for (const [id, patch] of Object.entries(engagementUpdates)) {
    const prev = nextByStudent[id] ?? EMPTY_ENGAGEMENT;
    nextByStudent[id] = {
      ...prev,
      ...patch,
      // 이미 획득 뱃지·역할극은 절대 재잠금 하지 않음.
      unlockedBadges: Array.from(
        new Set([...(prev.unlockedBadges ?? []), ...patch.unlockedBadges]),
      ),
      roleplayCleared: Array.from(
        new Set([...(prev.roleplayCleared ?? []), ...patch.roleplayCleared]),
      ),
    };
  }
  useEngagementStore.setState({ byStudent: nextByStudent });

  // 학급 공유 XP: 신규 학생 xp 합산 (기존 값 보존)
  if (classXpSum > 0) {
    cls.addXP(CLASS_CODE, classXpSum, "20인 더미 시드", "seed", "학급 초기 데이터 반영");
  }

  try {
    window.localStorage.setItem(SEED_FLAG, "1");
  } catch {
    /* storage/parse 실패 무시 */
  }
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
    return {
      date: d.toISOString().slice(0, 10),
      text: `오늘도 고운 우리말 한마디를 실천했어요. (${row.recent})`,
    };
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
