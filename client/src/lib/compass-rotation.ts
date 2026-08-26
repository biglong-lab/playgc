// 🧭 方位角旋轉工具 — 明確區分兩種座標系，避免再次混用
//    （CHITO c92e32dc 羅盤 13 修 / 2a1bb97a 地圖方向相反）
//
// ① 裝置座標系 — 羅盤 UI：螢幕上方 = 裝置前方
//    刻度環 rotate(-heading)；指向目標的指標 rotate(bearing − heading)
//    → 玩家轉手機，箭頭跟著轉，世界中的北不動。
//
// ② 世界座標系 — Leaflet 地圖：地圖永遠北朝上、不隨裝置旋轉
//    地圖上任何箭頭都必須用「絕對方位」：
//      指向目標 rotate(bearing)、表示裝置朝向 rotate(heading)
//    ⚠️ 在地圖上套用 ①（減 heading）會讓箭頭與地圖上的目標位置差一個
//       heading 角度 — 這正是「地圖方向與實際相反」的成因。

/** 角度正規化到 [0, 360) */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * 裝置座標系角度（羅盤用）：目標相對裝置前方的夾角。
 * 無羅盤（桌機／未授權）時 fallback 回絕對方位，維持可用性。
 */
export function deviceRelativeAngle(
  targetBearing: number,
  heading: number | null,
): number {
  if (heading === null) return normalizeDeg(targetBearing);
  return normalizeDeg(targetBearing - heading);
}

/**
 * 世界座標系角度（北朝上地圖用）：直接用絕對方位，不減 heading。
 * 傳入 null（無羅盤）回 null，呼叫端據此不畫朝向箭頭。
 */
export function worldAbsoluteAngle(bearing: number | null): number | null {
  if (bearing === null) return null;
  return normalizeDeg(bearing);
}
