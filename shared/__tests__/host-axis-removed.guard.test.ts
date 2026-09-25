// 🛡️ 守護：大螢幕互動（HostScreen 軸線）已整條移交 PhotoGo（ADR-0029，2026-09-25）
//
// CHITO 不得再長回來：沒有 host_* pageType、沒有 /host /play 路由、沒有 host 元件目錄、
// 沒有 hostMode: true 的寫入。有需求一律做在 PhotoGo。
// 只掃原始碼（排除測試、docs、node_modules、dist）；schema 欄位保留是刻意的（表只加不刪），不在掃描範圍。
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const SCAN_DIRS = ["client/src", "shared", "server"];
const SKIP = /node_modules|\/dist\/|__tests__|\.test\.|\.spec\.|shared\/schema\//;

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const HOST_PAGE_TYPES =
  /host_(poll_live|emoji_react|wave_response|crowd_gather|live_leaderboard|team_battle_score|progress_quest|polaroid_collage|guestbook_digital|blessing_wall|knowledge_map|scoreboard_announcement|lottery_wheel|bingo_board|micro_qa|trivia_showdown|word_cloud)/;

function offenders(pattern: RegExp): string[] {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));
  return files
    .filter((f) => pattern.test(readFileSync(f, "utf8")))
    .map((f) => f.replace(ROOT + "/", ""));
}

describe("host 軸已移除（不得長回來）", () => {
  it("沒有任何 host_* pageType", () => {
    expect(offenders(HOST_PAGE_TYPES)).toEqual([]);
  });

  it("沒有 host 元件目錄與同步 hook", () => {
    expect(existsSync(join(ROOT, "client/src/components/game/host"))).toBe(false);
    expect(existsSync(join(ROOT, "client/src/components/game/shared/hooks/useHostScreenSync.ts"))).toBe(false);
  });

  it("沒有 /host、/play 路由與 host session 建立", () => {
    expect(offenders(/path="\/(host|play)\/:sessionId"/)).toEqual([]);
    expect(offenders(/hostMode:\s*true/)).toEqual([]);
    expect(offenders(/host_screen_(register|pulse|state|error)/)).toEqual([]);
  });

  it("模組登錄表沒有 host 模組（B-0 的過渡開關已隨移除一併撤掉）", () => {
    const registry = readFileSync(join(ROOT, "shared/lib/module-registry.ts"), "utf8");
    expect(/key:\s*"host"/.test(registry)).toBe(false);
  });
});
