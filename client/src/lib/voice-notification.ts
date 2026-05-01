// 隊友狀態語音通知（Phase 3）
//
// 用瀏覽器內建 SpeechSynthesis（免費、零依賴），把「OOO 離線了 / 回來了 / 已離開」
// 唸給玩家聽。設計重點：
//   - 小聲（volume 0.4 ≈ -8dB）— 不要打斷遊戲沉浸感
//   - 中文語音（zh-TW 優先，fallback zh-CN，最後 default）
//   - spam 防護：同 user + 同事件 60 秒內不重播（網路抖動連續觸發很常見）
//   - 使用者可全域關閉（localStorage flag）

const VOICE_DISABLED_KEY = "chito:voice:disabled";
const COOLDOWN_MS = 60_000;

/** 同 user 同事件最近播放時間 — Map<`${userId}:${event}`, timestamp> */
const recentSpeak: Map<string, number> = new Map();

export type VoiceEvent = "disconnected" | "reconnected" | "left" | "graceExpired" | "joined";

/** 玩家可全域關閉語音通知 */
export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.speechSynthesis === "undefined") return false;
  try {
    return localStorage.getItem(VOICE_DISABLED_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setVoiceEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (enabled) localStorage.removeItem(VOICE_DISABLED_KEY);
    else localStorage.setItem(VOICE_DISABLED_KEY, "1");
  } catch {
    /* localStorage 不可用 → 預設啟用 */
  }
}

/** 找最佳中文語音（zh-TW > zh-CN > 任何中文 > default） */
function pickChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((v) => v.lang === "zh-TW") ||
    voices.find((v) => v.lang === "zh-CN") ||
    voices.find((v) => v.lang.startsWith("zh")) ||
    null
  );
}

/** 速率限制 + 播放 */
export function speakTeamEvent(userId: string, userName: string, event: VoiceEvent) {
  if (!isVoiceEnabled()) return;
  if (typeof window === "undefined" || !window.speechSynthesis) return;

  // spam 防護：同 user + 同事件 60s 內不重播
  const key = `${userId}:${event}`;
  const now = Date.now();
  const last = recentSpeak.get(key) || 0;
  if (now - last < COOLDOWN_MS) return;
  recentSpeak.set(key, now);

  // 清掉舊記錄（避免 Map 無限長）
  if (recentSpeak.size > 100) {
    recentSpeak.forEach((t, k) => {
      if (now - t > COOLDOWN_MS * 2) recentSpeak.delete(k);
    });
  }

  // 不同事件講不同句子 — 自然語感比 emoji 唸出來好聽
  const text = (() => {
    switch (event) {
      case "disconnected":
        return `${userName} 暫時離線`;
      case "reconnected":
        return `${userName} 回來了`;
      case "left":
        return `${userName} 已離開遊戲`;
      case "graceExpired":
        return `${userName} 寬限期已過，準備自動離開`;
      case "joined":
        return `${userName} 加入隊伍`;
      default:
        return "";
    }
  })();
  if (!text) return;

  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "zh-TW";
    utter.volume = 0.4; // 小聲
    utter.rate = 1.05; // 略快（避免拖長）
    utter.pitch = 1;
    const voice = pickChineseVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch {
    /* SpeechSynthesis 不可用就跳過，不影響遊戲 */
  }
}

// 為了讓 voices 載入完成（Chrome 需要 voiceschanged 事件），首次呼叫時 prime
export function primeVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      // trigger 一次內部 voice list 載入
      window.speechSynthesis.getVoices();
    };
  }
}

// 給測試用：清空節流記憶
export function _resetVoiceThrottle() {
  recentSpeak.clear();
}
