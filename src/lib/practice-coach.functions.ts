import { createServerFn } from "@tanstack/react-start";

/**
 * STEP5 실천 코치 — Lovable AI Gateway 를 통해 학생의 실천 계획에
 * ①칭찬 ②구체화 ③응원 3단계 짧은 피드백과, 오늘 도전할 미션 3가지를
 * 반환한다. 상담(긴 답변) 금지 · 초등 3~4학년 수준 · 최대 5문장.
 */

type CoachInput = {
  goal: string;
  promise: string;
};

export type CoachResult = {
  feedback: string; // 5문장 이내
  missions: string[]; // 3~4개
};

function fallback(input: CoachInput): CoachResult {
  const g = input.goal.trim() || "친구를 존중하는 말 사용";
  return {
    feedback: [
      "좋아요! 실천 목표가 아주 분명하네요.",
      `"${g}" 라는 다짐은 하루를 바꾸는 첫걸음이에요.`,
      "언제, 어떤 상황에서 실천할지 한 가지 상황을 정하면 더 쉬워져요.",
      "오늘 딱 한 번만 성공해도 충분해요.",
      "응원할게요, 우리 함께 해봐요! 🌱",
    ].join("\n"),
    missions: [
      "친구에게 칭찬 한마디 건네기",
      "온라인에서 예쁜 댓글 1개 쓰기",
      "화가 나면 10초 생각하고 말하기",
    ],
  };
}

async function callGateway(input: CoachInput, apiKey: string): Promise<CoachResult> {
  const system = [
    "너는 초등학교 3~4학년 학생의 '바른말 실천 코치' 다.",
    "상담사가 아니라 실천 코치다. 짧고, 밝고, 구체적으로 말한다.",
    "학생을 훈계·비난하지 않는다. 부정 표현을 쓰지 않는다.",
    "항상 ①칭찬 ②더 구체적인 실천 방법 ③응원 순서로 답한다.",
    "전체 답변은 최대 5문장, 쉬운 우리말만 사용한다.",
    "그리고 오늘 바로 도전할 수 있는 미션 3개를 추천한다 (각 20자 이내, 명령형 짧은 문장).",
    "반드시 아래 JSON 형식으로만 답한다:",
    `{"feedback":"...","missions":["...","...","..."]}`,
  ].join("\n");
  const user = `실천 목표: ${input.goal}\n나의 다짐: ${input.promise}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("요청이 많아요. 잠시 후 다시 시도해 주세요.");
    if (res.status === 402) throw new Error("AI 크레딧이 소진되었어요. 관리자에게 알려주세요.");
    throw new Error(`AI 응답 오류 (${res.status})`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = safeParse(content);
  if (!parsed) return fallback(input);
  const missions = Array.isArray(parsed.missions)
    ? parsed.missions.filter((m): m is string => typeof m === "string" && m.trim().length > 0).slice(0, 4)
    : [];
  return {
    feedback: typeof parsed.feedback === "string" && parsed.feedback.trim() ? parsed.feedback.trim() : fallback(input).feedback,
    missions: missions.length > 0 ? missions : fallback(input).missions,
  };
}

function safeParse(s: string): { feedback?: unknown; missions?: unknown } | null {
  try {
    return JSON.parse(s);
  } catch {
    // 모델이 코드블록을 감쌌을 때 대비
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export const getPracticeCoachFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): CoachInput => {
    const v = (input ?? {}) as Partial<CoachInput>;
    const goal = String(v.goal ?? "").slice(0, 200).trim();
    const promise = String(v.promise ?? "").slice(0, 200).trim();
    if (!goal && !promise) throw new Error("실천 목표나 다짐을 먼저 입력해 주세요.");
    return { goal, promise };
  })
  .handler(async ({ data }): Promise<CoachResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback(data);
    try {
      return await callGateway(data, key);
    } catch (err) {
      console.error("[practice-coach] gateway failed", err);
      // 사용자에게는 폴백을 반환해 학습 흐름이 끊기지 않도록.
      return fallback(data);
    }
  });