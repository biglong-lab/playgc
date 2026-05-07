// ⌨️ useTypewriterSound — 打字機音效 hook
// 2026-05-07：BGM 系統 ⑧
//
// 5 種音效（程式合成、不需音檔）：
//   - mechanical：機械打字機（咔嗒咔嗒）
//   - soft：柔軟（叮叮）
//   - digital：數位（嗶嗶）
//   - typewriter：傳統打字機（噠）
//   - bell：鐘聲
//
// 用法：
//   const playChar = useTypewriterSound("mechanical");
//   playChar();  // 每打一字觸發

import { useCallback, useRef } from "react";

export type TypewriterSoundType = "none" | "mechanical" | "soft" | "digital" | "typewriter" | "bell";

interface ToneSpec {
  freq: number;
  type: OscillatorType;
  duration: number;
  volume: number;
}

const SOUND_PRESETS: Record<Exclude<TypewriterSoundType, "none">, ToneSpec> = {
  mechanical: { freq: 1200, type: "square", duration: 0.025, volume: 0.08 },
  soft:       { freq: 800,  type: "sine",   duration: 0.04,  volume: 0.06 },
  digital:    { freq: 2000, type: "triangle", duration: 0.02, volume: 0.06 },
  typewriter: { freq: 600,  type: "square", duration: 0.04,  volume: 0.1 },
  bell:       { freq: 1800, type: "sine",   duration: 0.08,  volume: 0.05 },
};

export const TYPEWRITER_SOUND_OPTIONS: Array<{ value: TypewriterSoundType; label: string }> = [
  { value: "none", label: "🔇 無音效" },
  { value: "mechanical", label: "⌨️ 機械打字機" },
  { value: "soft", label: "💧 柔軟叮叮" },
  { value: "digital", label: "📟 數位嗶嗶" },
  { value: "typewriter", label: "📝 傳統打字機" },
  { value: "bell", label: "🔔 鐘聲" },
];

export function useTypewriterSound(type: TypewriterSoundType = "mechanical") {
  const ctxRef = useRef<AudioContext | null>(null);
  const lastPlayRef = useRef(0);

  return useCallback(() => {
    if (type === "none") return;
    if (typeof window === "undefined") return;
    // throttle：太密的字會疊音、最少間隔 30ms
    const now = Date.now();
    if (now - lastPlayRef.current < 30) return;
    lastPlayRef.current = now;

    try {
      if (!ctxRef.current || ctxRef.current.state === "closed") {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        ctxRef.current = new AudioCtx();
      }
      const ctx = ctxRef.current;
      if (ctx.state === "suspended") void ctx.resume();

      const spec = SOUND_PRESETS[type];
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(spec.freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(spec.volume, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, t + spec.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + spec.duration);
    } catch {
      // iOS Safari 部分版本受限、noop
    }
  }, [type]);
}
