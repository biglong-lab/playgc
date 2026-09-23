// 📣 場域級 Telegram 群組：場域設了用自己的、沒設沿用環境變數
import { describe, it, expect, vi, beforeEach } from "vitest";

const { state, mockDb } = vi.hoisted(() => {
  const state = { settings: null as unknown, envGroups: ["-1001"] as string[], fail: false };
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (state.fail) throw new Error("db down");
            return [{ settings: state.settings }];
          }),
        })),
      })),
    })),
  };
  return { state, mockDb };
});

vi.mock("../db", () => ({ db: mockDb }));  // 延遲載入時取得同一份 mock
vi.mock("@shared/schema", () => ({ fields: { id: "id", settings: "settings" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("../lib/telegram-bot", () => ({ getFieldGroupChatIds: () => state.envGroups }));

import { invalidateFieldTelegram, isValidChatId, resolveFieldChatIds, sanitizeFieldTelegram } from "../lib/field-telegram";

beforeEach(() => {
  vi.clearAllMocks();
  state.settings = null;
  state.envGroups = ["-1001"];
  state.fail = false;
  invalidateFieldTelegram("f1");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("resolveFieldChatIds", () => {
  it("沒帶場域 → 用環境變數設定的群組（維持現有行為）", async () => {
    expect(await resolveFieldChatIds(null)).toEqual(["-1001"]);
  });

  it("場域沒設 → 一樣回環境變數", async () => {
    state.settings = { telegram: {} };
    expect(await resolveFieldChatIds("f1")).toEqual(["-1001"]);
  });

  it("場域設了自己的群組 → 送自己的", async () => {
    state.settings = { telegram: { chatIds: ["-2002", "-3003"] } };
    expect(await resolveFieldChatIds("f1")).toEqual(["-2002", "-3003"]);
  });

  it("場域關閉通知 → 不送（回空陣列）", async () => {
    state.settings = { telegram: { enabled: false, chatIds: ["-2002"] } };
    expect(await resolveFieldChatIds("f1")).toEqual([]);
  });

  it("讀取失敗 → 回退環境變數，不丟錯", async () => {
    state.fail = true;
    expect(await resolveFieldChatIds("f1")).toEqual(["-1001"]);
  });
});

describe("設定清洗", () => {
  it("只收數字型 chat id、最多 5 個", () => {
    expect(isValidChatId("-1001234567")).toBe(true);
    expect(isValidChatId("abc")).toBe(false);
    expect(isValidChatId("-123")).toBe(false); // 太短的不收
    const cfg = sanitizeFieldTelegram({
      chatIds: ["-100123456", "壞的", "-200123456", "-300123456", "-400123456", "-500123456", "-600123456"],
    });
    expect(cfg.chatIds).toEqual(["-100123456", "-200123456", "-300123456", "-400123456", "-500123456"]);
  });

  it("預設啟用；明確 false 才關", () => {
    expect(sanitizeFieldTelegram({}).enabled).toBe(true);
    expect(sanitizeFieldTelegram({ enabled: false }).enabled).toBe(false);
  });
});
