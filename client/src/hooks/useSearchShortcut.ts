// 🔍 搜尋框鍵盤快捷鍵 hook
// 用法：
//   const { inputRef, isMac } = useSearchShortcut();
//   <Input ref={inputRef} ... />
//
// 按下：
//   - `/`            → focus + select
//   - `Cmd+K` (Mac)  → focus + select
//   - `Ctrl+K` (其他) → focus + select
//
// 自動忽略已在輸入中（INPUT / TEXTAREA / contentEditable）的狀態，避免干擾打字。
import { useEffect, useMemo, useRef } from "react";

export function useSearchShortcut<T extends HTMLElement = HTMLInputElement>() {
  const inputRef = useRef<T>(null);

  // 偵測 macOS（一次性 memoize，避免每 render 重讀 navigator）
  const isMac = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    // navigator.platform 最穩定；userAgentData 尚未廣泛支援
    return /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || "");
  }, []);

  useEffect(() => {
    const handleShortcut = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      const isCmdK =
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
  }, []);

  return { inputRef, isMac };
}
