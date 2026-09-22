// 🏗️ 建立新場域是平台級操作 — 前端按鈕顯示與後端 POST /api/admin/fields 共用同一份規則
import { describe, it, expect } from "vitest";
import { canCreateField } from "../lib/field-permissions";

describe("canCreateField", () => {
  it("平台管理員可建立", () => {
    expect(canCreateField("super_admin")).toBe(true);
    expect(canCreateField("platform_admin")).toBe(true);
  });

  it("場域層級角色不可建立", () => {
    for (const role of ["field_director", "field_manager", "field_executor", "custom", "player"]) {
      expect(canCreateField(role)).toBe(false);
    }
  });

  it("未登入 / 未知 → 不可建立", () => {
    expect(canCreateField(undefined)).toBe(false);
    expect(canCreateField(null)).toBe(false);
    expect(canCreateField("")).toBe(false);
  });
});
