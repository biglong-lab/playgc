// 🎬 useArVideoRecorder — AR 貼圖長按錄影（ProPlan CHITO AR #2）
//
// 錄「已合成貼圖的 canvas」captureStream → MediaRecorder → Blob。
//   - 最長 30 秒、到上限自動停止
//   - 提供 elapsed（秒）與 progress（0~1）給快門外圈進度環
//   - 不支援 MediaRecorder/captureStream 的裝置 → isSupported=false（UI 降級成只拍照）
// 純 client、不上傳 server（結果 Blob 供本地存檔/分享）。
import { useCallback, useRef, useState } from "react";

export const AR_VIDEO_MAX_MS = 30_000;

export interface ArVideoRecorder {
  isSupported: boolean;
  isRecording: boolean;
  /** 已錄秒數（整數）*/
  elapsedSec: number;
  /** 進度 0~1（給進度環）*/
  progress: number;
  /** 開始錄影；傳入要錄的 canvas（需持續被繪製）*/
  start: (canvas: HTMLCanvasElement) => void;
  /** 手動停止（回傳最終 Blob；也會觸發到上限自動停止）*/
  stop: () => void;
  /** 最近一次錄影結果 */
  result: { blob: Blob; url: string; mimeType: string } | null;
  clearResult: () => void;
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export function useArVideoRecorder(): ArVideoRecorder {
  const isSupported =
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function";

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ArVideoRecorder["result"]>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);
  const mimeRef = useRef<string>("video/webm");

  const cleanupTimers = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (maxTimerRef.current !== null) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    }
    cleanupTimers();
  }, [cleanupTimers]);

  const start = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!isSupported || isRecording) return;
      const mime = pickMimeType();
      if (!mime) return;
      mimeRef.current = mime;

      let stream: MediaStream;
      try {
        stream = canvas.captureStream(30);
      } catch {
        return;
      }

      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, { mimeType: mime });
      } catch {
        return;
      }

      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        cleanupTimers();
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeRef.current });
        if (blob.size > 0) {
          const url = URL.createObjectURL(blob);
          setResult({ blob, url, mimeType: mimeRef.current });
        }
      };

      recorderRef.current = rec;
      startAtRef.current = Date.now();
      setElapsedSec(0);
      setProgress(0);
      setIsRecording(true);

      try {
        rec.start(100); // 100ms timeslice → 穩定產 chunk
      } catch {
        setIsRecording(false);
        return;
      }

      // 進度 tick（用 Date 差、避免依賴 setInterval 準度）
      tickRef.current = window.setInterval(() => {
        const ms = Date.now() - startAtRef.current;
        setElapsedSec(Math.floor(ms / 1000));
        setProgress(Math.min(1, ms / AR_VIDEO_MAX_MS));
      }, 100);

      // 30 秒自動停止
      maxTimerRef.current = window.setTimeout(() => stop(), AR_VIDEO_MAX_MS);
    },
    [isSupported, isRecording, cleanupTimers, stop],
  );

  const clearResult = useCallback(() => {
    setResult((r) => {
      if (r) URL.revokeObjectURL(r.url);
      return null;
    });
  }, []);

  return { isSupported, isRecording, elapsedSec, progress, start, stop, result, clearResult };
}
