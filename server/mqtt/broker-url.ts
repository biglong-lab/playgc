// 🔌 broker URL 正規化 —— 純函式，刻意獨立於 config.ts
//
// config.ts 會 import db（讀後台設定），把這支純函式留在那裡會讓
// 單元測試被迫需要 DATABASE_URL。這段邏輯是 2026-08-09 生產靜默
// 重連迴圈的根因所在，必須能被無 DB 的守門測試覆蓋。

/**
 * 補上 broker URL 的 scheme。使用者常只填 host:port（如 mqttgo.io:1883），
 * mqtt.js 沒有 scheme 會連錯 → connack timeout。
 *
 * 🐛 2026-08-09 修（生產靜默重連迴圈的真根因）：
 *   後台填的是 HiveMQ Cloud 的 `host:8884/mqtt`，舊版有兩個錯：
 *   ① port 比對用 `:(\d+)$` 要求 port 在字串結尾 —— 有 `/mqtt` 路徑就比不到，
 *      退回預設 1883 → 補成 **明文 mqtt://** 打 TLS 埠
 *   ② 就算比到 8884 也補成 mqtts —— 8884 是 **WebSocket over TLS**（wss），
 *      不是原生 MQTT/TLS
 *   結果：明文 TCP 打 wss 埠 → 永遠收不到 CONNACK → 30s 逾時 → close（無 error）
 *   → 靜默重連。實測三種 URL 已驗證：mqtt://:8884/mqtt 靜默失敗、
 *   wss://:8884/mqtt 與 mqtts://:8883 皆連線成功。
 *
 * 對照表（HiveMQ Cloud 慣例，其他 broker 亦通用）：
 *   1883 → mqtt（明文）｜8883 → mqtts（原生 MQTT/TLS）
 *   8884 / 帶路徑 → wss（WebSocket/TLS）｜8000/8080 → ws
 */
export function normalizeBrokerUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  if (/^(mqtts?|wss?|tcp):\/\//i.test(u)) return u;

  // 先切掉路徑（/mqtt）與查詢字串，才能正確取到 port
  const authority = u.split(/[/?#]/, 1)[0];
  const m = authority.match(/:(\d+)$/);
  const port = m ? parseInt(m[1], 10) : 1883;
  const hasPath = u.length > authority.length;

  // 已知埠優先判定（明確 > 推測），未知埠才用「有路徑 = WebSocket 端點」推測
  switch (port) {
    case 8884:
      return `wss://${u}`;
    case 8883:
      return `mqtts://${u}`;
    case 8000:
    case 8080:
      return `ws://${u}`;
    case 1883:
      return `mqtt://${u}`;
    default:
      return `${hasPath ? "wss" : "mqtt"}://${u}`;
  }
}
