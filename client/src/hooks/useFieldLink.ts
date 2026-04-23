// 🔗 統一場域路徑 builder — 確保玩家端內部導航不脫離 /f/:code scope
//
// 背景：
//   玩家從 /f/HPSPACE 進入後，所有 Link href="/home" 會跳 /home（脫離場域 scope）
//   → 重新整理讀 localStorage 若沒值/過期 → 變回預設場域（JIACHUN）
//
// 解決：
//   所有內部 Link / setLocation 改用 useFieldLink() 產生的 link()
//   自動加 /f/:code 前綴
//
// 使用：
//   const link = useFieldLink();
//   <Link href={link("/home")} />          → /f/HPSPACE/home
//   <Link href={link("/game/abc123")} />   → /f/HPSPACE/game/abc123
//   setLocation(link("/leaderboard"))      → /f/HPSPACE/leaderboard
//
// 特殊情況：
//   - 外部 URL (http://...) 或 已含 /f/ → 原樣返回
//   - 無當前場域（例如尚未載入）→ 原樣返回（fallback 到舊路由 + localStorage）
import { useCallback } from "react";
import { useCurrentField } from "@/providers/FieldThemeProvider";

export function useFieldLink() {
  const field = useCurrentField();
  const code = field?.code;

  return useCallback(
    (path: string): string => {
      if (!path) return path;
      // 外部網址不處理
      if (/^https?:\/\//i.test(path)) return path;
      // 已經是 /f/... 不重複加
      if (path.startsWith("/f/") || path === "/f") return path;
      // 無場域資訊（provider 還沒載好）→ 原樣
      if (!code) return path;
      // 統一補 /f/:code 前綴
      const normalized = path.startsWith("/") ? path : "/" + path;
      return `/f/${code}${normalized}`;
    },
    [code],
  );
}
