// 🎨 通用封面 Fallback — 沒上傳封面時用名字 hash 生成漂亮漸層 + 大字
//
// 用途：遊戲沒封面、場域沒封面 → 不再用單調的 primary/20 漸層 + icon，
//      改用根據 name hash 決定的動態彩色漸層 + 首字大字，每個遊戲/場域長得不一樣。
//
// 特色：
//   - 名字 hash → HSL 色相，同名字永遠長一樣
//   - 多色漸層 + 模糊光斑 → 有層次不單調
//   - 大字 drop-shadow → 辨識度高
//   - 可傳 badge 顯示模式 / 場域代碼等
import type { ReactNode } from "react";

interface GenericCoverFallbackProps {
  /** 用於 hash 生成色彩 + 取首字 */
  readonly name: string;
  /** 可選的右下角 badge（顯示模式、代碼等） */
  readonly badge?: { icon?: ReactNode; label: string };
  /** 關閉底部漸層 overlay（若外層 card 已有 overlay 處理） */
  readonly hideOverlay?: boolean;
  /** 自訂 class name */
  readonly className?: string;
}

/** 快速字串 hash → 0~359（HSL hue） */
function nameToHue(name: string): number {
  let h = 0;
  for (const c of name) {
    h = (h * 31 + c.charCodeAt(0)) | 0;
  }
  return Math.abs(h) % 360;
}

/** 取 name 第一個有意義字元（跳過空白 / emoji 前綴） */
function firstDisplayChar(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // 取 Array[0] 能正確處理 surrogate pair（emoji）
  return Array.from(trimmed)[0] ?? "?";
}

export default function GenericCoverFallback({
  name,
  badge,
  hideOverlay = false,
  className = "",
}: GenericCoverFallbackProps) {
  const hue = nameToHue(name);
  const hue2 = (hue + 50) % 360;
  const hue3 = (hue + 160) % 360;
  const firstChar = firstDisplayChar(name);

  return (
    <div
      className={`w-full h-full flex items-center justify-center relative overflow-hidden ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue}, 55%, 32%) 0%, hsl(${hue2}, 55%, 20%) 100%)`,
      }}
      aria-hidden="true"
    >
      {/* 背景裝飾光斑（彩色模糊圓） */}
      <div
        className="absolute -top-1/4 -right-1/4 w-2/3 h-2/3 rounded-full opacity-35 blur-3xl pointer-events-none"
        style={{ backgroundColor: `hsl(${hue}, 75%, 60%)` }}
      />
      <div
        className="absolute -bottom-1/4 -left-1/4 w-2/3 h-2/3 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ backgroundColor: `hsl(${hue3}, 70%, 55%)` }}
      />

      {/* 大字 */}
      <div
        className="relative text-white/95 font-display font-black select-none drop-shadow-xl"
        style={{
          fontSize: "clamp(3rem, 18vw, 6rem)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {firstChar}
      </div>

      {/* 底部漸層（讓卡片下方 title/desc 更清晰） */}
      {!hideOverlay && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />
      )}

      {/* Badge（右下角） */}
      {badge && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full text-xs text-white/95 font-medium pointer-events-none">
          {badge.icon}
          <span>{badge.label}</span>
        </div>
      )}
    </div>
  );
}
