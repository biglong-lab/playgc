// 🎯 cover-position — 封面圖片焦點位置工具
//
// 用於 EditableCoverImage（場域 hero banner + 遊戲卡封面）
// 將「拖拉座標」轉成 CSS object-position / background-position 字串
//
// 設計原則：
// - 純函式（無副作用、可測試）
// - 防呆：clamp 0-100、解析失敗回 default
// - 安全：格式必須是 "X% Y%"（後端 zod 也限制這格式）

/** 預設焦點位置（置中）*/
export const DEFAULT_POSITION = "50% 50%";

/**
 * 把 X/Y 浮點數（0-100 區間，可超出會被 clamp）格式化成 "X.X% Y.Y%"
 *
 * @example
 *   formatPosition(50, 50)   // "50.0% 50.0%"
 *   formatPosition(-10, 200) // "0.0% 100.0%"（clamp）
 *   formatPosition(33.45, 67.89) // "33.5% 67.9%"
 */
export function formatPosition(x: number, y: number): string {
  // 處理 NaN / Infinity（保險：fallback 到中央）
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return DEFAULT_POSITION;
  }
  const cx = Math.max(0, Math.min(100, x));
  const cy = Math.max(0, Math.min(100, y));
  return `${cx.toFixed(1)}% ${cy.toFixed(1)}%`;
}

/**
 * 解析 "X% Y%" → { x, y }
 * 解析失敗（格式錯 / 空字串 / undefined）→ 回中央 50/50
 *
 * @example
 *   parsePosition("30% 70%")     // { x: 30, y: 70 }
 *   parsePosition("33.5% 67.9%") // { x: 33.5, y: 67.9 }
 *   parsePosition(undefined)     // { x: 50, y: 50 }
 *   parsePosition("invalid")     // { x: 50, y: 50 }
 */
export function parsePosition(pos: string | undefined | null): {
  x: number;
  y: number;
} {
  if (!pos || typeof pos !== "string") return { x: 50, y: 50 };
  const match = pos.match(/(\d+(?:\.\d+)?)\s*%\s+(\d+(?:\.\d+)?)\s*%/);
  if (!match) return { x: 50, y: 50 };
  const x = parseFloat(match[1]);
  const y = parseFloat(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 50, y: 50 };
  // clamp 防止格式合法但值不合理（例如 "9999% 0%"）
  return {
    x: Math.max(0, Math.min(100, x)),
    y: Math.max(0, Math.min(100, y)),
  };
}

/**
 * 由滑鼠/觸控事件 → 計算焦點位置（容器內百分比）
 *
 * @param clientX 事件的 clientX
 * @param clientY 事件的 clientY
 * @param rect 容器的 getBoundingClientRect()
 * @returns 格式化後的 "X.X% Y.Y%"
 */
export function positionFromPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): string {
  if (rect.width <= 0 || rect.height <= 0) return DEFAULT_POSITION;
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return formatPosition(x, y);
}
