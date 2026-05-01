// shooting-broadcast helper 單元測試
//
// 覆蓋：deriveDisplayName fallback / record 補 displayName / userId 為 null

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock storage.getUser
vi.mock("../../storage", () => ({
  storage: {
    getUser: vi.fn(),
  },
}));

import { enrichShootingRecordForBroadcast } from "../shooting-broadcast";
import { storage } from "../../storage";

const mockGetUser = vi.mocked(storage.getUser);

describe("enrichShootingRecordForBroadcast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("無 userId 時 displayName = null", async () => {
    const record = { id: 1, sessionId: "s1", score: 10, userId: null };
    const result = await enrichShootingRecordForBroadcast(record);

    expect(result.displayName).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("有 userId 時反查 user 並設 displayName（firstName + lastName 優先）", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "u1",
      firstName: "阿明",
      lastName: "陳",
      email: "ming@example.com",
    } as any);

    const record = { id: 1, sessionId: "s1", score: 10, userId: "u1" };
    const result = await enrichShootingRecordForBroadcast(record);

    expect(mockGetUser).toHaveBeenCalledWith("u1");
    expect(result.displayName).toBe("阿明 陳");
  });

  it("無 firstName/lastName 時用 email username", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "u1",
      firstName: null,
      lastName: null,
      email: "ming@example.com",
    } as any);

    const result = await enrichShootingRecordForBroadcast({
      id: 1,
      sessionId: "s1",
      userId: "u1",
    });

    expect(result.displayName).toBe("ming");
  });

  it("只有 firstName 沒有 lastName 也能用", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "u1",
      firstName: "阿明",
      lastName: null,
      email: null,
    } as any);

    const result = await enrichShootingRecordForBroadcast({
      id: 1,
      userId: "u1",
    });

    expect(result.displayName).toBe("阿明");
  });

  it("user 完全空白資料 → fallback 到 userId 前 8 字", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "u1234567890",
      firstName: null,
      lastName: null,
      email: null,
    } as any);

    const result = await enrichShootingRecordForBroadcast({
      userId: "u1234567890",
    });

    expect(result.displayName).toBe("u1234567");
  });

  it("反查不到 user → displayName = null（不阻塞 broadcast）", async () => {
    mockGetUser.mockResolvedValueOnce(undefined);

    const result = await enrichShootingRecordForBroadcast({
      userId: "u-not-exist",
    });

    expect(result.displayName).toBeNull();
  });

  it("反查拋錯 → displayName = null（不阻塞 broadcast）", async () => {
    mockGetUser.mockRejectedValueOnce(new Error("DB down"));

    const result = await enrichShootingRecordForBroadcast({
      userId: "u1",
    });

    expect(result.displayName).toBeNull();
  });

  it("record 已有 displayName → 不重複查（idempotent）", async () => {
    const record = {
      userId: "u1",
      displayName: "預設名",
    };
    const result = await enrichShootingRecordForBroadcast(record);

    expect(result.displayName).toBe("預設名");
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("保留 record 其他欄位不動", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "u1",
      firstName: "A",
    } as any);

    const result = await enrichShootingRecordForBroadcast({
      id: 42,
      sessionId: "session-1",
      score: 100,
      hitZone: "bullseye",
      userId: "u1",
    });

    expect(result.id).toBe(42);
    expect(result.sessionId).toBe("session-1");
    expect(result.score).toBe(100);
    expect(result.hitZone).toBe("bullseye");
    expect(result.displayName).toBe("A");
  });
});
