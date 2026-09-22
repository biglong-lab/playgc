// 🛡️ useUnsavedWarning / useUnsavedChangesGuard — 有未儲存變更時，離開頁面前攔截
//
// 用法一（只擋瀏覽器層級離開：關分頁 / 重新整理 / 網址列跳別的站）：
//   useUnsavedWarning(hasUnsaved);
//
// 用法二（連站內換頁一起擋，搭配 UnsavedChangesDialog 三選一對話框）：
//   const guard = useUnsavedChangesGuard({ isDirty, onSave: saveAsync });
//   <Button onClick={() => guard.guardNavigate("/admin/games")}>返回</Button>
//   <UnsavedChangesDialog guard={guard} />
//
//   - 程式換頁：改呼叫 guard.guardNavigate(to)，有未存變更就先跳對話框
//   - 站內連結（wouter <Link> / 一般 <a href>）：自動攔截點擊，不用逐一改寫
//   - onSave 回傳 true 才會離開；失敗時對話框留著，讓使用者改選「不存離開」或取消
//
// 已知限制：瀏覽器「上一頁」按鈕（popstate）目前不攔截
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

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

/**
 * 判斷一次點擊是否為「站內換頁連結」，是就回傳目標路徑（pathname + search + hash）
 * 不攔截：非左鍵 / 修飾鍵（開新分頁）/ 另開視窗 / 下載 / 外部網域 / 同頁錨點
 */
export function resolveInternalLinkTarget(event: MouseEvent, currentHref: string): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;

  const target = event.target;
  const anchor = target instanceof Element ? target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const current = new URL(currentHref);
  const next = new URL(anchor.getAttribute("href") ?? "", currentHref);
  if (next.origin !== current.origin) return null;
  if (next.pathname === current.pathname && next.search === current.search) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}

/** 有未存變更時，在 capture 階段攔截站內連結點擊（早於 React / wouter Link 的 onClick） */
function useInternalLinkInterceptor(enabled: boolean, onIntercept: (to: string) => void): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MouseEvent) => {
      const to = resolveInternalLinkTarget(event, window.location.href);
      if (!to) return;
      event.preventDefault();
      event.stopPropagation();
      onIntercept(to);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [enabled, onIntercept]);
}

export interface UnsavedChangesGuardOptions {
  /** 目前是否有未儲存的變更 */
  isDirty: boolean;
  /** 儲存；成功回傳 true（失敗請自行提示錯誤並回傳 false） */
  onSave: () => Promise<boolean>;
}

export interface UnsavedChangesGuard {
  /** 取代 setLocation：有未存變更時先跳對話框 */
  guardNavigate: (to: string) => void;
  /** 等待使用者決定的目標路徑；null = 對話框關閉 */
  pendingTo: string | null;
  isSaving: boolean;
  saveAndLeave: () => Promise<void>;
  leaveWithoutSaving: () => void;
  cancel: () => void;
}

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
}: UnsavedChangesGuardOptions): UnsavedChangesGuard {
  const [, navigate] = useLocation();
  const [pendingTo, setPendingTo] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useUnsavedWarning(isDirty);
  useInternalLinkInterceptor(isDirty, setPendingTo);

  const guardNavigate = useCallback(
    (to: string) => {
      if (isDirty) {
        setPendingTo(to);
        return;
      }
      navigate(to);
    },
    [isDirty, navigate],
  );

  const leaveWithoutSaving = useCallback(() => {
    setPendingTo(null);
    if (pendingTo) navigate(pendingTo);
  }, [pendingTo, navigate]);

  const saveAndLeave = useCallback(async () => {
    if (!pendingTo) return;
    setIsSaving(true);
    let saved = false;
    try {
      saved = await onSave();
    } catch {
      saved = false; // onSave 自己負責提示錯誤；這裡只決定要不要離開
    } finally {
      setIsSaving(false);
    }
    if (!saved) return;
    setPendingTo(null);
    navigate(pendingTo);
  }, [pendingTo, onSave, navigate]);

  const cancel = useCallback(() => setPendingTo(null), []);

  return { guardNavigate, pendingTo, isSaving, saveAndLeave, leaveWithoutSaving, cancel };
}
