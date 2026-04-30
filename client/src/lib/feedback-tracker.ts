// 📊 P11-8: 追蹤最近顯示的變體（給 FeedbackButtons 用）
//
// 設計：
//   - 玩家元件呼叫 pickVariantWithIndex 後，把結果記錄到 trackerState
//   - GamePageRenderer 訂閱 state 變化，在 toast 旁邊顯示 FeedbackButtons
//   - 不需修改既有 5 個玩家元件的 toast 邏輯（最小擴散）
//
// 用法（玩家元件側）：
//   const r = pickVariantWithIndex(pool, "success", fallback);
//   trackVariantShown({ pageId, variantKey: "success", variantIndex: r.index, variantText: r.text });
//   toast({ title: r.text });
//
// 用法（GamePageRenderer 側）：
//   const lastShown = useLastShownVariant();
//   {lastShown && <FeedbackButtons {...lastShown} />}
import { useEffect, useState } from "react";

export interface ShownVariant {
  pageId: string;
  variantKey: "success" | "fail" | "nearMiss" | "hint";
  variantIndex: number;
  variantText: string;
  shownAt: number;
}

type Listener = (variant: ShownVariant | null) => void;

const listeners = new Set<Listener>();
let currentVariant: ShownVariant | null = null;

/** 玩家元件呼叫，告訴 tracker 顯示了某個變體 */
export function trackVariantShown(
  variant: Omit<ShownVariant, "shownAt"> & { shownAt?: number },
): void {
  // 從 pool 抽到（index >= 0）才追蹤；fallback 不算
  if (variant.variantIndex < 0) return;
  currentVariant = { ...variant, shownAt: variant.shownAt ?? Date.now() };
  listeners.forEach((fn) => fn(currentVariant));

  // 60s 後自動清除（避免按鈕長期顯示）
  setTimeout(() => {
    if (currentVariant && currentVariant.shownAt === variant.shownAt) {
      currentVariant = null;
      listeners.forEach((fn) => fn(null));
    }
  }, 60_000);
}

/** 清除（玩家進到下一頁時呼叫，或手動隱藏） */
export function clearShownVariant(): void {
  currentVariant = null;
  listeners.forEach((fn) => fn(null));
}

/** Hook：訂閱最近一次顯示的變體 */
export function useLastShownVariant(): ShownVariant | null {
  const [variant, setVariant] = useState<ShownVariant | null>(currentVariant);

  useEffect(() => {
    listeners.add(setVariant);
    return () => {
      listeners.delete(setVariant);
    };
  }, []);

  return variant;
}
