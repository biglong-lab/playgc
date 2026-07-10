// 🔒 media-mime 上傳 magic-byte 驗證測試
import { describe, it, expect } from "vitest";
import {
  detectMediaCategory,
  assertDataUrlCategory,
  MediaTypeMismatchError,
} from "../media-mime";

/** 把位元組陣列包成 data URL（宣稱的 mime 可自訂、模擬偽造前綴） */
function toDataUrl(bytes: number[], claimedMime = "image/jpeg"): string {
  return `data:${claimedMime};base64,${Buffer.from(bytes).toString("base64")}`;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
const GIF = [...Buffer.from("GIF89a"), 0x01, 0x00];
const WEBP = [...Buffer.from("RIFF"), 0x24, 0x00, 0x00, 0x00, ...Buffer.from("WEBP")];
const MP4 = [0x00, 0x00, 0x00, 0x18, ...Buffer.from("ftyp"), ...Buffer.from("isom"), 0, 0, 0, 0];
const HEIC = [0x00, 0x00, 0x00, 0x18, ...Buffer.from("ftyp"), ...Buffer.from("heic"), 0, 0, 0, 0];
const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00];
const MP3_ID3 = [...Buffer.from("ID3"), 0x03, 0x00, 0x00, 0x00];
const WAV = [...Buffer.from("RIFF"), 0x24, 0x00, 0x00, 0x00, ...Buffer.from("WAVE")];
const OGG = [...Buffer.from("OggS"), 0x00, 0x02, 0x00, 0x00];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // MZ（PE 執行檔）
const HTML = [...Buffer.from("<!DOCTYPE html><script>")];

describe("detectMediaCategory", () => {
  it("辨識常見圖片格式", () => {
    expect(detectMediaCategory(Buffer.from(JPEG))).toBe("image");
    expect(detectMediaCategory(Buffer.from(PNG))).toBe("image");
    expect(detectMediaCategory(Buffer.from(GIF))).toBe("image");
    expect(detectMediaCategory(Buffer.from(WEBP))).toBe("image");
    expect(detectMediaCategory(Buffer.from(HEIC))).toBe("image");
  });

  it("辨識 SVG（文字格式）", () => {
    expect(detectMediaCategory(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'))).toBe("image");
    expect(detectMediaCategory(Buffer.from('<?xml version="1.0"?><svg>'))).toBe("image");
  });

  it("辨識影片格式", () => {
    expect(detectMediaCategory(Buffer.from(MP4))).toBe("video");
    expect(detectMediaCategory(Buffer.from(WEBM))).toBe("video");
  });

  it("辨識音訊格式", () => {
    expect(detectMediaCategory(Buffer.from(MP3_ID3))).toBe("audio");
    expect(detectMediaCategory(Buffer.from(WAV))).toBe("audio");
    expect(detectMediaCategory(Buffer.from(OGG))).toBe("audio");
  });

  it("執行檔 / HTML 認不出 → unknown", () => {
    expect(detectMediaCategory(Buffer.from(EXE))).toBe("unknown");
    expect(detectMediaCategory(Buffer.from(HTML))).toBe("unknown");
  });
});

describe("assertDataUrlCategory", () => {
  it("真 JPEG 宣稱 image → 放行", () => {
    expect(() => assertDataUrlCategory(toDataUrl(JPEG, "image/jpeg"), "image")).not.toThrow();
  });

  it("執行檔偽裝 image 前綴 → 擋下", () => {
    expect(() => assertDataUrlCategory(toDataUrl(EXE, "image/png"), "image")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("HTML 偽裝 image 前綴 → 擋下（防 stored XSS 載體）", () => {
    expect(() => assertDataUrlCategory(toDataUrl(HTML, "image/png"), "image")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("影片內容宣稱 image → 擋下", () => {
    expect(() => assertDataUrlCategory(toDataUrl(MP4, "image/png"), "image")).toThrow(
      MediaTypeMismatchError,
    );
  });

  it("真 MP4 走 video 關卡 → 放行；真 MP3 走 audio 關卡 → 放行", () => {
    expect(() => assertDataUrlCategory(toDataUrl(MP4, "video/mp4"), "video")).not.toThrow();
    expect(() => assertDataUrlCategory(toDataUrl(MP3_ID3, "audio/mpeg"), "audio")).not.toThrow();
  });

  it("非 data URL（server 端自產來源）直接放行", () => {
    expect(() => assertDataUrlCategory("https://res.cloudinary.com/x/image/upload/a.jpg", "image")).not.toThrow();
  });

  it("壞掉的 base64 → 擋下", () => {
    expect(() => assertDataUrlCategory("data:image/png;base64,", "image")).toThrow(
      MediaTypeMismatchError,
    );
  });
});
