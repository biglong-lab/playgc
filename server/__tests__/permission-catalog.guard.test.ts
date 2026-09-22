// 🔑 守護棘輪：程式用到的權限鍵一定要在目錄裡（否則永遠授不出去 → 那條路由沒人打得開）
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { PERMISSION_CATALOG, PERMISSION_KEYS, PERMISSION_BACKFILL, isKnownPermission } from "@shared/lib/permission-catalog";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : walk(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

/** 掃全部伺服器程式，取出 requirePermission("a", "b") 用到的鍵 */
function usedPermissionKeys(): Map<string, string> {
  const used = new Map<string, string>();
  for (const file of walk(join(process.cwd(), "server"))) {
    const src = readFileSync(file, "utf-8");
    for (const call of src.match(/requirePermission\(([^)]*)\)/g) ?? []) {
      for (const key of call.match(/"[^"]+"/g) ?? []) used.set(key.replaceAll('"', ""), file);
    }
  }
  return used;
}

describe("權限鍵目錄", () => {
  it("程式用到的每個鍵都在目錄裡", () => {
    const missing = [...usedPermissionKeys()].filter(([key]) => !isKnownPermission(key));
    expect(missing.map(([key, file]) => `${key}（${file.split("/server/")[1]}）`)).toEqual([]);
  });

  it("鍵不重複、格式一致（小寫 + : 或既有的 pos_cash_admin）", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    const bad = PERMISSION_KEYS.filter((k) => !/^[a-z_]+(:[a-z_]+)?$/.test(k));
    expect(bad).toEqual([]);
  });

  it("每個鍵都有中文名稱與說明（後台角色編輯頁要顯示）", () => {
    const incomplete = PERMISSION_CATALOG.filter((p) => !p.name.trim() || !p.description.trim());
    expect(incomplete.map((p) => p.key)).toEqual([]);
  });

  it("補發對照表只引用目錄裡的鍵", () => {
    const unknown = PERMISSION_BACKFILL.flatMap((r) => [r.when, ...r.grant]).filter((k) => !isKnownPermission(k));
    expect(unknown).toEqual([]);
  });
});
