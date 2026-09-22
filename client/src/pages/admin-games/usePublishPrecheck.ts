// 🚦 遊戲列表「發布」前檢查（2026-09-23 P0-B）
//
// 以前列表頁的發布鈕直接打 API，繞過編輯器的驗證。
// 現在按「發布」先讀遊戲內容（含頁面）、跑前後端共用的 checkGamePublishable：
//   - 不合格 → 回傳 blocked，由對話框列出問題、不送出
//   - 合格 → 呼叫原本的 onPublish
//   - 讀不到內容（網路錯誤）→ 照樣送出，交給後端把關（後端一定會再檢查一次）
// 取消發布 / 封存不需檢查，直接送出。
import { useCallback, useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { checkGamePublishable, type PublishCheckError } from "@shared/lib/game-publishable";
import type { PageLike } from "@shared/lib/page-config-validation";

export interface PublishBlocked {
  gameId: string;
  gameTitle: string;
  errors: PublishCheckError[];
}

interface GameDetail {
  title?: string | null;
  pages?: PageLike[] | null;
}

type PublishFn = (id: string, status: string) => void;

/** 讀遊戲內容（含頁面）；失敗回 null */
async function fetchGameDetail(id: string): Promise<GameDetail | null> {
  try {
    const res = await apiRequest("GET", `/api/admin/games/${id}`);
    return (await res.json()) as GameDetail;
  } catch {
    return null;
  }
}

export function usePublishPrecheck(onPublish: PublishFn) {
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<PublishBlocked | null>(null);

  const requestPublish = useCallback(
    async (id: string, status: string) => {
      if (status !== "published") {
        onPublish(id, status);
        return;
      }
      setChecking(true);
      const detail = await fetchGameDetail(id);
      setChecking(false);

      // 讀取失敗不擋：後端發佈端點會再跑同一套檢查
      if (!detail) {
        onPublish(id, status);
        return;
      }
      const check = checkGamePublishable(detail, detail.pages);
      if (check.ok) {
        onPublish(id, status);
        return;
      }
      setBlocked({ gameId: id, gameTitle: detail.title ?? "", errors: check.errors });
    },
    [onPublish],
  );

  const dismiss = useCallback(() => setBlocked(null), []);

  return { requestPublish, checking, blocked, dismiss };
}
