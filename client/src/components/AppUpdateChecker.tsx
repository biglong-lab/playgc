// 🔄 App 版本自動檢查器（v2 — 2026-05-07 重寫）
//
// 為什麼重寫：
//   舊版用 HTML bundle hash 比對（fetch /、抽 script src 的 hash）。
//   問題：service worker 攔截 navigation request、SW cache 的 /index.html 跟
//        DOM 上 script src 的 hash 永遠 mismatch，導致使用者按 10+ 次「立即更新」
//        都還在跳 toast。
//
// 新做法：
//   1. 用 /api/version 比對 commit（跟 main.tsx 同一套機制、不受 SW HTML cache 影響）
//   2. localStorage 冷卻：使用者按過更新後 1 小時內若仍是同一個 server commit
//      就視為「更新失敗或剛更新完」、不再跳
//   3. retry 上限：同一個 server commit 連續超過 3 次都還跳 → 強制清 SW + caches reload
//
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, RotateCw, X } from "lucide-react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘
const INITIAL_CHECK_DELAY_MS = 5 * 1000;
const COOLDOWN_MS = 60 * 60 * 1000; // 🆕 1 小時冷卻：同一個目標 commit 在這時間內不再跳
const MAX_PROMPT_PER_COMMIT = 3; // 🆕 同一 commit 跳超過 3 次 → 強制清 SW

const COOLDOWN_KEY = "chito_app_update_cooldown_v2";
const PROMPT_COUNT_KEY = "chito_app_update_prompt_count_v2";

const CLIENT_COMMIT = (import.meta.env.VITE_APP_COMMIT as string | undefined) || "unknown";

interface CooldownEntry {
  commit: string;
  /** 開始冷卻時間（ms） */
  startedAt: number;
}

interface PromptCountEntry {
  commit: string;
  count: number;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage full / private mode — 忽略 */
  }
}

/** 是否還在冷卻期內（針對該 server commit） */
function isInCooldown(serverCommit: string): boolean {
  const entry = readJson<CooldownEntry>(COOLDOWN_KEY);
  if (!entry) return false;
  if (entry.commit !== serverCommit) return false;
  return Date.now() - entry.startedAt < COOLDOWN_MS;
}

function setCooldown(serverCommit: string): void {
  writeJson(COOLDOWN_KEY, { commit: serverCommit, startedAt: Date.now() });
}

function bumpPromptCount(serverCommit: string): number {
  const entry = readJson<PromptCountEntry>(PROMPT_COUNT_KEY);
  const count = entry?.commit === serverCommit ? entry.count + 1 : 1;
  writeJson(PROMPT_COUNT_KEY, { commit: serverCommit, count });
  return count;
}

function resetPromptCount(): void {
  try {
    localStorage.removeItem(PROMPT_COUNT_KEY);
  } catch {
    /* ignore */
  }
}

/** 強制清 SW + caches + reload（loop 救援用） */
async function nuclearReload(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  window.location.reload();
}

export default function AppUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const updatingRef = useRef(false);

  useEffect(() => {
    if (CLIENT_COMMIT === "unknown") return; // dev / build 沒注入 commit → 不檢查

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store", credentials: "omit" });
        if (!res.ok) return;
        const data = (await res.json()) as { commit?: string };
        const serverCommit = data.commit;
        if (!serverCommit || serverCommit === "unknown") return;
        if (serverCommit === CLIENT_COMMIT) {
          // 版本一致 → 重置冷卻 + count（避免下次新版來時被舊冷卻擋住）
          resetPromptCount();
          return;
        }
        // 版本不一致 → 檢查冷卻
        if (isInCooldown(serverCommit)) return;

        // 連續跳超過上限 → 不再煩、直接 nuclear reload 一次救
        const count = bumpPromptCount(serverCommit);
        if (count > MAX_PROMPT_PER_COMMIT) {
          setCooldown(serverCommit); // 設冷卻、避免無限 reload loop
          await nuclearReload();
          return;
        }

        setUpdateAvailable(true);
      } catch {
        /* 網路 / CORS — 下次再試 */
      }
    };

    const initialTimer = setTimeout(check, INITIAL_CHECK_DELAY_MS);
    const intervalTimer = setInterval(check, CHECK_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = async () => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setIsUpdating(true);

    // 🛡️ 設冷卻：使用者按過更新後 1 小時內、即使 server commit 沒變也不再跳
    //   防止 reload 後 SW 還沒換、版本檢查又把 toast 跳出來的循環
    try {
      const res = await fetch("/api/version", { cache: "no-store", credentials: "omit" });
      if (res.ok) {
        const data = (await res.json()) as { commit?: string };
        if (data.commit) setCooldown(data.commit);
      }
    } catch {
      /* ignore — 仍要 reload */
    }

    const hardReloadTimer = setTimeout(() => {
      window.location.reload();
    }, 5000);

    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
          setTimeout(() => {
            clearTimeout(hardReloadTimer);
            window.location.reload();
          }, 800);
          return;
        }
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* fall through to reload */
    }
    clearTimeout(hardReloadTimer);
    window.location.reload();
  };

  const handleDismiss = async () => {
    // 🆕 使用者按 X：也設冷卻 1 小時（avoiding 同一版又被跳到煩）
    try {
      const res = await fetch("/api/version", { cache: "no-store", credentials: "omit" });
      if (res.ok) {
        const data = (await res.json()) as { commit?: string };
        if (data.commit) setCooldown(data.commit);
      }
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] bg-card border-2 border-primary/40 rounded-xl shadow-2xl p-4 sm:max-w-sm animate-in slide-in-from-bottom-4 fade-in"
      role="alert"
      data-testid="app-update-toast"
    >
      <button
        type="button"
        onClick={handleDismiss}
        disabled={isUpdating}
        className="absolute top-2 right-2 text-muted-foreground/50 hover:text-muted-foreground p-1.5 rounded hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed"
        aria-label="關閉（稍後再更新）"
        data-testid="button-app-update-dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-8 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {isUpdating ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <RotateCw className="w-5 h-5 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-semibold text-sm">
            {isUpdating ? "更新中、請稍候..." : "有新版本可用 🎉"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {isUpdating ? "正在套用最新版本、頁面將自動重新載入" : "更新取得最新功能與修復"}
          </p>
        </div>
      </div>

      <Button
        onClick={handleUpdate}
        disabled={isUpdating}
        className="w-full gap-2 h-11 text-base font-semibold disabled:opacity-80"
        data-testid="button-app-update"
      >
        {isUpdating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            更新中...
          </>
        ) : (
          <>
            <RotateCw className="w-4 h-4" />
            立即更新
          </>
        )}
      </Button>
    </div>
  );
}
