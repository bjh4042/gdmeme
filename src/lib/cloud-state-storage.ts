// Lovable Cloud 기반 상태 저장소 어댑터.
// 기존 zustand persist 의 저장 위치만 localStorage → Cloud DB(app_state) 로 교체한다.
// 스토어 API·데이터 형태는 그대로 유지되므로 컴포넌트 코드는 영향을 받지 않는다.
import type { StateStorage } from "zustand/middleware";
import { supabase } from "@/integrations/supabase/client";

const pending = new Map<string, ReturnType<typeof setTimeout>>();
const cache = new Map<string, string>();

async function flush(name: string, value: string) {
  const { error } = await supabase
    .from("app_state")
    .upsert({ key: name, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) console.error("[cloud-state] 저장 실패", name, error.message);
}

export const cloudStateStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window === "undefined") return null;
    const { data, error } = await supabase
      .from("app_state")
      .select("value")
      .eq("key", name)
      .maybeSingle();
    if (error) {
      console.error("[cloud-state] 조회 실패", name, error.message);
      return cache.get(name) ?? null;
    }
    if (data?.value) cache.set(name, data.value);
    return data?.value ?? null;
  },
  setItem: async (name, value) => {
    if (typeof window === "undefined") return;
    cache.set(name, value);
    const prev = pending.get(name);
    if (prev) clearTimeout(prev);
    pending.set(
      name,
      setTimeout(() => {
        pending.delete(name);
        void flush(name, value);
      }, 300),
    );
  },
  removeItem: async (name) => {
    if (typeof window === "undefined") return;
    cache.delete(name);
    await supabase.from("app_state").update({ value: "" }).eq("key", name);
  },
};
