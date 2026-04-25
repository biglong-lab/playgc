import { describe, expect, it } from "vitest";
import { hashToBucket, shouldApplyRule } from "../ab-testing";

describe("ab-testing", () => {
  describe("hashToBucket", () => {
    it("回傳 0-99 整數", () => {
      const result = hashToBucket("rule_1", "squad_1");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(100);
      expect(Number.isInteger(result)).toBe(true);
    });

    it("同樣 input 永遠回傳同樣 output（deterministic）", () => {
      const a = hashToBucket("rule_1", "squad_1");
      const b = hashToBucket("rule_1", "squad_1");
      expect(a).toBe(b);
    });

    it("不同 ruleId → 不同 bucket（高機率）", () => {
      const ruleA = hashToBucket("rule_a", "squad_1");
      const ruleB = hashToBucket("rule_b", "squad_1");
      // 雖然有 1/100 機率相同，但兩個 hash 應該幾乎不同
      // 用多組測試
      let same = 0;
      for (let i = 0; i < 50; i++) {
        if (
          hashToBucket(`rule_${i}_a`, "squad_x") ===
          hashToBucket(`rule_${i}_b`, "squad_x")
        ) {
          same++;
        }
      }
      expect(same).toBeLessThan(10); // 50 組裡相同數應遠小於 10
    });

    it("分布大致均勻（1000 組 squad，期望 50 ± 20 命中 0-49）", () => {
      let count = 0;
      for (let i = 0; i < 1000; i++) {
        if (hashToBucket("rule_1", `squad_${i}`) < 50) count++;
      }
      // 期望 500 ± 80（4 sigma）
      expect(count).toBeGreaterThan(420);
      expect(count).toBeLessThan(580);
    });
  });

  describe("shouldApplyRule", () => {
    it("traffic=100 → 永遠 true", () => {
      for (let i = 0; i < 100; i++) {
        expect(
          shouldApplyRule({
            ruleId: "r1",
            subjectId: `s_${i}`,
            traffic: 100,
          }),
        ).toBe(true);
      }
    });

    it("traffic=0 → 永遠 false", () => {
      for (let i = 0; i < 100; i++) {
        expect(
          shouldApplyRule({
            ruleId: "r1",
            subjectId: `s_${i}`,
            traffic: 0,
          }),
        ).toBe(false);
      }
    });

    it("traffic=50 → 大約 50% 命中", () => {
      let hit = 0;
      for (let i = 0; i < 1000; i++) {
        if (
          shouldApplyRule({
            ruleId: "r1",
            subjectId: `s_${i}`,
            traffic: 50,
          })
        ) {
          hit++;
        }
      }
      // 期望 500 ± 80
      expect(hit).toBeGreaterThan(420);
      expect(hit).toBeLessThan(580);
    });

    it("同一 subject 同一規則 → 永遠在同一組（不會跳組）", () => {
      const r1 = shouldApplyRule({
        ruleId: "r1",
        subjectId: "squad_alpha",
        traffic: 50,
      });
      for (let i = 0; i < 10; i++) {
        expect(
          shouldApplyRule({
            ruleId: "r1",
            subjectId: "squad_alpha",
            traffic: 50,
          }),
        ).toBe(r1);
      }
    });

    it("traffic > 100 → 視為 100", () => {
      expect(
        shouldApplyRule({
          ruleId: "r1",
          subjectId: "s1",
          traffic: 150,
        }),
      ).toBe(true);
    });

    it("traffic < 0 → 視為 0", () => {
      expect(
        shouldApplyRule({
          ruleId: "r1",
          subjectId: "s1",
          traffic: -10,
        }),
      ).toBe(false);
    });
  });
});
