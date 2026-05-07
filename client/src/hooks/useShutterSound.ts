// 📷 useShutterSound — 拍照咔嚓音效 hook
// 2026-05-07：相機統一改造的一部分
//
// 用法：
//   const playShutter = useShutterSound();
//   playShutter();  // 觸發咔嚓聲
//
// 實作：用 Web Audio API 程式合成（不需音檔、無 cloudinary 上傳）
//   - 三段：高頻短峰 + 短靜默 + 中頻短峰（模擬機械快門）
//   - 失敗 fallback：noop（iOS Safari 部分版本 AudioContext 受限）

import { useCallback, useRef } from "react";

export function useShutterSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (ctxRef.current && ctxRef.current.state !== "closed") return ctxRef.current;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      ctxRef.current = new AudioCtx();
      return ctxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playClick = useCallback((ctx: AudioContext, freq: number, when: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.18, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur);
  }, []);

  return useCallback(() => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    // 高頻短峰（快門前段）
    playClick(ctx, 2400, now, 0.04);
    // 中頻短峰（快門後段）
    playClick(ctx, 1600, now + 0.06, 0.05);
  }, [ensureContext, playClick]);
}
