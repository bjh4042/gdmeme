// app_state 는 클라이언트에서 직접 접근할 수 없다(RLS 전면 차단).
// 모든 읽기/쓰기는 이 서버 함수를 통해서만 이루어지며, 허용된 키만 처리한다.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_KEYS = [
  "wtmeme:store:class:v1",
  "wtmeme:store:dict:v1",
  "wtmeme:store:roster:v1",
  "wtmeme:store:engagement:v1",
  "bmsd_challenge7_v1",
] as const;

const keySchema = z.enum(ALLOWED_KEYS);

export const readCloudState = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ key: keySchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_state")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    if (error) {
      console.error("[cloud-state] read failed", data.key, error.message);
      throw new Error("상태를 불러오지 못했습니다.");
    }
    return { value: row?.value ?? null };
  });

export const writeCloudState = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ key: keySchema, value: z.string().max(2_000_000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_state")
      .upsert(
        { key: data.key, value: data.value, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) {
      console.error("[cloud-state] write failed", data.key, error.message);
      throw new Error("상태를 저장하지 못했습니다.");
    }
    return { ok: true };
  });
