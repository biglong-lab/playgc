import { describe, expect, it } from "vitest";
import {
  buildOgImageSvg,
  buildSchemaJsonLd,
  escapeXml,
} from "../seo-helpers";

describe("seo-helpers", () => {
  describe("escapeXml", () => {
    it("處理 5 種特殊字元", () => {
      expect(escapeXml("<>&\"'")).toBe("&lt;&gt;&amp;&quot;&apos;");
    });
    it("一般字串不變", () => {
      expect(escapeXml("火焰戰士")).toBe("火焰戰士");
    });
  });

  describe("buildOgImageSvg", () => {
    it("產生有效的 SVG 字串", () => {
      const svg = buildOgImageSvg({
        name: "火焰戰士",
        tag: "FIRE",
        totalGames: 100,
        recruitsCount: 5,
      });
      expect(svg).toContain("<?xml version=");
      expect(svg).toContain("<svg");
      expect(svg).toContain("火焰戰士");
      expect(svg).toContain("[FIRE]");
      expect(svg).toContain("總場次：100");
      expect(svg).toContain("招募成員：5");
    });

    it("有 superLeaderTier 顯示徽章", () => {
      const svg = buildOgImageSvg({
        name: "Test",
        tag: "T",
        totalGames: 10,
        recruitsCount: 0,
        superLeaderTier: "gold",
      });
      expect(svg).toContain("🥇 Gold");
    });

    it("無 superLeaderTier 不顯示徽章", () => {
      const svg = buildOgImageSvg({
        name: "Test",
        tag: "T",
        totalGames: 10,
        recruitsCount: 0,
      });
      expect(svg).not.toContain("Bronze");
      expect(svg).not.toContain("Gold");
    });

    it("escape 隊名特殊字元（防 XSS）", () => {
      const svg = buildOgImageSvg({
        name: "<script>alert(1)</script>",
        tag: "X",
        totalGames: 0,
        recruitsCount: 0,
      });
      expect(svg).not.toContain("<script>");
      expect(svg).toContain("&lt;script&gt;");
    });
  });

  describe("buildSchemaJsonLd", () => {
    it("產生符合 Schema.org SportsTeam 結構", () => {
      const schema = buildSchemaJsonLd({
        id: "squad_123",
        name: "火焰戰士",
        tag: "FIRE",
        totalGames: 50,
        totalWins: 30,
        totalLosses: 20,
        baseUrl: "https://example.com",
      });
      expect(schema["@context"]).toBe("https://schema.org");
      expect(schema["@type"]).toBe("SportsTeam");
      expect(schema["@id"]).toBe("https://example.com/squad/squad_123");
      expect(schema.name).toBe("火焰戰士");
      expect(schema.alternateName).toBe("FIRE");
      expect(schema.url).toBe("https://example.com/squad/squad_123");
    });

    it("自動生成 description（無 description 時）", () => {
      const schema = buildSchemaJsonLd({
        id: "squad_123",
        name: "火焰戰士",
        tag: "FIRE",
        totalGames: 0,
        totalWins: 0,
        totalLosses: 0,
        baseUrl: "https://example.com",
      });
      expect(schema.description).toContain("火焰戰士");
      expect(schema.description).toContain("FIRE");
    });

    it("含 additionalProperty 數據", () => {
      const schema = buildSchemaJsonLd({
        id: "squad_123",
        name: "Test",
        tag: "T",
        totalGames: 50,
        totalWins: 30,
        totalLosses: 20,
        baseUrl: "https://example.com",
      });
      const props = schema.additionalProperty as any[];
      expect(props).toHaveLength(3);
      expect(props.find((p) => p.name === "totalGames")?.value).toBe(50);
      expect(props.find((p) => p.name === "totalWins")?.value).toBe(30);
      expect(props.find((p) => p.name === "totalLosses")?.value).toBe(20);
    });
  });
});
