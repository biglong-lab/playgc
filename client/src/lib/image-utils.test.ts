import { describe, it, expect } from "vitest";
import { isCloudinaryUrl, addCloudinaryTransform, getOptimizedImageUrl } from "./image-utils";

describe("isCloudinaryUrl", () => {
  it("辨識 Cloudinary URL", () => {
    expect(isCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/v1/sample.jpg")).toBe(true);
  });

  it("非 Cloudinary URL 回傳 false", () => {
    expect(isCloudinaryUrl("https://example.com/image.jpg")).toBe(false);
  });

  it("缺少 /upload/ 回傳 false", () => {
    expect(isCloudinaryUrl("https://res.cloudinary.com/demo/image/v1/sample.jpg")).toBe(false);
  });
});

describe("addCloudinaryTransform", () => {
  it("在 /upload/ 後插入變換參數", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg";
    const result = addCloudinaryTransform(url, { width: 400, quality: "auto" });
    expect(result).toBe("https://res.cloudinary.com/demo/image/upload/w_400,q_auto/v1/sample.jpg");
  });

  it("完整參數組合正確", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg";
    const result = addCloudinaryTransform(url, {
      width: 800, height: 400, quality: "auto", format: "auto", crop: "fill",
    });
    expect(result).toBe("https://res.cloudinary.com/demo/image/upload/w_800,h_400,q_auto,f_auto,c_fill/v1/sample.jpg");
  });

  it("無 /upload/ 的 URL 原樣返回", () => {
    const url = "https://example.com/image.jpg";
    const result = addCloudinaryTransform(url, { width: 400 });
    expect(result).toBe(url);
  });

  it("空 options 原樣返回", () => {
    const url = "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg";
    const result = addCloudinaryTransform(url, {});
    expect(result).toBe(url);
  });
});

describe("getOptimizedImageUrl", () => {
  const cloudinaryUrl = "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg";

  it("preset card 套用正確參數", () => {
    const result = getOptimizedImageUrl(cloudinaryUrl, "card");
    expect(result).toContain("w_400");
    expect(result).toContain("h_250");
    expect(result).toContain("q_auto");
    expect(result).toContain("f_auto");
    expect(result).toContain("c_fill");
  });

  it("preset cover 套用正確參數", () => {
    const result = getOptimizedImageUrl(cloudinaryUrl, "cover");
    expect(result).toContain("w_800");
    expect(result).toContain("h_400");
  });

  it("preset icon 套用正確參數", () => {
    const result = getOptimizedImageUrl(cloudinaryUrl, "icon");
    expect(result).toContain("w_80");
    expect(result).toContain("h_80");
  });

  it("非 Cloudinary URL 原樣返回", () => {
    expect(getOptimizedImageUrl("https://example.com/img.jpg", "card")).toBe("https://example.com/img.jpg");
  });

  it("null 回傳空字串", () => {
    expect(getOptimizedImageUrl(null, "card")).toBe("");
  });

  it("undefined 回傳空字串", () => {
    expect(getOptimizedImageUrl(undefined, "card")).toBe("");
  });

  it("自訂 options 物件", () => {
    const result = getOptimizedImageUrl(cloudinaryUrl, { width: 300, format: "webp" });
    expect(result).toContain("w_300");
    expect(result).toContain("f_webp");
  });
});
