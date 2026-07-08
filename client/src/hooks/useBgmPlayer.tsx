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
const DEFAULT_NORMAL_VOLUME = 0.5;
const DUCKED_VOLUME = 0.1;
const STORAGE_KEY = "chitoBgmMuted";

// 🎵 2026-07-08 CHITO #4e88bd7d：fade 世代控制 —
//   原本多個 fadeVolume 可同時跑（換曲 fade-out 未完又 fade-in / 停止與播放互搶），
//   兩個 rAF loop 輪流改 volume、後完成者蓋掉先完成者的結果 → 停止的 pause 被蓋
//   → 返回大廳 BGM 仍在播。改為每個 audio 只允許最新一個 fade 存活。
const fadeGeneration = new WeakMap<HTMLAudioElement, number>();

function fadeVolume(audio: HTMLAudioElement, target: number, durationMs: number, onDone?: () => void) {
  const gen = (fadeGeneration.get(audio) ?? 0) + 1;
  fadeGeneration.set(audio, gen);
  const start = audio.volume;
  const delta = target - start;
  const startTime = Date.now();
  const step = () => {
    // 有更新的 fade 啟動 → 本 loop 作廢（不呼叫 onDone）
    if (fadeGeneration.get(audio) !== gen) return;
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
  // 🆕 2026-05-12 #11: 動態音量（admin 在遊戲基本設定可調 0-100、預設 50）
  const normalVolumeRef = useRef<number>(DEFAULT_NORMAL_VOLUME);

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
        // 🎵 2026-07-08 CHITO #4e88bd7d：停止必須「斷根」——
        //   1. wantPlayRef=false：否則之後任何解鎖手勢（unlock handler）
        //      看到 src+wantPlay 會把音樂重新播起來（返回大廳仍播的路徑之一）
        //   2. fade 後清 src：確保就算有殘留 play() 也無聲源
        //   3. setTimeout 兜底：rAF 被節流（切背景/省電）時 fade 永不完成
        //      → pause 永不執行；計時器保證最終一定停
        wantPlayRef.current = false;
        const hardStop = () => {
          a.pause();
          a.removeAttribute("src");
          a.load();
        };
        fadeVolume(a, 0, FADE_DURATION_MS, hardStop);
        window.setTimeout(() => {
          // fade 正常完成的話 src 已清；否則強制停
          if (!wantPlayRef.current && a.src) hardStop();
        }, FADE_DURATION_MS + 300);
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

  // 🆕 2026-05-12 #11: 動態調整 BGM 預設音量（0-100）
  const setNormalVolume = useCallback(
    (volumePercent: number) => {
      const clamped = Math.max(0, Math.min(100, volumePercent));
      normalVolumeRef.current = clamped / 100;
      const a = audioRef.current;
      if (!a || muted) return;
      if (!ducked) {
        fadeVolume(a, normalVolumeRef.current, 200);
      }
    },
    [muted, ducked],
  );

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
