// 📸 photo-save.ts 單元測試
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isMobileWithShare,
  getSaveToastMessage,
  savePhotoToAlbum,
  detectExtension,
} from "../photo-save";

describe("photo-save", () => {
  describe("detectExtension", () => {
    it("空值 → 預設 jpg", () => {
      expect(detectExtension("")).toBe("jpg");
    });

    it("Cloudinary GIF → gif", () => {
      expect(
        detectExtension(
          "https://res.cloudinary.com/x/image/upload/v1/burst.gif",
        ),
      ).toBe("gif");
    });

    it("Cloudinary JPG → jpg", () => {
      expect(
        detectExtension(
          "https://res.cloudinary.com/x/image/upload/v1/photo.jpg",
        ),
      ).toBe("jpg");
    });

    it("JPEG → jpg（normalize）", () => {
      expect(detectExtension("https://example.com/photo.jpeg")).toBe("jpg");
    });

    it("PNG / WebP / MP4", () => {
      expect(detectExtension("https://x.com/a.png")).toBe("png");
      expect(detectExtension("https://x.com/a.webp")).toBe("webp");
      expect(detectExtension("https://x.com/a.mp4")).toBe("mp4");
    });

    it("含 query string 仍能偵測", () => {
      expect(detectExtension("https://x.com/a.gif?v=123")).toBe("gif");
      expect(detectExtension("https://x.com/a.jpg?t=now")).toBe("jpg");
    });

    it("data URL 從 mime type 推副檔名", () => {
      expect(detectExtension("data:image/gif;base64,xxx")).toBe("gif");
      expect(detectExtension("data:image/png;base64,xxx")).toBe("png");
      expect(detectExtension("data:image/jpeg;base64,xxx")).toBe("jpg");
    });

    it("無副檔名 URL → 預設 jpg", () => {
      expect(detectExtension("https://res.cloudinary.com/x/abc")).toBe("jpg");
    });

    it("大寫副檔名也支援", () => {
      expect(detectExtension("https://x.com/A.GIF")).toBe("gif");
    });
  });

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

    it("share-url-only → 提示在分享頁長按存圖", () => {
      const msg = getSaveToastMessage({
        success: true,
        method: "share-url-only",
      });
      expect(msg.title).toContain("分享");
      expect(msg.description).toContain("長按");
    });

    it("open-tab → 提示長按存圖", () => {
      const msg = getSaveToastMessage({
        success: true,
        method: "open-tab",
      });
      expect(msg.title).toContain("已開啟");
      expect(msg.description).toContain("長按");
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

    it("share 失敗（非 abort）→ fallback share-url-only 或 open-tab", async () => {
      const otherErr = new Error("other error");
      // stub window.open
      const openMock = vi.fn();
      vi.stubGlobal("window", { ...window, open: openMock });

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
      // 多層 fallback：share files 失敗 → share URL 失敗 → open new tab
      expect(result.success).toBe(true);
      // 任一個 fallback 都算成功
      expect(["share-url-only", "open-tab", "download"]).toContain(
        result.method,
      );
    });

    it("forceMethod=download fetch 失敗 → 仍會嘗試 a href fallback", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("CORS")),
      );
      vi.stubGlobal("navigator", {
        userAgent: "Mozilla/5.0",
      });
      // mock Image 也失敗
      const ImageMock = vi.fn(() => ({
        set src(_v: string) {
          setTimeout(() => this.onerror?.(), 0);
        },
        onload: null,
        onerror: null,
      }));
      vi.stubGlobal("Image", ImageMock);

      const result = await savePhotoToAlbum({
        url: "https://example.com/photo.jpg",
        filename: "test",
        forceMethod: "download",
      });
      // a href fallback 永遠成功（不 fetch）
      expect(result.success).toBe(true);
      expect(result.method).toBe("download");
    });
  });
});
