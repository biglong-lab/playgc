// 測試 extractScanCode：管理員 QRCodeGenerator 產的 JSON QR 要能被正確解開
import { describe, it, expect } from "vitest";
import { extractScanCode } from "../useQrScanner";

describe("extractScanCode", () => {
  it("純字串直接回傳（trim）", () => {
    expect(extractScanCode("FAKEVILLAGE-CHECKIN")).toBe("FAKEVILLAGE-CHECKIN");
    expect(extractScanCode("  TEMPLE-001  ")).toBe("TEMPLE-001");
  });

  it("手動輸入空字串回傳空字串", () => {
    expect(extractScanCode("")).toBe("");
    expect(extractScanCode("   ")).toBe("");
  });

  it("管理員 JSON QR → 抽出 qrCodeId", () => {
    const raw = JSON.stringify({
      type: "game_qr",
      gameId: "abc-123",
      pageId: "def-456",
      qrCodeId: "FAKEVILLAGE-CHECKIN",
      timestamp: 1739891234567,
    });
    expect(extractScanCode(raw)).toBe("FAKEVILLAGE-CHECKIN");
  });

  it("JSON 內 qrCodeId 前後空白應被 trim", () => {
    const raw = JSON.stringify({
      type: "game_qr",
      qrCodeId: "  STATION-001  ",
    });
    expect(extractScanCode(raw)).toBe("STATION-001");
  });

  it("type 不是 game_qr → 視為純字串回傳（即使開頭是 {）", () => {
    const raw = JSON.stringify({ type: "unknown", qrCodeId: "X" });
    expect(extractScanCode(raw)).toBe(raw);
  });

  it("JSON 缺少 qrCodeId → 視為純字串回傳", () => {
    const raw = JSON.stringify({ type: "game_qr", gameId: "abc" });
    expect(extractScanCode(raw)).toBe(raw);
  });

  it("qrCodeId 不是字串 → 視為純字串回傳", () => {
    const raw = JSON.stringify({ type: "game_qr", qrCodeId: 123 });
    expect(extractScanCode(raw)).toBe(raw);
  });

  it("開頭是 { 但不是合法 JSON → 視為純字串回傳", () => {
    const raw = "{not json";
    expect(extractScanCode(raw)).toBe("{not json");
  });

  it("JSON 內 payload 為 null → 視為純字串回傳", () => {
    expect(extractScanCode("null")).toBe("null");
  });

  it("URL 格式不受影響（舊遊戲入口 QR）", () => {
    const url = "https://game.homi.cc/g/abc";
    expect(extractScanCode(url)).toBe(url);
  });
});
