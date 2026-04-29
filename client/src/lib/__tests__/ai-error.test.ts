// 🤖 AI 錯誤訊息分類器單元測試
import { describe, it, expect } from "vitest";
import { formatAiError, isFallbackResult } from "../ai-error";

describe("formatAiError", () => {
  describe("HTTP status codes", () => {
    it("502 → 「AI 服務暫時忙碌」", () => {
      const r = formatAiError(new Error("502: Bad Gateway"));
      expect(r.title).toContain("AI 服務暫時忙碌");
      expect(r.category).toBe("network");
      expect(r.shouldDeductAttempt).toBe(false);
    });

    it("504 Gateway Timeout → 「AI 服務暫時忙碌」", () => {
      const r = formatAiError(new Error("504: Gateway Timeout"));
      expect(r.title).toContain("AI 服務暫時忙碌");
    });

    it("500 Server Error → 「AI 服務發生錯誤」", () => {
      const r = formatAiError(new Error("500: Internal Server Error"));
      expect(r.title).toContain("AI 服務發生錯誤");
    });

    it("429 Too Many Requests → 「AI 呼叫過於頻繁」", () => {
      const r = formatAiError(new Error("429: Rate Limit"));
      expect(r.title).toContain("AI 呼叫過於頻繁");
      expect(r.category).toBe("rate-limited");
    });

    it("503 + AI 服務未設定 → 「AI 服務尚未啟用」", () => {
      const r = formatAiError(new Error("503: AI 服務未設定"));
      expect(r.title).toContain("AI 服務尚未啟用");
      expect(r.category).toBe("not-configured");
      expect(r.description).toContain("Gemini API key");
    });

    it("503 + AI 功能已停用 → 「AI 功能已停用」", () => {
      const r = formatAiError(new Error("503: 此場域的 AI 功能已停用"));
      expect(r.title).toContain("AI 功能已停用");
      expect(r.category).toBe("ai-disabled");
    });

    it("503 + 預覽模式 → 「預覽模式不支援 AI」", () => {
      const r = formatAiError(new Error("503: 預覽模式不支援 AI"));
      expect(r.title).toContain("預覽模式");
      expect(r.category).toBe("preview-unsupported");
    });
  });

  describe("特殊錯誤分類", () => {
    it("PERMISSION_DENIED → 「AI 帳號未啟用」", () => {
      const r = formatAiError(new Error("PERMISSION_DENIED: billing required"));
      expect(r.title).toContain("AI 帳號未啟用");
      expect(r.category).toBe("billing-required");
    });

    it("QUOTA_EXCEEDED → 「AI 用量已達上限」", () => {
      const r = formatAiError(new Error("QUOTA_EXCEEDED: monthly quota"));
      expect(r.title).toContain("AI 用量已達上限");
      expect(r.category).toBe("quota-exceeded");
    });

    it("TIMEOUT → 「AI 處理超時」", () => {
      const r = formatAiError(new Error("AI_TIMEOUT: 處理超時"));
      expect(r.title).toContain("處理超時");
      expect(r.category).toBe("network");
    });
  });

  describe("HTML 截斷（防 nginx 502 整段 HTML）", () => {
    it("含 <html> 的訊息會被清理", () => {
      const htmlErr = new Error(
        "502: <html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>",
      );
      const r = formatAiError(htmlErr);
      // 識別為 502，不會把整段 HTML 顯示給玩家
      expect(r.title).toContain("AI 服務暫時忙碌");
      // 內部 errMsg 已經清掉 HTML tags（<>）
      expect(r.description).not.toContain("<html");
      expect(r.description).not.toContain("<body");
    });
  });

  describe("Unknown / 預設", () => {
    it("未知錯誤 → 「AI 服務暫時無法使用」", () => {
      const r = formatAiError(new Error("Some random error"));
      expect(r.title).toContain("AI 服務暫時無法使用");
    });

    it("非 Error 物件也能處理", () => {
      const r = formatAiError("string error");
      expect(r.title).toBeTruthy();
      expect(r.shouldDeductAttempt).toBe(false);
    });

    it("null / undefined", () => {
      expect(formatAiError(null).title).toBeTruthy();
      expect(formatAiError(undefined).title).toBeTruthy();
    });

    it("Network / fetch 相關歸類為 network", () => {
      const r = formatAiError(new Error("Network request failed"));
      expect(r.category).toBe("network");
    });
  });

  describe("shouldDeductAttempt", () => {
    it("所有錯誤都不該扣玩家次數（伺服器問題）", () => {
      const errors = [
        new Error("502"),
        new Error("503: AI 服務未設定"),
        new Error("429"),
        new Error("PERMISSION_DENIED"),
        new Error("Random"),
      ];
      for (const err of errors) {
        const r = formatAiError(err);
        expect(r.shouldDeductAttempt).toBe(false);
      }
    });
  });
});

describe("isFallbackResult", () => {
  it("回傳 fallback: true 的物件 → true", () => {
    expect(isFallbackResult({ fallback: true, score: 0 })).toBe(true);
  });

  it("回傳 fallback: false → false", () => {
    expect(isFallbackResult({ fallback: false, score: 50 })).toBe(false);
  });

  it("沒 fallback 屬性 → false", () => {
    expect(isFallbackResult({ score: 50 })).toBe(false);
  });

  it("null / undefined / 字串 → false", () => {
    expect(isFallbackResult(null)).toBe(false);
    expect(isFallbackResult(undefined)).toBe(false);
    expect(isFallbackResult("fallback")).toBe(false);
  });
});
