// 🔒 守護棘輪：邊界規則寫成測試（hung-blocks 鐵則 5「違規在 CI 就紅、不靠人記」）
//
// 這支守的三件事：
//   1. 模組登錄表宣告的 API 前綴，真的有對應的路由（宣告不能是空話）
//   2. 場域設定存進去的欄位，程式裡真的有讀（防「存了無作用」的設定）
//   3. 領域事件命名是過去式、payload 一定有發生時間
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { MODULE_REGISTRY } from "@shared/lib/module-registry";

const ROOT = process.cwd();

function walk(dir: string, exts = [".ts"]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" ? [] : walk(full, exts);
    return exts.some((e) => full.endsWith(e)) && !full.includes("__tests__") ? [full] : [];
  });
}

const serverSources = walk(join(ROOT, "server")).map((f) => ({ file: f, src: readFileSync(f, "utf-8") }));
const clientSources = walk(join(ROOT, "client/src"), [".ts", ".tsx"]).map((f) => ({ file: f, src: readFileSync(f, "utf-8") }));

describe("模組登錄表 vs 真實路由", () => {
  const routePaths = serverSources.flatMap(({ src }) =>
    Array.from(src.matchAll(/app\.(?:get|post|patch|put|delete|use)\(\s*"(\/api\/[^"]*)"/g)).map((m) => m[1]),
  );

  it("每個模組宣告的 API 前綴都至少有一條真實路由", () => {
    const orphan = MODULE_REGISTRY.flatMap((m) =>
      m.apiPrefixes
        .filter((prefix) => !routePaths.some((p) => p.startsWith(prefix)))
        .map((prefix) => `${m.key} → ${prefix}`),
    );
    expect(orphan).toEqual([]);
  });

  it("模組的選單路徑不重疊（避免一條路徑對到兩個模組、開關互相打架）", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const m of MODULE_REGISTRY) {
      for (const path of m.menuPaths) {
        const owner = seen.get(path);
        if (owner) clashes.push(`${path}：${owner} / ${m.key}`);
        else seen.set(path, m.key);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe("場域設定：存了要有人讀", () => {
  const settingsRoute = serverSources.find((s) => s.file.endsWith("routes/admin-fields.ts"))!.src;
  /** PATCH /settings 會寫進 settings 的欄位 */
  const writtenKeys = Array.from(settingsRoute.matchAll(/updatedSettings\.([a-zA-Z0-9_]+)\s*=/g)).map((m) => m[1]);

  it("每個寫入的設定欄位，在別處真的有被讀取（否則就是『存了無作用』）", () => {
    const allSources = [...serverSources, ...clientSources].filter((s) => !s.file.endsWith("routes/admin-fields.ts"));
    const unread = Array.from(new Set(writtenKeys)).filter((key) => {
      const patterns = [`settings.${key}`, `settings?.${key}`, `.${key}`, `"${key}"`];
      return !allSources.some(({ src }) => patterns.some((p) => src.includes(p)));
    });
    expect(unread).toEqual([]);
  });

  it("有實際寫入的欄位（守護本身沒有失效）", () => {
    expect(writtenKeys.length).toBeGreaterThan(5);
  });
});

describe("領域事件命名", () => {
  const eventsSrc = readFileSync(join(ROOT, "shared/lib/domain-events.ts"), "utf-8");
  const busSrc = readFileSync(join(ROOT, "server/lib/event-bus.ts"), "utf-8");

  it("事件名稱是「名詞.過去式」且 payload 有 occurredAt", () => {
    const names = Array.from(busSrc.matchAll(/"([a-z_]+\.[a-z_]+)":/g)).map((m) => m[1]);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name, `${name} 應為「名詞.過去式」（如 field.provisioned）`).toMatch(/^[a-z_]+\.[a-z_]+ed$/);
    }
    expect(eventsSrc).toContain("occurredAt");
  });
});
