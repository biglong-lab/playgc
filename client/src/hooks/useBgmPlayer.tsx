// 🎵 useBgmPlayer — 整場遊戲背景音樂控制
// 2026-05-07：BGM 系統核心
//
// 架構：Context Provider 包 GamePlay、子元件用 useBgmPlayer() 控制
//
// 功能：
//   - setBgmUrl(url)  切換 BGM（fade out 舊的 + fade in 新的）
//   - play() / pause()  控制
//   - duck()  影片 / 拍照 / 對講機等播音時減弱（volume 0.2）
//   - unduck()  恢復原音量（1.0）
//
// iOS Safari autoplay：必須 user gesture 觸發、所以監聽 first interaction

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface BgmPlayerAPI {
  /** 切換 BGM URL（null = 停止）*/
  setBgmUrl: (url: string | null) => void;
  /** 暫停 */
  pause: () => void;
  /** 恢復播放 */
  play: () => void;
  /** 減弱（volume 0.2）— 影片 / 對講機播音時呼叫 */
  duck: () => void;
  /** 恢復原音量（1.0）*/
  unduck: () => void;
  /** 整體靜音切換（玩家手動）*/
  toggleMute: () => void;
  /**
   * 🆕 2026-05-12: 設定預設音量（0-100）— 對應 admin 在遊戲基本設定的 bgmVolume slider
   */
  setNormalVolume: (volumePercent: number) => void;
  /** 當前 url */
  currentUrl: string | null;
  /** 是否靜音（玩家設定）*/
  muted: boolean;
  /** 是否減弱（duck 中）*/
  ducked: boolean;
  /** iOS user gesture 是否已解鎖 */
  unlocked: boolean;
}

const BgmPlayerContext = createContext<BgmPlayerAPI | null>(null);

const FADE_DURATION_MS = 400;
const DEFAULT_normalVolumeRef.current = 0.5;
const DUCKED_VOLUME = 0.1;
const STORAGE_KEY = "chitoBgmMuted";

function fadeVolume(audio: HTMLAudioElement, target: number, durationMs: number, onDone?: () => void) {
  const start = audio.volume;
  const delta = target - start;
  const startTime = Date.now();
  const step = () => {
    const elapsed = Date.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    audio.volume = Math.max(0, Math.min(1, start + delta * t));
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      audio.volume = target;
      onDone?.();
    }
  };
  step();
}

export function BgmPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [ducked, setDucked] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const wantPlayRef = useRef(false);

  // lazy 建 audio element（不要 SSR 跑）
  const ensureAudio = useCallback((): HTMLAudioElement | null => {
    if (typeof window === "undefined") return null;
    if (audioRef.current) return audioRef.current;
    const a = new Audio();
    a.loop = true;
    a.volume = muted ? 0 : normalVolumeRef.current;
    a.preload = "auto";
    audioRef.current = a;
    return a;
  }, [muted]);

  // user gesture 解鎖（iOS）
  useEffect(() => {
    if (unlocked) return;
    const unlock = () => {
      const a = ensureAudio();
      if (!a) return;
      // 嘗試觸發一次 play+pause、解鎖 autoplay
      const src = a.src;
      if (src && wantPlayRef.current && !muted) {
        void a.play().catch(() => { /* 仍可能失敗、不阻塞 */ });
      }
      setUnlocked(true);
    };
    const events = ["pointerdown", "touchstart", "keydown"];
    events.forEach((e) => document.addEventListener(e, unlock, { once: true, passive: true }));
    return () => {
      events.forEach((e) => document.removeEventListener(e, unlock));
    };
  }, [unlocked, ensureAudio, muted]);

  const setBgmUrl = useCallback(
    (url: string | null) => {
      const a = ensureAudio();
      if (!a) return;
      if (url === currentUrl) return;
      setCurrentUrl(url);

      if (!url) {
        // fade out 後 pause
        fadeVolume(a, 0, FADE_DURATION_MS, () => {
          a.pause();
        });
        return;
      }

      // 換 src + fade in
      wantPlayRef.current = true;
      const startPlay = () => {
        a.src = url;
        a.volume = 0;
        a.load();
        a.play()
          .then(() => {
            fadeVolume(a, muted ? 0 : (ducked ? DUCKED_VOLUME : normalVolumeRef.current), FADE_DURATION_MS);
          })
          .catch(() => {
            // 沒解鎖前會失敗、等下次 user gesture
          });
      };

      // 若有舊 BGM 在播 → fade out 再切
      if (!a.paused && a.volume > 0) {
        fadeVolume(a, 0, FADE_DURATION_MS, startPlay);
      } else {
        startPlay();
      }
    },
    [ensureAudio, currentUrl, muted, ducked],
  );

  const pause = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    wantPlayRef.current = false;
    a.pause();
  }, []);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a || !a.src) return;
    wantPlayRef.current = true;
    void a.play().catch(() => { /* 等 user gesture */ });
  }, []);

  const duck = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setDucked(true);
    if (!muted) fadeVolume(a, DUCKED_VOLUME, 200);
  }, [muted]);

  const unduck = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    setDucked(false);
    if (!muted) fadeVolume(a, normalVolumeRef.current, 200);
  }, [muted]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
    const a = audioRef.current;
    if (!a) return;
    if (next) {
      fadeVolume(a, 0, 200);
    } else {
      fadeVolume(a, ducked ? DUCKED_VOLUME : normalVolumeRef.current, 200);
    }
  }, [muted, ducked]);

  // unmount 時 cleanup
  useEffect(() => {
    return () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  const api: BgmPlayerAPI = {
    setBgmUrl,
    pause,
    play,
    duck,
    unduck,
    toggleMute,
    setNormalVolume,
    currentUrl,
    muted,
    ducked,
    unlocked,
  };

  return <BgmPlayerContext.Provider value={api}>{children}</BgmPlayerContext.Provider>;
}

export function useBgmPlayer(): BgmPlayerAPI {
  const ctx = useContext(BgmPlayerContext);
  if (!ctx) {
    // 沒包 Provider → 給 noop API（避免 crash）
    return {
      setBgmUrl: () => undefined,
      pause: () => undefined,
      play: () => undefined,
      duck: () => undefined,
      unduck: () => undefined,
      toggleMute: () => undefined,
      setNormalVolume: () => undefined,
      currentUrl: null,
      muted: false,
      ducked: false,
      unlocked: false,
    };
  }
  return ctx;
}
