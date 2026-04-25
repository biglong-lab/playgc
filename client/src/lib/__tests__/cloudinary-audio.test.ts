import { describe, it, expect } from "vitest";
import { ensureAudioUrl } from "../cloudinary-audio";

describe("ensureAudioUrl", () => {
  it("空值/null/undefined → 空字串", () => {
    expect(ensureAudioUrl(null)).toBe("");
    expect(ensureAudioUrl(undefined)).toBe("");
    expect(ensureAudioUrl("")).toBe("");
  });

  it("已是 mp3 → 原樣返回", () => {
    const url = "https://example.com/song.mp3";
    expect(ensureAudioUrl(url)).toBe(url);
  });

  it("已是 m4a / aac / wav / ogg → 原樣返回", () => {
    expect(ensureAudioUrl("https://x.com/a.m4a")).toBe("https://x.com/a.m4a");
    expect(ensureAudioUrl("https://x.com/a.aac")).toBe("https://x.com/a.aac");
    expect(ensureAudioUrl("https://x.com/a.wav")).toBe("https://x.com/a.wav");
    expect(ensureAudioUrl("https://x.com/a.ogg")).toBe("https://x.com/a.ogg");
  });

  it("非 Cloudinary URL → 原樣返回", () => {
    const url = "https://other-cdn.com/audio";
    expect(ensureAudioUrl(url)).toBe(url);
  });

  it("Cloudinary /video/upload/ + .mp4 → 替換成 .mp3", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/path/file.mp4";
    const expected =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/path/file.mp3";
    expect(ensureAudioUrl(input)).toBe(expected);
  });

  it("Cloudinary /video/upload/ + .webm → 替換成 .mp3", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/file.webm";
    expect(ensureAudioUrl(input)).toBe(
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/file.mp3",
    );
  });

  it("Cloudinary /video/upload/ 無副檔名 → 附加 .mp3", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/path/abc";
    expect(ensureAudioUrl(input)).toBe(
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/path/abc.mp3",
    );
  });

  it("Cloudinary /video/upload/ 含 query string → 在 query 前加 .mp3", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/abc?t=5";
    expect(ensureAudioUrl(input)).toBe(
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/abc.mp3?t=5",
    );
  });

  it("Cloudinary /video/upload/ + .mp4 + query → 替換 .mp4 為 .mp3 保留 query", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/abc.mp4?t=5";
    expect(ensureAudioUrl(input)).toBe(
      "https://res.cloudinary.com/djdhedstt/video/upload/v123/abc.mp3?t=5",
    );
  });

  it("實際 user 案例：v1777146516 jiachun-game URL", () => {
    const input =
      "https://res.cloudinary.com/djdhedstt/video/upload/v1777146516/jiachun-game/games/f84c64ef-fa97-4955-b4e0-8a17b22e0001.mp4";
    expect(ensureAudioUrl(input)).toBe(
      "https://res.cloudinary.com/djdhedstt/video/upload/v1777146516/jiachun-game/games/f84c64ef-fa97-4955-b4e0-8a17b22e0001.mp3",
    );
  });
});
