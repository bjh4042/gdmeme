// 기존 localStorage 더미데이터 정리.
// 학생 명단·진행현황·XP·배지·칭호·성찰·시연 데이터는 이제 Lovable Cloud 에만 저장된다.
// 로그인 기억(auth) 등 사용자 편의 설정은 남겨 둔다.
const EXACT_KEYS = [
  "wtmeme:store:roster:v1",
  "wtmeme:store:class:v1",
  "wtmeme:store:dict:v1",
  "wtmeme:store:engagement:v1",
  "wtmeme:students:v1",
  "bmsd_challenge7_v1",
];

const PREFIXES = [
  "wtmeme:class:v1:",
  "class_share_xp_",
  "class_recent_activities_",
  "bmsd_step5_",
  "barunmal_demo_v1",
];

export function purgeLocalDummyData() {
  if (typeof window === "undefined") return;
  try {
    const remove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k) continue;
      if (EXACT_KEYS.includes(k) || PREFIXES.some((p) => k.startsWith(p))) remove.push(k);
    }
    for (const k of remove) window.localStorage.removeItem(k);
  } catch {
    /* storage 접근 실패 무시 */
  }
}