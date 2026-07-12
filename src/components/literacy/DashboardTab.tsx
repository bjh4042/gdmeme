import { useMemo, useState } from "react";
import type { DictEntry, ClassState } from "@/lib/literacy-types";
import { weatherOf, levelOf, LEVELS, WEATHER_MATRIX } from "@/lib/literacy-types";
import level1 from "@/assets/level1.webp.asset.json";
import level2 from "@/assets/level2.webp.asset.json";
import level3 from "@/assets/level3.webp.asset.json";
import level4 from "@/assets/level4.webp.asset.json";
import level5 from "@/assets/level5.webp.asset.json";

const LEVEL_IMAGES = [level1.url, level2.url, level3.url, level4.url, level5.url];

export function DashboardTab({ dict, state }: { dict: DictEntry[]; state: ClassState }) {
  const approved = dict.filter((d) => d.status === "approved");
  const avg = useMemo(() => {
    if (approved.length === 0) return 0;
    return Math.round(approved.reduce((s, d) => s + d.total_harmful_score, 0) / approved.length);
  }, [approved]);
  const weather = weatherOf(avg);
  const lv = levelOf(state.xp);
  const [infoOpen, setInfoOpen] = useState(false);

  const wbg =
    weather.tone === "safe"
      ? "linear-gradient(135deg, oklch(0.85 0.11 180), oklch(0.72 0.14 210))"
      : weather.tone === "warn"
      ? "linear-gradient(135deg, oklch(0.88 0.13 85), oklch(0.72 0.14 60))"
      : "linear-gradient(135deg, oklch(0.55 0.18 260), oklch(0.42 0.22 25))";

  const levelImg = LEVEL_IMAGES[Math.min(Math.max(lv.current.lv, 1), 5) - 1];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl p-6 text-white shadow-[var(--shadow-soft)]" style={{ background: wbg }}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="text-sm opacity-90 font-bold">우리 반 언어 기상도</div>
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className="text-xs px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 hover:-translate-y-0.5 hover:underline transition-all duration-200 cursor-pointer text-white font-bold whitespace-nowrap"
                aria-label="우리 반 언어 기상도 안내 열기"
              >
                ❓ 우리 반 언어 기상도란?
              </button>
            </div>
            <div className="text-3xl sm:text-4xl font-black mt-1">
              {weather.icon} {weather.label}
            </div>
            <div className="text-sm mt-1 opacity-95">{weather.desc}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs opacity-80">평균 유해 점수</div>
            <div className="text-4xl font-black font-mono">{avg}</div>
            <div className="text-xs opacity-80">{approved.length}개 단어</div>
          </div>
        </div>
      </div>

      {infoOpen && <WeatherInfoModal avg={avg} onClose={() => setInfoOpen(false)} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-card border-2 border-[color:var(--border)] p-6">
          <div className="text-xs font-bold text-muted-foreground uppercase">우리말 수호대 · 학급 공동 등급</div>
          <div className="text-2xl font-black text-[color:var(--navy)] mt-1">
            Lv.{lv.current.lv} {lv.current.name}
          </div>
          <div className="mt-3 rounded-2xl overflow-hidden bg-[color:var(--muted)]">
            <img
              src={levelImg}
              alt={`레벨 ${lv.current.lv} ${lv.current.name}`}
              width={720}
              height={402}
              fetchPriority="high"
              decoding="async"
              className="w-full h-auto block"
            />
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm font-bold">
              <span className="text-[color:var(--navy)]">공유 경험치 (XP)</span>
              <span className="text-[color:var(--mint-deep)] font-mono">{state.xp} XP</span>
            </div>
            <div className="h-3 mt-1 rounded-full bg-[color:var(--muted)] overflow-hidden">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.min(100, Math.round(lv.progress * 100))}%`,
                  background: "var(--gradient-hero)",
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {lv.next ? `${lv.next.name}까지 ${lv.next.need - state.xp} XP` : "🎉 최종 등급 달성!"}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-1 text-center text-[10px]">
            {LEVELS.map((l) => (
              <div
                key={l.lv}
                className={`p-2 rounded-lg ${
                  l.lv <= lv.current.lv ? "bg-[color:var(--mint)] text-[color:var(--navy)]" : "bg-[color:var(--muted)] text-muted-foreground"
                }`}
              >
                <div className="font-black">Lv{l.lv}</div>
                <div>{l.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-card border-2 border-[color:var(--border)] p-6">
          <div className="text-xs font-bold text-muted-foreground uppercase">최근 활동 기록</div>
          <div className="mt-2 space-y-1 max-h-80 overflow-y-auto">
            {state.activityLog.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                아직 활동 기록이 없어요. 챗봇과 대화하거나 사전을 등록해 XP를 모아보세요!
              </div>
            )}
            {state.activityLog.map((a, i) => (
              <div
                key={i}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 border-b text-sm"
              >
                <div className="min-w-0">
                  <div className="font-bold text-[color:var(--navy)] truncate">
                    {a.who} · <span className="text-[color:var(--mint-deep)]">{kindLabel(a.kind)}</span>
                  </div>
                  {a.note && <div className="text-xs text-muted-foreground truncate">{a.note}</div>}
                </div>
                <div className="shrink-0 font-mono font-bold text-[color:var(--mint-deep)]">
                  +{a.delta} XP
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function kindLabel(k: string) {
  if (k === "quiz") return "밈 퀴즈 정답";
  if (k === "roleplay") return "역할극 통과";
  if (k === "approved") return "사전 승인";
  if (k === "chat") return "챗봇 대화";
  return k;
}

function WeatherInfoModal({ avg, onClose }: { avg: number; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="우리 반 언어 기상도 안내"
    >
      <div
        className="w-full max-w-lg min-w-0 rounded-2xl bg-white/80 backdrop-blur-md shadow-2xl border border-white/60 animate-scale-in flex flex-col max-h-[85vh]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-white/60">
          <div className="min-w-0">
            <div className="text-lg sm:text-xl font-black text-[color:var(--navy)]">🌈 우리 반 언어 기상도란?</div>
            <div className="text-xs text-muted-foreground mt-1">
              현재 평균 유해 점수 <span className="font-mono font-bold text-[color:var(--navy)]">{avg}</span>점 · 7단계 자동 판정
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-10 h-10 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-xl font-black text-[color:var(--navy)] shadow"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto pr-2 max-h-[75vh]" style={{ WebkitOverflowScrolling: "touch" }}>
          <p className="text-sm text-[color:var(--navy)] leading-relaxed mb-3">
            학급의 <b>평균 유해 점수(0~100)</b>를 실시간으로 계산해 오늘의 교실 언어 날씨를 알려줘요.
            점수가 낮을수록 맑고, 높을수록 험악해집니다.
          </p>
          <div className="space-y-2">
            {WEATHER_MATRIX.map((t, i) => {
              const active = avg >= t.min && avg <= t.max;
              return (
                <div
                  key={i}
                  className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-xl p-3 ${t.accent} ${
                    active ? "ring-2 ring-[color:var(--navy)] shadow" : "opacity-90"
                  }`}
                >
                  <div className="text-2xl leading-none">{t.icon}</div>
                  <div className="font-mono text-xs font-bold bg-white/60 rounded px-2 py-1 whitespace-nowrap">
                    {t.min}~{t.max}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black">
                      {i + 1}단계 · {t.label}
                      {active && <span className="ml-1 text-[10px] align-middle">🎯 현재</span>}
                    </div>
                    <div className="text-xs mt-0.5 leading-snug break-words">{t.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl bg-white/70 border border-white/80 p-3 text-xs leading-relaxed text-[color:var(--navy)]">
            💡 <b>우리 반 날씨가 맑아지는 비법</b>: 친구들이 사전에 유해 점수가 높은 단어 대신 '바른 대안 표현'을 사용하고,
            고운 말 카드에 <b>[👍 바른말 최고야]</b> 공감을 누를 때마다 우리 반의 평균 유해 점수가 소수점 단위로
            쏙쏙 내려가며 날씨가 실시간으로 환하게 개어납니다!
          </div>
        </div>

        <div className="p-4 border-t border-white/60">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-[color:var(--navy)] text-white font-black text-base shadow-lg hover:opacity-90 active:scale-[0.99] transition"
          >
            확인했어요
          </button>
        </div>
      </div>
    </div>
  );
}

function PixelKing({ size, level }: { size: number; level: number }) {
  const robeColor = level >= 4 ? "#7c3aed" : level >= 3 ? "#0369a1" : level >= 2 ? "#14b8a6" : "#94a3b8";
  return (
    <div className="relative flex flex-col items-center" style={{ imageRendering: "pixelated" }}>
      <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ imageRendering: "pixelated" }}>
        {/* crown */}
        {level >= 2 && (
          <>
            <rect x="6" y="1" width="8" height="2" fill="#facc15" />
            <rect x="6" y="0" width="2" height="1" fill="#facc15" />
            <rect x="9" y="0" width="2" height="1" fill="#facc15" />
            <rect x="12" y="0" width="2" height="1" fill="#facc15" />
          </>
        )}
        {/* head */}
        <rect x="6" y="3" width="8" height="6" fill="#fde68a" />
        {/* eyes */}
        <rect x="8" y="5" width="1" height="1" fill="#111" />
        <rect x="11" y="5" width="1" height="1" fill="#111" />
        {/* beard */}
        <rect x="7" y="7" width="6" height="2" fill="#fff" />
        {/* robe */}
        <rect x="4" y="9" width="12" height="14" fill={robeColor} />
        <rect x="9" y="11" width="2" height="10" fill="#facc15" />
        {/* arms */}
        <rect x="2" y="10" width="2" height="8" fill={robeColor} />
        <rect x="16" y="10" width="2" height="8" fill={robeColor} />
        {/* boots */}
        <rect x="5" y="23" width="4" height="3" fill="#111" />
        <rect x="11" y="23" width="4" height="3" fill="#111" />
        {/* cape for higher levels */}
        {level >= 5 && <rect x="1" y="10" width="18" height="12" fill="#dc2626" opacity="0.35" />}
      </svg>
      <div className="text-[10px] font-black text-[color:var(--navy)]">세종대왕</div>
    </div>
  );
}

function PixelTree({ size, level }: { size: number; level: number }) {
  const h = size * 2;
  return (
    <div className="flex flex-col items-center">
      <svg width={size * 1.5} height={h} viewBox="0 0 30 40" style={{ imageRendering: "pixelated" }}>
        {/* layers of leaves depending on level */}
        {level >= 1 && <rect x="10" y="20" width="10" height="8" fill="#10b981" />}
        {level >= 2 && <rect x="7" y="14" width="16" height="8" fill="#059669" />}
        {level >= 3 && <rect x="4" y="8" width="22" height="8" fill="#047857" />}
        {level >= 4 && <rect x="8" y="2" width="14" height="8" fill="#065f46" />}
        {level >= 5 && (
          <>
            <rect x="12" y="0" width="6" height="4" fill="#facc15" />
            <rect x="2" y="12" width="2" height="2" fill="#facc15" />
            <rect x="26" y="12" width="2" height="2" fill="#facc15" />
          </>
        )}
        {/* trunk */}
        <rect x="13" y="28" width="4" height="10" fill="#78350f" />
      </svg>
      <div className="text-[10px] font-black text-[color:var(--navy)]">우리말 나무</div>
    </div>
  );
}