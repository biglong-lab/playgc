import { describe, it, expect, vi } from "vitest";

// Mock db 模組（避免需要 DATABASE_URL）
vi.mock("../db", () => ({
  db: {
    query: { games: { findFirst: vi.fn() } },
    update: vi.fn(),
  },
}));

import { generateSlug, generateGameUrl } from "../qrCodeService";

describe("generateSlug", () => {
  it("產生 8 字元的 slug", () => {
    const slug = generateSlug();
    expect(slug).toHaveLength(8);
  });

  it("只包含小寫英文和數字", () => {
    const slug = generateSlug();
    expect(slug).toMatch(/^[a-z0-9]+$/);
  });

  it("每次產生不同的 slug", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 100; i++) {
      slugs.add(generateSlug());
    }
    // 100 次至少有 95 個不同的（機率極高）
    expect(slugs.size).toBeGreaterThan(95);
  });
});

describe("generateGameUrl", () => {
  it("產生正確的遊戲 URL 格式", () => {
    const url = generateGameUrl("abc12345");
    expect(url).toContain("/g/abc12345");
  });

  it("包含 slug 在路徑中", () => {
    const slug = "testslug";
    const url = generateGameUrl(slug);
    expect(url.endsWith(`/g/${slug}`)).toBe(true);
  });
});
