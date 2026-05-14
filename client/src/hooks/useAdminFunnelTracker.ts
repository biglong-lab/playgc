// 📊 useAdminFunnelTracker — admin 建場 funnel 埋點 hook（W2 / 2026-05-14）
//
// 用途：
//   - admin 從進後台到 QR 印出整段流程跨多頁、funnelId 用 localStorage 持久化
//   - 自動推送 milestone 到 POST /api/admin/timings/milestone
//   - 失敗靜默（不阻塞 UI、不重試）
//
// 使用：
//   ```ts
//   const { trackMilestone, startFunnel, completeFunnel, abandonFunnel } = useAdminFunnelTracker();
//
//   // 進後台時
//   useEffect(() => { trackMilestone("entered_admin"); }, []);
//
//   // 選情境時
//   trackMilestone("selected_scenario", { scenarioId: "..." });
//
//   // 一鍵建場 button click
//   trackMilestone("instantiated_game", { useAi: true });
//
//   // QR 列印時
//   completeFunnel({ resultingGameId: "..." });
//   ```

import { useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

const STORAGE_KEY = "admin_funnel_id";
const FUNNEL_TTL_MS = 2 * 60 * 60 * 1000; // 2 小時、超過視為新 funnel

type MilestoneKey =
  | "entered_admin"
  | "opened_scenario_picker"
  | "selected_scenario"
  | "instantiated_game"
  | "opened_qr_print"
  | "qr_printed"
  | "abandoned";

interface MilestoneExtras {
  scenarioId?: string;
  useAi?: boolean;
  resultingGameId?: string;
}

interface StoredFunnel {
  funnelId: string;
  createdAt: number;
}

function readStoredFunnel(): StoredFunnel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredFunnel;
    if (Date.now() - parsed.createdAt > FUNNEL_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredFunnel(funnelId: string): StoredFunnel {
  const stored: StoredFunnel = { funnelId, createdAt: Date.now() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // ignore quota / private mode
  }
  return stored;
}

function clearStoredFunnel() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function generateFunnelId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `f_${ts}_${rand}`;
}

export function useAdminFunnelTracker() {
  // 用 ref 避免 stale closure；funnelId 主要源頭仍是 localStorage
  const cachedFunnelRef = useRef<StoredFunnel | null>(readStoredFunnel());

  const getOrCreateFunnel = useCallback((): string => {
    let stored = cachedFunnelRef.current ?? readStoredFunnel();
    if (!stored) {
      const newId = generateFunnelId();
      stored = writeStoredFunnel(newId);
      cachedFunnelRef.current = stored;
    }
    return stored.funnelId;
  }, []);

  const startFunnel = useCallback((extras?: MilestoneExtras): string => {
    const newId = generateFunnelId();
    const stored = writeStoredFunnel(newId);
    cachedFunnelRef.current = stored;
    // 立即推第一個 milestone
    pushMilestone(newId, "entered_admin", extras).catch(() => {});
    return newId;
  }, []);

  const trackMilestone = useCallback(
    (milestone: MilestoneKey, extras?: MilestoneExtras): void => {
      const funnelId = getOrCreateFunnel();
      // fire and forget
      pushMilestone(funnelId, milestone, extras).catch(() => {});
    },
    [getOrCreateFunnel],
  );

  const completeFunnel = useCallback(
    (extras?: MilestoneExtras): void => {
      const funnelId = getOrCreateFunnel();
      pushMilestone(funnelId, "qr_printed", extras)
        .catch(() => {})
        .finally(() => {
          clearStoredFunnel();
          cachedFunnelRef.current = null;
        });
    },
    [getOrCreateFunnel],
  );

  const abandonFunnel = useCallback((): void => {
    const stored = cachedFunnelRef.current ?? readStoredFunnel();
    if (!stored) return;
    pushMilestone(stored.funnelId, "abandoned")
      .catch(() => {})
      .finally(() => {
        clearStoredFunnel();
        cachedFunnelRef.current = null;
      });
  }, []);

  return {
    startFunnel,
    trackMilestone,
    completeFunnel,
    abandonFunnel,
    getCurrentFunnelId: () => cachedFunnelRef.current?.funnelId ?? null,
  };
}

async function pushMilestone(
  funnelId: string,
  milestone: MilestoneKey,
  extras?: MilestoneExtras,
): Promise<void> {
  try {
    await apiRequest("POST", "/api/admin/timings/milestone", {
      funnelId,
      milestone,
      ...extras,
    });
  } catch (err) {
    // 靜默 — 埋點失敗不影響 admin 操作
    if (typeof window !== "undefined" && (window as unknown as { __ADMIN_FUNNEL_DEBUG?: boolean }).__ADMIN_FUNNEL_DEBUG) {
      console.warn("[admin-funnel] milestone push 失敗:", milestone, err);
    }
  }
}
