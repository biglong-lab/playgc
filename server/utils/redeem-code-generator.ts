// 兌換碼產生工具
// 格式: JCQ-XXXX-XXXX（排除易混淆字元 0/O/1/I）

const CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // 32 字元

/** 產生隨機碼段 */
function randomSegment(length: number): string {
  let result = "";
  const charLen = CHARSET.length;
  for (let i = 0; i < length; i++) {
    result += CHARSET[Math.floor(Math.random() * charLen)];
  }
  return result;
}

/** 產生單一兌換碼（格式: JCQ-XXXX-XXXX） */
export function generateRedeemCode(): string {
  return `JCQ-${randomSegment(4)}-${randomSegment(4)}`;
}

/** 批次產生兌換碼（確保不重複） */
export function generateRedeemCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(generateRedeemCode());
  }
  return Array.from(codes);
}

/** 驗證兌換碼格式是否正確 */
export function isValidCodeFormat(code: string): boolean {
  return /^JCQ-[23456789A-HJ-NP-Z]{4}-[23456789A-HJ-NP-Z]{4}$/.test(
    code.toUpperCase()
  );
}
