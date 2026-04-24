// ⌨️ 搜尋框快速鍵提示 — 顯示在 Input 右側的 kbd badge
// 用法：
//   <div className="relative">
//     <Input ref={inputRef} className="pr-14" />
//     {!value && <SearchKbdHint isMac={isMac} />}
//   </div>
//
// 桌面端顯示 ⌘K (Mac) / Ctrl K (其他)，手機端隱藏（sm:inline-flex）

interface SearchKbdHintProps {
  isMac: boolean;
  /** 覆蓋預設的 title 提示 */
  title?: string;
  /** 覆蓋預設 absolute 位置 */
  className?: string;
}

export default function SearchKbdHint({
  isMac,
  title = "按 / 或 ⌘K/Ctrl+K 快速搜尋",
  className,
}: SearchKbdHintProps) {
  return (
    <kbd
      className={
        className
          ? className
          : "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-70"
      }
      title={title}
      aria-hidden
    >
      {isMac ? (
        <>
          <span className="text-sm leading-none">⌘</span>
          <span>K</span>
        </>
      ) : (
        <>
          <span>Ctrl</span>
          <span>K</span>
        </>
      )}
    </kbd>
  );
}
