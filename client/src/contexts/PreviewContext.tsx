// 🎬 PreviewContext — 預覽模式狀態
//
// 用途：
//   admin 進入 /admin/games/:gameId/preview 時，整棵元件樹標記為「預覽模式」
//   GamePlay 內所有 server mutation（sessions/locations/leaderboard）都檢查 isPreview 跳過
//
// 設計：
//   - PreviewProvider 包覆預覽路由的所有子元件
//   - usePreview() 在任何子元件可取 { isPreview, gameId }
//   - 預設 isPreview = false（玩家正式遊玩走預設值，不影響）
//
// 範圍限制（不擴散）：
//   - 只提供標記 + gameId，不處理 mock 資料邏輯（讓使用方自行判斷）
//   - 不持久化（每次進預覽都是 fresh state）

import { createContext, useContext, type ReactNode } from "react";

interface PreviewContextValue {
  /** 是否處於預覽模式（admin 預覽未發布遊戲） */
  isPreview: boolean;
  /** 預覽中的 game ID（給 mutation 跳過邏輯用） */
  gameId: string | null;
}

const PreviewContext = createContext<PreviewContextValue>({
  isPreview: false,
  gameId: null,
});

interface PreviewProviderProps {
  isPreview: boolean;
  gameId: string;
  children: ReactNode;
}

/**
 * 包覆預覽路由的元件樹，讓子元件可透過 usePreview() 取得 isPreview 標記
 *
 * 使用方式：
 *   <PreviewProvider isPreview gameId={gameId}>
 *     <GamePlayCore />  // 內部所有 mutation 檢查 isPreview 跳過
 *   </PreviewProvider>
 */
export function PreviewProvider({
  isPreview,
  gameId,
  children,
}: PreviewProviderProps) {
  return (
    <PreviewContext.Provider value={{ isPreview, gameId }}>
      {children}
    </PreviewContext.Provider>
  );
}

/**
 * 取得當前預覽狀態
 *
 * @returns { isPreview, gameId }
 *   - 在預覽路由下：{ isPreview: true, gameId: "xxx" }
 *   - 玩家正式遊玩 / 其他頁面：{ isPreview: false, gameId: null }
 *
 * 典型用法：
 *   const { isPreview } = usePreview();
 *   if (!isPreview) {
 *     await apiRequest("PATCH", `/api/sessions/${sid}/...`);
 *   }
 */
export function usePreview(): PreviewContextValue {
  return useContext(PreviewContext);
}
