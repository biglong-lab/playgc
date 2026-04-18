// gameVerification helper 單元測試
import { describe, it, expect } from "vitest";
import { normalizeAnswer, extractAnswerText, NO_AUTO_INPUT_PROPS } from "../gameVerification";

describe("normalizeAnswer", () => {
  it("trim 前後空白", () => {
    expect(normalizeAnswer("  hello  ")).toBe("hello");
    expect(normalizeAnswer("\t\n答案\n ")).toBe("答案");
  });

  it("預設 caseSensitive=false 轉小寫", () => {
    expect(normalizeAnswer("ABC")).toBe("abc");
    expect(normalizeAnswer("MixedCase")).toBe("mixedcase");
  });

  it("caseSensitive=true 保留大小寫", () => {
    expect(normalizeAnswer("ABC", true)).toBe("ABC");
    expect(normalizeAnswer("Mixed", true)).toBe("Mixed");
  });

  it("全形英數字轉半形", () => {
    expect(normalizeAnswer("ＡＢＣ")).toBe("abc");
    expect(normalizeAnswer("１２３")).toBe("123");
  });

  it("全形空格轉半形空格", () => {
    expect(normalizeAnswer("hello\u3000world")).toBe("hello world");
  });

  it("全形標點也轉半形", () => {
    expect(normalizeAnswer("Ｈｅｌｌｏ！")).toBe("hello!");
  });

  it("null / undefined 安全處理", () => {
    expect(normalizeAnswer(null as any)).toBe("");
    expect(normalizeAnswer(undefined as any)).toBe("");
  });

  it("中文不受影響（已是 BMP 中文）", () => {
    expect(normalizeAnswer("你好")).toBe("你好");
    expect(normalizeAnswer("  台灣  ")).toBe("台灣");
  });
});

describe("extractAnswerText", () => {
  it("純字串直接回傳", () => {
    expect(extractAnswerText("ABC123")).toBe("ABC123");
    expect(extractAnswerText("  TEMPLE-001  ")).toBe("TEMPLE-001");
  });

  it("空字串安全處理", () => {
    expect(extractAnswerText("")).toBe("");
    expect(extractAnswerText(null as any)).toBe("");
  });

  it("QR JSON payload → qrCodeId", () => {
    const json = JSON.stringify({ type: "game_qr", qrCodeId: "X-001" });
    expect(extractAnswerText(json)).toBe("X-001");
  });

  it("QR JSON 的 qrCodeId 前後空白也 trim", () => {
    const json = JSON.stringify({ type: "game_qr", qrCodeId: "  X-001  " });
    expect(extractAnswerText(json)).toBe("X-001");
  });

  it("type 非 game_qr 視為純字串", () => {
    const json = JSON.stringify({ type: "other", qrCodeId: "X" });
    expect(extractAnswerText(json)).toBe(json);
  });

  it("開頭是 { 但非合法 JSON 視為純字串", () => {
    expect(extractAnswerText("{broken")).toBe("{broken");
  });
});

describe("NO_AUTO_INPUT_PROPS", () => {
  it("包含所有 iOS 關閉自動行為的欄位", () => {
    expect(NO_AUTO_INPUT_PROPS.autoComplete).toBe("off");
    expect(NO_AUTO_INPUT_PROPS.autoCapitalize).toBe("off");
    expect(NO_AUTO_INPUT_PROPS.autoCorrect).toBe("off");
    expect(NO_AUTO_INPUT_PROPS.spellCheck).toBe(false);
  });
});
