// 🕐 對戰時段 → 人類可讀時間距離
//
// 用於 BattleHome、BattleSlotDetail 等地方顯示「下一場對戰還有多久」
//
// 設計：
//   - 純函式（無副作用），方便測試
//   - 接受 slotDate (YYYY-MM-DD) + startTime (HH:MM:SS) 字串格式（match server 回傳）
//   - 接受可選的 endTime，用來判斷「對戰中」vs「已結束」
//   - 內建 now 參數方便測試（預設用真實時間）

export interface TimeUntilOptions {
  /** 用來測試時注入固定的「現在時間」*/
  now?: Date;
}

/**
 * 把 slotDate + startTime 算出距離當下的人類可讀文字
 *
 * 範例輸出：
 *   - 「⚡ 5 分鐘後」（< 1 小時）
 *   - 「今天 14:00」（同一天）
 *   - 「明天 09:00」（隔天）
 *   - 「3 天後 19:00」（< 7 天）
 *   - 「04-26 14:00」（>= 7 天）
 *   - 「對戰中 · 14:00」（已開始但還沒結束）
 *   - 「已結束」（已過 endTime）
 *   - ""（空字串）（缺資料）
 */
export function formatTimeUntil(
  slotDate?: string | null,
  startTime?: string | null,
  endTime?: string | null,
  opts: TimeUntilOptions = {},
): string {
  if (!slotDate) return "";
  try {
    const time = startTime?.slice(0, 5) ?? "00:00";
    const slotStart = new Date(`${slotDate}T${time}:00`);
    if (Number.isNaN(slotStart.getTime())) return slotDate; // 解析失敗 fallback

    const slotEnd = endTime ? new Date(`${slotDate}T${endTime.slice(0, 5)}:00`) : null;
    const now = opts.now ?? new Date();

    if (slotEnd && now > slotEnd) return "已結束";
    if (now > slotStart) return `對戰中 · ${time}`;

    const diffMs = slotStart.getTime() - now.getTime();
    if (diffMs < 60 * 60 * 1000) {
      // < 1 小時
      const diffMins = Math.max(1, Math.round(diffMs / (1000 * 60)));
      return `⚡ ${diffMins} 分鐘後`;
    }

    // 用「日曆日」差（不是 24h 差）來決定 今天/明天
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const slotDay = new Date(slotStart.getFullYear(), slotStart.getMonth(), slotStart.getDate());
    const diffDays = Math.round((slotDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return `今天 ${time}`;
    if (diffDays === 1) return `明天 ${time}`;
    if (diffDays > 0 && diffDays < 7) return `${diffDays} 天後 ${time}`;
    return `${slotDate.slice(5)} ${time}`;
  } catch {
    return slotDate;
  }
}

/**
 * 判斷時段是否「即將開戰」（30 分鐘內）— 適合做 highlight 動畫
 */
export function isImminentSlot(
  slotDate?: string | null,
  startTime?: string | null,
  opts: TimeUntilOptions = {},
): boolean {
  if (!slotDate || !startTime) return false;
  try {
    const slotStart = new Date(`${slotDate}T${startTime.slice(0, 5)}:00`);
    if (Number.isNaN(slotStart.getTime())) return false;
    const now = opts.now ?? new Date();
    const diffMs = slotStart.getTime() - now.getTime();
    return diffMs > 0 && diffMs < 30 * 60 * 1000;
  } catch {
    return false;
  }
}
