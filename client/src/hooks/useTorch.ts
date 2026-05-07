// 🔦 useTorch — 閃光燈/手電筒控制 hook
// 2026-05-07：相機統一改造的一部分
//
// 用法：
//   const { supported, on, toggle } = useTorch(stream);
//
// capability：
//   - Android Chrome / Edge：~70% 支援（依手機鏡頭規格）
//   - iOS Safari / Firefox：❌ 不支援
//   - 不支援時 supported=false、UI 應 disable 按鈕
//
// 實作：MediaStreamTrack.applyConstraints({ torch: true })
//   - 必須在 stream 已開始後才能用
//   - 切換鏡頭後需重新讀 capabilities

import { useCallback, useEffect, useState } from "react";

interface MediaTrackCapabilitiesWithTorch extends MediaTrackCapabilities {
  torch?: boolean;
}

interface MediaTrackConstraintSetWithTorch extends MediaTrackConstraintSet {
  torch?: boolean;
}

export interface UseTorchResult {
  /** 此裝置 + 此 stream 是否支援 torch */
  supported: boolean;
  /** 目前是否打開 */
  on: boolean;
  /** 切換 on/off（不支援時 noop）*/
  toggle: () => Promise<void>;
  /** 強制關閉（在 stop camera 前呼叫、避免下次開仍亮）*/
  turnOff: () => Promise<void>;
}

export function useTorch(stream: MediaStream | null): UseTorchResult {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);

  // stream 變動時重新 detect capability + reset
  useEffect(() => {
    if (!stream) {
      setSupported(false);
      setOn(false);
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.getCapabilities !== "function") {
      setSupported(false);
      return;
    }
    const caps = track.getCapabilities() as MediaTrackCapabilitiesWithTorch;
    setSupported(Boolean(caps.torch));
    // 切 stream（如切前後鏡頭）一定關 torch
    setOn(false);
  }, [stream]);

  const apply = useCallback(
    async (next: boolean): Promise<void> => {
      if (!stream || !supported) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      try {
        await track.applyConstraints({
          advanced: [{ torch: next } as MediaTrackConstraintSetWithTorch],
        });
        setOn(next);
      } catch (err) {
        console.warn("[useTorch] applyConstraints 失敗:", err);
        setOn(false);
      }
    },
    [stream, supported],
  );

  const toggle = useCallback(() => apply(!on), [apply, on]);
  const turnOff = useCallback(() => apply(false), [apply]);

  return { supported, on, toggle, turnOff };
}
