// 📸 photo-save.ts 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isMobileWithShare,
  getSaveToastMessage,
  savePhotoToAlbum,
} from "../photo-save";

describe("photo-save", () => {
  describe("isMobileWithShare", () => {
    afterEach(() => {
      // 清除 stubs
      vi.unstubAllGlobals();
    });

    it("Desktop Chrome 沒有 navigator.share → false", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        // 沒有 share
      });
      expect(isMobileWithShare()).toBe(false);
    });

    it("iPhone Safari 有 navigator.share → true", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        share: () => Promise.resolve(),
        maxTouchPoints: 5,
      });
      expect(isMobileWithShare()).toBe(true);
    });

    it("Android Chrome 有 navigator.share → true", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36",
        share: () => Promise.resolve(),
        maxTouchPoints: 5,
      });
      expect(isMobileWithShare()).toBe(true);
    });

    it("iPad Safari (UA 隱藏)→ 用 maxTouchPoints 判斷", () => {
      vi.stubGlobal("navigator", {
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
        share: () => Promise.resolve(),
        maxTouchPoints: 5,
      });
      expect(isMobileWithShare()).toBe(true);
    });

    it("沒有 navigator → false（SSR safe）", () => {
      vi.stubGlobal("navigator", undefined);
      expect(isMobileWithShare()).toBe(false);
    });
  });

  describe("getSaveToastMessage", () => {
    it("使用者取消 → 「已取消」訊息", () => {
      const msg = getSaveToastMessage({
        success: false,
        method: "none",
        errorReason: "abort",
      });
      expect(msg.title).toBe("已取消");
    });

    it("失敗 → destructive 訊息", () => {
      const msg = getSaveToastMessage({
        success: false,
        method: "none",
        errorReason: "fetch-failed",
      });
      expect(msg.title).toBe("保存失敗");
      expect(msg.variant).toBe("destructive");
    });

    it("share-with-files → 引導點分享 sheet", () => {
      const msg = getSaveToastMessage({
        success: true,
        method: "share-with-files",
      });
      expect(msg.title).toContain("分享");
      expect(msg.description).toContain("儲存");
    });

    it("download → 「下載完成」訊息", () => {
      const msg = getSaveToastMessage({
        success: true,
        method: "download",
      });
      expect(msg.title).toContain("下載完成");
    });

    it("share-url-only → 提示桌機下載", () => {
      const msg = getSaveToastMessage({
        success: true,
        method: "share-url-only",
      });
      expect(msg.title).toContain("分享");
      expect(msg.description).toContain("桌機");
    });
  });

  describe("savePhotoToAlbum (integration with mocked navigator)", () => {
    let originalCreateElement: typeof document.createElement;
    let mockClick: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Mock fetch
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          blob: () =>
            Promise.resolve(new Blob(["fake"], { type: "image/jpeg" })),
        }),
      );
      // Mock URL
      vi.stubGlobal("URL", {
        createObjectURL: vi.fn(() => "blob:fake"),
        revokeObjectURL: vi.fn(),
      });
      // Mock document.createElement (for <a download>)
      mockClick = vi.fn();
      originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag === "a") {
          const anchor = originalCreateElement("a");
          anchor.click = mockClick;
          return anchor;
        }
        return originalCreateElement(tag);
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("forceMethod=download → 觸發 <a download>", async () => {
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0",
        // 沒 share
      });
      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        forceMethod: "download",
      });
      expect(result.success).toBe(true);
      expect(result.method).toBe("download");
      expect(mockClick).toHaveBeenCalled();
    });

    it("forceMethod=share + canShare files → 走 Web Share files", async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone)",
        share: shareMock,
        canShare: () => true,
      });
      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        title: "測試",
        forceMethod: "share",
      });
      expect(result.success).toBe(true);
      expect(result.method).toBe("share-with-files");
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "測試",
          files: expect.any(Array),
        }),
      );
    });

    it("share AbortError → 視為使用者取消（不算失敗）", async () => {
      const abortErr = new DOMException("aborted", "AbortError");
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone)",
        share: vi.fn().mockRejectedValue(abortErr),
        canShare: () => true,
      });
      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        forceMethod: "share",
      });
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("abort");
    });

    it("share 失敗（非 abort）→ fallback download", async () => {
      const otherErr = new Error("other error");
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0 (iPhone)",
        share: vi.fn().mockRejectedValue(otherErr),
        canShare: () => true,
      });
      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        forceMethod: "share",
      });
      expect(result.success).toBe(true);
      expect(result.method).toBe("download");
    });

    it("fetch 失敗 → fetch-failed errorReason", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
        }),
      );
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0",
      });
      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        forceMethod: "download",
      });
      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("fetch-failed");
    });
  });
});
