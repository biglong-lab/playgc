// 📺 守護棘輪：大螢幕互動（HostScreen 軸線）已於 2026-09-25 移交 PhotoGo
//   計畫：docs/changes/2026-09-25-host-removal-photogo-migration.md（R4 伺服器與即時層）
//
// 這支守的兩件事：
//   1. websocket.ts 不再有 host_screen_* 訊息契約（register / pulse / state / error）
//   2. server/ 下不再有 hostMode: true 的寫入
//      （game_sessions.host_mode 欄位保留給歷史資料 — 表只加不刪紅線 — 但程式不得再寫入）
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === "node_modules" || name === "__tests__" ? [] : walk(full);
    }
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("大螢幕互動（HostScreen）已移除", () => {
  it("websocket.ts 不再有 host_screen_* 訊息分支", () => {
    const src = readFileSync(join(ROOT, "server/routes/websocket.ts"), "utf-8");
    expect(src).not.toContain("host_screen");
    expect(src).not.toContain("broadcastToHostSession");
    expect(src).not.toContain("hostSessionStateCache");
  });

  it("server/ 下（排除 __tests__）不再有 hostMode: true 的寫入", () => {
    const offenders = walk(join(ROOT, "server"))
      .filter((file) => /hostMode\s*:\s*true/.test(readFileSync(file, "utf-8")))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("host 大螢幕 token 到期提醒（expiring-session-checker）已整檔移除", () => {
    const libFiles = readdirSync(join(ROOT, "server/lib"));
    expect(libFiles).not.toContain("expiring-session-checker.ts");
  });
});
