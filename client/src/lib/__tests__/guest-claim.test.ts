import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockApiRequest, mockInvalidate } = vi.hoisted(() => ({
  mockApiRequest: vi.fn(),
  mockInvalidate: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mockApiRequest(...args),
  queryClient: { invalidateQueries: mockInvalidate },
}));

import {
  GUEST_CLAIMED_EVENT,
  prefetchGuestClaimTicket,
  armGuestClaim,
  hasArmedGuestClaim,
  finalizeGuestClaim,
} from "../guest-claim";

function jsonRes(body: unknown) {
  return { json: async () => body };
}

describe("訪客紀錄認領（前端）", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mockApiRequest.mockReset();
    mockInvalidate.mockReset();
  });

  it("預取憑證後尚未武裝 → 登入也不會認領（避免同手機之後有人登入就把紀錄帶走）", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonRes({ ticket: "t.sig" }));
    expect(await prefetchGuestClaimTicket()).toBe(true);
    expect(hasArmedGuestClaim()).toBe(false);
    const result = await finalizeGuestClaim();
    expect(result.ok).toBe(false);
    expect(mockApiRequest).toHaveBeenCalledTimes(1); // 只有拿憑證那次
  });

  it("按保存（arm）→ 登入後認領：帶憑證呼叫、清除、廣播結果、重抓紀錄", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonRes({ ticket: "t.sig" }));
    await prefetchGuestClaimTicket();
    expect(armGuestClaim()).toBe(true);
    expect(hasArmedGuestClaim()).toBe(true);

    const events: unknown[] = [];
    window.addEventListener(GUEST_CLAIMED_EVENT, (e) => events.push((e as CustomEvent).detail));
    mockApiRequest.mockResolvedValueOnce(jsonRes({ success: true, moved: { player_progress: 1 } }));

    const result = await finalizeGuestClaim();
    expect(result).toEqual({ ok: true, moved: { player_progress: 1 } });
    expect(mockApiRequest).toHaveBeenLastCalledWith("POST", "/api/me/claim-guest", { ticket: "t.sig" });
    expect(hasArmedGuestClaim()).toBe(false);
    expect(events).toContainEqual({ ok: true, moved: { player_progress: 1 } });
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["/api/sessions"] });
  });

  it("認領失敗 → 清除憑證、回報原因（不會無限重打）", async () => {
    mockApiRequest.mockResolvedValueOnce(jsonRes({ ticket: "t.sig" }));
    await prefetchGuestClaimTicket();
    armGuestClaim();
    mockApiRequest.mockRejectedValueOnce(new Error("保存連結已失效，請重新操作"));

    const result = await finalizeGuestClaim();
    expect(result).toEqual({ ok: false, message: "保存連結已失效，請重新操作" });
    expect(hasArmedGuestClaim()).toBe(false);
  });

  it("沒有憑證時 arm 失敗", () => {
    expect(armGuestClaim()).toBe(false);
  });

  it("拿憑證失敗（網路 / 非訪客）→ 回傳 false", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("只有訪客身分需要保存紀錄"));
    expect(await prefetchGuestClaimTicket()).toBe(false);
  });

  it("憑證過期（超過 25 分鐘）視為沒有", async () => {
    vi.useFakeTimers();
    try {
      mockApiRequest.mockResolvedValueOnce(jsonRes({ ticket: "t.sig" }));
      await prefetchGuestClaimTicket();
      vi.advanceTimersByTime(26 * 60 * 1000);
      expect(armGuestClaim()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
