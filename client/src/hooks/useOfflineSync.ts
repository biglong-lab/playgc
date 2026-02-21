// 離線狀態管理與自動同步 Hook
import { useState, useEffect, useCallback } from "react";
import { getPendingUpdates, removePendingUpdate } from "@/lib/offlineStorage";
import { apiRequest } from "@/lib/queryClient";

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncPendingUpdates = useCallback(async () => {
    const pending = await getPendingUpdates();
    if (pending.length === 0) return;

    setIsSyncing(true);
    for (const update of pending) {
      try {
        await apiRequest("PATCH", `/api/sessions/${update.sessionId}/progress`, {
          pageId: update.pageId,
          score: update.score,
          inventory: update.inventory,
          variables: update.variables,
        });
        await removePendingUpdate(update.id);
      } catch {
        // 網路仍不穩，停止本次同步
        break;
      }
    }
    setIsSyncing(false);
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingUpdates();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncPendingUpdates]);

  return { isOnline, isSyncing };
}
