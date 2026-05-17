// 📳 POS 操作回饋（震動 + 音效）— 2026-05-18
//
// 在掃描 QR 成功 / 收款成功時、給工作人員感官回饋
// 因為現場手機掉在櫃台上可能沒看到螢幕、震動+音效讓人秒知有反應

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audioCtx = new Ctx();
    } catch {
      // ignore
    }
  }
  return audioCtx;
}

/** 短嗶聲（掃描成功用）*/
function beep(freq: number, duration: number, volume = 0.15): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    // 漸消、避免 click 雜訊
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration / 1000);
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    /* ignore */
  }
}

/** 震動（手機 only、桌機無感）*/
function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

/** 掃描成功：短嗶 + 短震 */
export function feedbackScanSuccess(): void {
  beep(880, 100); // A5
  vibrate(50);
}

/** 收款成功：雙嗶（上升）+ 雙震 */
export function feedbackCheckoutSuccess(): void {
  beep(660, 100); // E5
  setTimeout(() => beep(880, 150), 120); // A5
  vibrate([60, 40, 80]);
}

/** 錯誤：低嗶 + 長震 */
export function feedbackError(): void {
  beep(220, 200, 0.2); // A3
  vibrate([200]);
}
