// 遊戲驗證共用 helper
// 統一文字正規化、QR/NFC/手動輸入 payload 抽取、iOS autocomplete 關閉 props

/**
 * 正規化答案字串：
 * - trim
 * - 全形 ASCII 轉半形（！ → !、Ａ → A、１ → 1）
 * - 選擇性轉小寫（caseSensitive=false 時）
 */
export function normalizeAnswer(s: string, caseSensitive = false): string {
  let t = (s ?? "").trim();
  // 全形 ASCII (U+FF01–U+FF5E) → 半形 (U+0021–U+007E)
  t = t.replace(/[\uFF01-\uFF5E]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0),
  );
  // 全形空格 → 半形空格
  t = t.replace(/\u3000/g, " ");
  if (!caseSensitive) t = t.toLowerCase();
  return t;
}

/**
 * 從原始字串抽答案文字（相容 QR 掃描的 JSON payload）。
 * 若 raw 是 `{"type":"game_qr","qrCodeId":"XXX"}` → 回傳 qrCodeId。
 * 否則回傳 trim 後原字串。
 */
export function extractAnswerText(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { type?: unknown; qrCodeId?: unknown };
      if (parsed && parsed.type === "game_qr" && typeof parsed.qrCodeId === "string") {
        return parsed.qrCodeId.trim();
      }
    } catch {
      // 非合法 JSON，維持原字串
    }
  }
  return trimmed;
}

/**
 * iOS 關閉自動大寫/校正/補字所需的 Input props。
 * 給密碼、驗證碼等需要精確輸入的欄位使用。
 */
export const NO_AUTO_INPUT_PROPS = {
  autoComplete: "off" as const,
  autoCapitalize: "off" as const,
  autoCorrect: "off" as const,
  spellCheck: false,
};
