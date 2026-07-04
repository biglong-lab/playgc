// useTeamShootingSync 單元測試
//
// 覆蓋：純函式 parseHitRecord + hook injectHit / clearHits 介面

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

// 🌐 Phase 3 起 hook 永遠走全域 WebSocketProvider（useWebSocket）
//   單元測試不架 Provider、mock 一個「未連線、全 no-op」的假 Provider
//   （enabled=false 情境本來就不應觸發任何 WS 行為）
vi.mock("@/contexts/WebSocketContext", () => ({
  useWebSocket: () => ({
    isConnected: false,
    isReconnecting: false,
    acquire: () => () => {},
    ensureConnected: () => () => {},
    registerOnConnect: () => () => {},
    subscribe: () => () => {},
    send: () => false,
    getConnectionStats: () => ({
      connectAt: 0,
      disconnectCount: 0,
      reconnectSuccessCount: 0,
      reconnectFailCount: 0,
      isConnected: false,
      isReconnecting: false,
      currentAttempts: 0,
    }),
  }),
}));

import {
  useTeamShootingSync,
  parseHitRecord,
} from "../useTeamShootingSync";

// ============================================================================
// 純函式
// ============================================================================

describe("parseHitRecord", () => {
  it("解析完整 record（最佳情況）", () => {
    const result = parseHitRecord(
      {
        userId: "u1",
        displayName: "阿明",
        hitZone: "bullseye",
        score: 10,
        timestamp: "2026-05-01T10:00:00Z",
      },
      "fallback-user",
      "fallback-name",
    );
    expect(result).toEqual({
      userId: "u1",
      displayName: "阿明",
      hitZone: "bullseye",
      score: 10,
      timestamp: "2026-05-01T10:00:00Z",
    });
  });

  it("無 userId 用 fallback", () => {
    const result = parseHitRecord({ score: 5, hitZone: "outer" }, "me", "我");
    expect(result.userId).toBe("me");
    expect(result.displayName).toBe("我");
  });

  it("score 從 hitScore 取（後備欄位）", () => {
    const result = parseHitRecord({ hitScore: 8 }, "me", "我");
    expect(result.score).toBe(8);
  });

  it("score 從 points 取（最後 fallback）", () => {
    const result = parseHitRecord({ points: 3 }, "me", "我");
    expect(result.score).toBe(3);
  });

  it("hitZone 從 targetZone 取（後備欄位）", () => {
    const result = parseHitRecord({ targetZone: "inner" }, "me", "我");
    expect(result.hitZone).toBe("inner");
  });

  it("沒任何分數欄位 → 0", () => {
    const result = parseHitRecord({}, "me", "我");
    expect(result.score).toBe(0);
  });

  it("沒 hitZone → 預設 outer", () => {
    const result = parseHitRecord({}, "me", "我");
    expect(result.hitZone).toBe("outer");
  });

  it("沒 timestamp → 自動生成 ISO 字串", () => {
    const result = parseHitRecord({}, "me", "我");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("timestamp 從 hitAt 取（後備欄位）", () => {
    const result = parseHitRecord(
      { hitAt: "2026-05-01T11:00:00Z" },
      "me",
      "我",
    );
    expect(result.timestamp).toBe("2026-05-01T11:00:00Z");
  });
});

// ============================================================================
// Hook 介面（不真連 WebSocket，只測 inject / clear）
// ============================================================================

describe("useTeamShootingSync hook 介面", () => {
  it("enabled=false 不啟動 WebSocket，injectHit 仍可累積", () => {
    const { result } = renderHook(() =>
      useTeamShootingSync({
        sessionId: "s1",
        myUserId: "me",
        myDisplayName: "我",
        enabled: false,
      }),
    );

    expect(result.current.isConnected).toBe(false);

    act(() => {
      result.current.injectHit({
        userId: "me",
        displayName: "我",
        hitZone: "inner",
        score: 8,
        timestamp: "2026-05-01",
      });
    });

    expect(result.current.teamHits).toHaveLength(1);
    expect(result.current.teamHits[0].score).toBe(8);
  });

  it("clearHits 清空", () => {
    const { result } = renderHook(() =>
      useTeamShootingSync({
        sessionId: "s1",
        myUserId: "me",
        myDisplayName: "我",
        enabled: false,
      }),
    );

    act(() => {
      result.current.injectHit({
        userId: "u1",
        displayName: "u1",
        hitZone: "outer",
        score: 5,
        timestamp: "",
      });
      result.current.injectHit({
        userId: "u2",
        displayName: "u2",
        hitZone: "outer",
        score: 5,
        timestamp: "",
      });
    });
    expect(result.current.teamHits).toHaveLength(2);

    act(() => {
      result.current.clearHits();
    });
    expect(result.current.teamHits).toHaveLength(0);
  });

  it("多筆 injectHit 按順序累積", () => {
    const { result } = renderHook(() =>
      useTeamShootingSync({
        sessionId: "s1",
        myUserId: "me",
        myDisplayName: "我",
        enabled: false,
      }),
    );

    const hits = [
      { userId: "u1", displayName: "A", hitZone: "outer", score: 5, timestamp: "1" },
      { userId: "u2", displayName: "B", hitZone: "inner", score: 8, timestamp: "2" },
      { userId: "u3", displayName: "C", hitZone: "bullseye", score: 10, timestamp: "3" },
    ];

    act(() => {
      hits.forEach(result.current.injectHit);
    });

    expect(result.current.teamHits).toHaveLength(3);
    expect(result.current.teamHits[0].userId).toBe("u1");
    expect(result.current.teamHits[1].userId).toBe("u2");
    expect(result.current.teamHits[2].userId).toBe("u3");
  });
});
