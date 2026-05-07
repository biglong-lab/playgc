// 🔠 FontScaleSwitcher — 文字大小切換 UI
// 2026-05-07：放在玩家頁 header / admin settings
//
// 三個按鈕：A 小 / A 中 / A 大
// 點選後立即生效（透過 useFontScale 改 CSS variable）

import { useFontScale, type FontScale } from "@/hooks/useFontScale";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: FontScale; label: string; size: string }> = [
  { value: "normal", label: "標準", size: "text-sm" },
  { value: "large", label: "大", size: "text-base" },
  { value: "xl", label: "特大", size: "text-lg" },
];

interface FontScaleSwitcherProps {
  /** 額外 className */
  className?: string;
  /** 顯示文字模式（默 emoji-only icon-button）*/
  showLabel?: boolean;
}

export default function FontScaleSwitcher({
  className,
  showLabel = false,
}: FontScaleSwitcherProps) {
  const { scale, setScale } = useFontScale();

  return (
    <div
      className={cn("inline-flex items-center gap-0.5 rounded-md border bg-background/80 p-0.5", className)}
      role="group"
      aria-label="文字大小"
      data-testid="font-scale-switcher"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setScale(opt.value)}
          className={cn(
            "px-2 py-1 rounded transition-colors font-bold leading-none",
            opt.size,
            scale === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
          aria-pressed={scale === opt.value}
          title={`${opt.label}文字`}
          data-testid={`btn-font-scale-${opt.value}`}
        >
          A
          {showLabel && <span className="ml-1 text-xs">{opt.label}</span>}
        </button>
      ))}
    </div>
  );
}
