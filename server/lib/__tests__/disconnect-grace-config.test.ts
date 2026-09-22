// ⏱️ 多人遊戲斷線寬限期 — 每次使用時讀場域最新設定（30 秒快取），不必重啟
//   過去 websocket.ts 只在啟動時讀環境變數，場域設定頁存的值完全沒被讀到
import { describe, it, expect, vi } from "vitest";

vi.mock("../../db", () => ({ db: {} }));

import {
  resolveGraceConfig,
  createGraceConfigCache,
  GRACE_CONFIG_TTL_MS,
  type GraceConfig,
} from "../disconnect-grace-config";

const FALLBACK: GraceConfig = { graceMs: 30_000, autoLeaveMs: 120_000 };

describe("resolveGraceConfig — 場域設定（秒）→ 計時器（毫秒）", () => {
  it("有設定 → 換算毫秒", () => {
    expect(resolveGraceConfig({ disconnectGracePeriodSec: 45, autoLeaveAfterGraceSec: 300 }, FALLBACK)).toEqual({
      graceMs: 45_000,
      autoLeaveMs: 300_000,
    });
  });

  it("未設定 / 設定不是物件 → 用預設（環境變數或內建值）", () => {
    expect(resolveGraceConfig(undefined, FALLBACK)).toEqual(FALLBACK);
    expect(resolveGraceConfig(null, FALLBACK)).toEqual(FALLBACK);
    expect(resolveGraceConfig({}, FALLBACK)).toEqual(FALLBACK);
  });

  it("只設其中一項 → 另一項用預設", () => {
    expect(resolveGraceConfig({ disconnectGracePeriodSec: 60 }, FALLBACK)).toEqual({ graceMs: 60_000, autoLeaveMs: 120_000 });
  });

  it("超出範圍或非數字 → 該項用預設（寬限 5～600 秒、自動離開 30～600 秒）", () => {
    expect(resolveGraceConfig({ disconnectGracePeriodSec: 1, autoLeaveAfterGraceSec: 10 }, FALLBACK)).toEqual(FALLBACK);
    expect(resolveGraceConfig({ disconnectGracePeriodSec: 9999 }, FALLBACK)).toEqual(FALLBACK);
    expect(resolveGraceConfig({ disconnectGracePeriodSec: "45" }, FALLBACK)).toEqual(FALLBACK);
  });
});

describe("createGraceConfigCache — 短 TTL 快取", () => {
  function setup() {
    let now = 1_000_000;
    const load = vi.fn(async (_teamId: string): Promise<unknown> => ({ disconnectGracePeriodSec: 45 }));
    const get = createGraceConfigCache(load, { now: () => now, fallback: FALLBACK });
    return { get, load, advance: (ms: number) => { now += ms; } };
  }

  it("TTL 為 30 秒", () => {
    expect(GRACE_CONFIG_TTL_MS).toBe(30_000);
  });

  it("首次讀 DB，TTL 內重複取用走快取", async () => {
    const { get, load, advance } = setup();
    expect((await get("team-1")).graceMs).toBe(45_000);
    advance(GRACE_CONFIG_TTL_MS - 1);
    await get("team-1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("過了 TTL → 重新讀，拿到管理員剛改的新值（不用重啟）", async () => {
    const { get, load, advance } = setup();
    await get("team-1");
    load.mockResolvedValueOnce({ disconnectGracePeriodSec: 90 });
    advance(GRACE_CONFIG_TTL_MS + 1);
    expect((await get("team-1")).graceMs).toBe(90_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("不同隊伍分開快取", async () => {
    const { get, load } = setup();
    await get("team-1");
    await get("team-2");
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenNthCalledWith(2, "team-2");
  });

  it("讀取失敗 → 用預設、不快取（下次再試），不丟錯阻塞連線", async () => {
    const { get, load } = setup();
    load.mockRejectedValueOnce(new Error("db down"));
    await expect(get("team-1")).resolves.toEqual(FALLBACK);
    expect((await get("team-1")).graceMs).toBe(45_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("隊伍找不到場域（load 回 null）→ 用預設", async () => {
    const { get, load } = setup();
    load.mockResolvedValueOnce(null);
    await expect(get("team-x")).resolves.toEqual(FALLBACK);
  });
});
