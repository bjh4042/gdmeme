import { useCallback, useRef } from "react";

/**
 * Leading-edge throttle for action buttons (기본 500ms 쿨타임).
 * 첫 호출은 즉시 실행하고, 쿨타임 안의 추가 호출은 조용히 무시한다.
 * XP 중복 지급·다중 클릭·연타 방어용.
 */
export function useDebouncedAction<T extends (...args: never[]) => unknown>(
  fn: T,
  ms = 500,
): (...args: Parameters<T>) => void {
  const lockRef = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lockRef.current < ms) return;
      lockRef.current = now;
      fnRef.current(...args);
    },
    [ms],
  );
}