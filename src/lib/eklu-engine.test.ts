/**
 * EKLU Engine 단위 테스트 (bun run 실행 가능한 표준 스크립트)
 *   bun run src/lib/eklu-engine.test.ts
 *
 * 프레임워크 의존성 없이 즉시 검증 가능하도록 어설션 함수를 자체 구현.
 * 실패 시 프로세스 exit code = 1.
 */
import { createStudentModel, understand, type EkluResult } from "./eklu-engine";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: unknown, label: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}
function test(name: string, fn: () => void) {
  console.log(`\n▸ ${name}`);
  try {
    fn();
  } catch (e) {
    failed++;
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ threw: ${(e as Error).message}`);
  }
}

function run(input: string, opts: Partial<Parameters<typeof understand>[0]> = {}): EkluResult {
  return understand({ input, ...opts });
}

// ─────────────────────────────────────────────────────────────

test("난 장난인대 — 표기 정리 + 원문 보존, joke/playful 후보", () => {
  const r = run("난 장난인대");
  assert(r.normalization.original === "난 장난인대", "original 보존");
  assert(r.normalization.normalizedText.includes("장난인데"), "표기 정리");
  assert(r.intentAnalysis.primary === "joke" || r.intentAnalysis.secondary.includes("joke"), "joke 탐지");
});

test("미안한대 너도 그랫자나 — 다중 의도(apology + excuse)", () => {
  const r = run("미안한대 너도 그랫자나");
  const intents = [r.intentAnalysis.primary, ...r.intentAnalysis.secondary];
  assert(intents.includes("apology"), "apology 포함");
  assert(intents.includes("excuse"), "excuse 포함");
  assert(r.defensiveResponse.detected, "방어 반응 탐지");
});

test("친구가먼저햇는대 — 방어 반응(blame_shift), 오개념 아님", () => {
  const r = run("친구가먼저햇는대");
  assert(r.defensiveResponse.detected && r.defensiveResponse.type === "blame_shift", "blame_shift 방어");
  assert(!r.misconception.detected, "즉시 오개념 확정 금지");
});

test("몰라 — avoid + clarification 필요", () => {
  const r = run("몰라");
  assert(r.intentAnalysis.primary === "avoid", "avoid 의도");
  assert(r.clarificationNeed.required, "clarification 필요");
  assert(!r.clarifierHints.length, "질문 문장은 만들지 않음");
});

test("ㅇㅇ — 의미 후보 여럿, 문맥 없으면 selectedMeaning 없음", () => {
  const r = run("ㅇㅇ");
  assert(r.normalization.possibleMeanings.length >= 2, "다의 후보");
  assert(!r.normalization.selectedByContext, "문맥 없으면 미선택");
});

test("ㅋㅋ — 웃음/장난/회피 후보, 하나로 확정하지 않음", () => {
  const r = run("ㅋㅋ");
  const pm = r.normalization.possibleMeanings;
  assert(pm.includes("웃음") && pm.includes("장난"), "의미 다의성 보존");
  assert(!r.normalization.selectedMeaning, "확정 없음");
});

test("친구니까 놀려도 돼 — 오개념(friend_teasing_ok) 확정", () => {
  const r = run("친구니까 놀려도 돼");
  assert(r.misconception.detected, "명시적 오개념 확정");
  assert(r.misconception.kind === "friend_teasing_ok", "종류 정확");
});

test("친구속상햇을듯 — empathy 의도 우선", () => {
  const r = run("친구속상햇을듯");
  const intents = [r.intentAnalysis.primary, ...r.intentAnalysis.secondary];
  assert(intents.includes("empathy"), "empathy 탐지");
});

test("직전 AI가 질문일 때 '응' → agree(문맥)", () => {
  const r = run("응", { history: [{ role: "ai", text: "그때 속상했어?" }] });
  assert(r.intentAnalysis.primary === "agree", "문맥 기반 agree");
  assert(
    r.evidence.contextSignals.some((s) => s.includes("short_reply_after_question")),
    "문맥 신호 기록",
  );
});

test("'몰라' 1회 vs 3회 — StudentModel 누적 변화", () => {
  let model = createStudentModel();
  const r1 = understand({ input: "몰라", model });
  model = r1.studentModel;
  const single = { engagement: model.engagement, obs: model.observationCount };

  let model3 = createStudentModel();
  for (let i = 0; i < 3; i++) {
    model3 = understand({ input: "몰라", model: model3 }).studentModel;
  }
  assert(model3.observationCount === 3, "관찰 카운트 3");
  assert(model3.engagement < single.engagement, "반복 회피 시 engagement 하락 누적");
  assert((model3.repeatedErrors["give_up"] ?? 0) >= 2, "반복 오류 카운트 누적");
  // EWMA 완화: 1회로는 급격히 떨어지지 않음
  assert(single.engagement > 1.5, "1회 관찰로 급락 금지 (EWMA)");
  assert(model3.stability > 0 && model3.stability <= 1, "stability 0..1");
});

test("insufficient_data — 관찰 < 3", () => {
  const r = run("응");
  assert(r.status === "insufficient_data", "초기엔 insufficient_data");
});

// ─────────────────────────────────────────────────────────────

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`passed: ${passed}   failed: ${failed}`);
if (failed > 0) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}