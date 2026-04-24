// 🔍 搜尋框鍵盤快捷鍵 hook
// 用法：
//   const { inputRef, isMac, handleEscape } = useSearchShortcut();
//   <Input
//     ref={inputRef}
//     value={value}
//     onKeyDown={(e) => handleEscape(e, value, setValue)}
//   />
//
// 按下：
//   - `/`            → focus + select（global，永遠綁）
//   - `Cmd+K` (Mac)  → focus + select（global，可停用）
//   - `Ctrl+K` (其他) → focus + select（global，可停用）
//   - `Esc`          → 有內容先清空、空內容則失焦（需在 input 上綁 onKeyDown）
//
// ⚠️ 當頁面已有 CommandPalette 監聽 ⌘K（例如 UnifiedAdminLayout），要傳 `{ disableCmdK: true }`
//    避免 admin 頁面的 ⌘K 被搜尋框搶走。
//
// 自動忽略已在輸入中（INPUT / TEXTAREA / contentEditable）的狀態，避免干擾打字。
import { useCallback, useEffect, useMemo, useRef } from "react";
import { isMacOS } from "@/lib/platform";

interface UseSearchShortcutOptions {
  /** 停用 Cmd/Ctrl+K shortcut（在有 CommandPalette 的 admin 頁面務必傳 true） */
  disableCmdK?: boolean;
}

export function useSearchShortcut<T extends HTMLElement = HTMLInputElement>(
  options: UseSearchShortcutOptions = {},
) {
  const { disableCmdK = false } = options;
  const inputRef = useRef<T>(null);

  // 偵測 macOS（一次性 memoize，避免每 render 重讀 navigator）
  const isMac = useMemo(() => isMacOS(), []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      const isCmdK =
        !disableCmdK &&
        (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      const isSlash =
        e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey;

      if (isCmdK || isSlash) {
        e.preventDefault();
        const el = inputRef.current as unknown as HTMLInputElement | null;
        el?.focus();
        // 有 select 方法的話（input/textarea）就順便選取，方便直接覆寫
        if (el && typeof (el as HTMLInputElement).select === "function") {
          (el as HTMLInputElement).select();
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [disableCmdK]);

  /**
   * 🆕 Esc 鍵行為：有內容 → 清空；空內容 → 失焦。
   * 綁在 <Input onKeyDown={(e) => handleEscape(e, value, setValue)}>
   */
  const handleEscape = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      value: string,
      setValue: (v: string) => void,
    ) => {
      if (e.key !== "Escape") return;
      if (value) {
        setValue("");
      } else {
        e.currentTarget.blur();
      }
    },
    [],
  );

  return { inputRef, isMac, handleEscape };
}
