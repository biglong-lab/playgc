// 🛡️ useUnsavedWarning — 有未儲存變更時，離開頁面前警告
//
// 用法：
//   const hasUnsaved = formData !== settings;  // 或任何你判斷有變更的邏輯
//   useUnsavedWarning(hasUnsaved);
//
// 效果：
//   - 使用者關分頁 / 重新整理 / 網址列跳別的站 → 顯示瀏覽器原生 confirm
//   - hasUnsaved=false 時無作用，不會干擾沒變更的使用者
//
// 注意：
//   - 只能防瀏覽器層級的離開（刷新 / 關分頁 / 關瀏覽器）
//   - SPA 內的 wouter 路由切換不會觸發 beforeunload
//     （需額外處理路由攔截，這裡不做）
import { useEffect } from "react";

export function useUnsavedWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // 瀏覽器顯示自己的預設警告文字（無法客製）
      // 舊瀏覽器需要 returnValue 才會觸發
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasUnsavedChanges]);
}
