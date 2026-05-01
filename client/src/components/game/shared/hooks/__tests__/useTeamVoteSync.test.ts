// useTeamVoteSync 單元測試
//
// 覆蓋：
//   - 純函式 helpers：parseOptionIndex / buildOptionId / mapServerBallots
//   - hook 行為：ensureVote 找現有 / 建立新 / WebSocket 訊息處理 / castVote API 呼叫

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useTeamVoteSync,
  parseOptionIndex,
  buildOptionId,
  mapServerBallots,
} from "../useTeamVoteSync";
import type { VoteConfig } from "@shared/schema";

// Mock apiRequest
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "@/lib/queryClient";
const mockApiRequest = vi.mocked(apiRequest);

// ============================================================================
// 純函式 helpers
// ============================================================================

describe("parseOptionIndex", () => {
  it("正常 option_3 → 3", () => {
    expect(parseOptionIndex("option_3")).toBe(3);
    expect(parseOptionIndex("option_0")).toBe(0);
  });

  it("格式錯誤 → -1", () => {
    expect(parseOptionIndex("invalid")).toBe(-1);
    expect(parseOptionIndex("option_abc")).toBe(-1);
    expect(parseOptionIndex("")).toBe(-1);
  });
});

describe("buildOptionId", () => {
  it("數字 → option_N 字串", () => {
    expect(buildOptionId(0)).toBe("option_0");
    expect(buildOptionId(5)).toBe("option_5");
  });
});

describe("mapServerBallots", () => {
  it("server ballots → VoteTeam ballots（optionId → optionIndex）", () => {
    const result = mapServerBallots([
      {
        id: "b1",
        voteId: "v1",
        userId: "u1",
        optionId: "option_2",
        createdAt: "2026-05-01T10:00:00Z",
      },
      {
        id: "b2",
        voteId: "v1",
        userId: "u2",
        optionId: "option_0",
        createdAt: "2026-05-01T10:01:00Z",
      },
    ]);
    expect(result).toEqual([
      { userId: "u1", optionIndex: 2, votedAt: "2026-05-01T10:00:00Z" },
      { userId: "u2", optionIndex: 0, votedAt: "2026-05-01T10:01:00Z" },
    ]);
  });

  it("空陣列 → 空陣列", () => {
    expect(mapServerBallots([])).toEqual([]);
  });
});

// ============================================================================
// Hook 行為
// ============================================================================

const config: VoteConfig = {
  title: "晚餐？",
  question: "選一個",
  options: [
    { text: "麵", nextPageId: "p-noodle" },
    { text: "飯", nextPageId: "p-rice" },
  ],
};

const baseOptions = {
  teamId: "team-1",
  pageId: "page-1",
  config,
  votingMode: "majority" as const,
  totalMembers: 4,
};

/** 工具：建立 mock Response */
function mockResponse<T>(data: T) {
  return {
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

describe("useTeamVoteSync hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ensureVote 找到現有 active vote → setVoteId + 載入 ballots", async () => {
    mockApiRequest.mockResolvedValueOnce(
      mockResponse([
        {
          id: "vote-existing",
          teamId: "team-1",
          pageId: "page-1",
          title: "晚餐？",
          options: [],
          votingMode: "majority",
          status: "active",
          expiresAt: null,
          createdAt: "2026-05-01",
          ballots: [
            {
              id: "b1",
              voteId: "vote-existing",
              userId: "u1",
              optionId: "option_0",
              createdAt: "2026-05-01",
            },
          ],
        },
      ]),
    );

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    expect(mockApiRequest).toHaveBeenCalledWith(
      "GET",
      "/api/teams/team-1/votes",
    );
    expect(result.current.voteId).toBe("vote-existing");
    expect(result.current.voteState?.ballots).toHaveLength(1);
    expect(result.current.voteState?.ballots[0].userId).toBe("u1");
  });

  it("ensureVote 找不到 → POST 建立新 vote", async () => {
    mockApiRequest
      .mockResolvedValueOnce(mockResponse([])) // GET：沒有現存
      .mockResolvedValueOnce(
        mockResponse({
          id: "vote-new",
          teamId: "team-1",
          pageId: "page-1",
          title: "晚餐？",
          options: [],
          votingMode: "majority",
          status: "active",
          expiresAt: null,
          createdAt: "2026-05-01",
        }),
      );

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    expect(mockApiRequest).toHaveBeenCalledTimes(2);
    expect(mockApiRequest).toHaveBeenLastCalledWith(
      "POST",
      "/api/teams/team-1/votes",
      expect.objectContaining({
        title: "晚餐？",
        votingMode: "majority",
        pageId: "page-1",
      }),
    );
    expect(result.current.voteId).toBe("vote-new");
    expect(result.current.voteState?.ballots).toEqual([]);
  });

  it("ensureVote idempotent — 重複呼叫只執行一次", async () => {
    mockApiRequest.mockResolvedValue(
      mockResponse([
        {
          id: "vote-1",
          teamId: "team-1",
          pageId: "page-1",
          status: "active",
          ballots: [],
          options: [],
          votingMode: "majority",
        },
      ]),
    );

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
      await result.current.ensureVote(); // 第二次
      await result.current.ensureVote(); // 第三次
    });

    // GET 只被呼叫一次
    expect(mockApiRequest).toHaveBeenCalledTimes(1);
  });

  it("castVote 沒 voteId 時拋錯", async () => {
    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await expect(
      act(async () => {
        await result.current.castVote(0);
      }),
    ).rejects.toThrow("投票尚未建立");
  });

  it("castVote 有 voteId 時 POST cast 帶正確 optionId", async () => {
    // ensureVote → 找到現有
    mockApiRequest.mockResolvedValueOnce(
      mockResponse([
        {
          id: "vote-1",
          teamId: "team-1",
          pageId: "page-1",
          status: "active",
          ballots: [],
          options: [],
          votingMode: "majority",
        },
      ]),
    );
    // castVote 的 POST
    mockApiRequest.mockResolvedValueOnce(mockResponse({}));

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    await act(async () => {
      await result.current.castVote(1);
    });

    expect(mockApiRequest).toHaveBeenLastCalledWith(
      "POST",
      "/api/votes/vote-1/cast",
      { optionId: "option_1" },
    );
  });

  it("WebSocket vote_cast 訊息 → 加進 ballots", async () => {
    mockApiRequest.mockResolvedValueOnce(
      mockResponse([
        {
          id: "vote-1",
          teamId: "team-1",
          pageId: "page-1",
          status: "active",
          ballots: [],
          options: [],
          votingMode: "majority",
        },
      ]),
    );

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    act(() => {
      result.current.handleWsMessage({
        type: "vote_cast",
        voteId: "vote-1",
        userId: "u-other",
        optionId: "option_1",
      });
    });

    expect(result.current.voteState?.ballots).toHaveLength(1);
    expect(result.current.voteState?.ballots[0]).toMatchObject({
      userId: "u-other",
      optionIndex: 1,
    });
  });

  it("WebSocket vote_cast 同 user 不重複加（防重）", async () => {
    mockApiRequest.mockResolvedValueOnce(
      mockResponse([
        {
          id: "vote-1",
          teamId: "team-1",
          pageId: "page-1",
          status: "active",
          ballots: [],
          options: [],
          votingMode: "majority",
        },
      ]),
    );

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    act(() => {
      result.current.handleWsMessage({
        type: "vote_cast",
        voteId: "vote-1",
        userId: "u-other",
        optionId: "option_1",
      });
      // 重複訊息
      result.current.handleWsMessage({
        type: "vote_cast",
        voteId: "vote-1",
        userId: "u-other",
        optionId: "option_0",
      });
    });

    expect(result.current.voteState?.ballots).toHaveLength(1);
  });

  it("WebSocket vote_created 訊息 → 採用該 vote", async () => {
    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    expect(result.current.voteId).toBeUndefined();

    act(() => {
      result.current.handleWsMessage({
        type: "vote_created",
        vote: {
          id: "vote-from-ws",
          teamId: "team-1",
          pageId: "page-1", // 同 pageId
          title: "",
          options: [],
          votingMode: "majority",
          status: "active",
          expiresAt: null,
          createdAt: "",
        },
      });
    });

    expect(result.current.voteId).toBe("vote-from-ws");
  });

  it("WebSocket vote_created 不同 pageId → 忽略", async () => {
    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    act(() => {
      result.current.handleWsMessage({
        type: "vote_created",
        vote: {
          id: "vote-other-page",
          teamId: "team-1",
          pageId: "different-page",
          title: "",
          options: [],
          votingMode: "majority",
          status: "active",
          expiresAt: null,
          createdAt: "",
        },
      });
    });

    expect(result.current.voteId).toBeUndefined();
  });

  it("enabled=false 時 ensureVote 不發 request", async () => {
    const { result } = renderHook(() =>
      useTeamVoteSync({ ...baseOptions, enabled: false }),
    );

    await act(async () => {
      await result.current.ensureVote();
    });

    expect(mockApiRequest).not.toHaveBeenCalled();
  });

  it("ensureVote 失敗時 setError 且允許重試", async () => {
    mockApiRequest.mockRejectedValueOnce(new Error("網路斷"));

    const { result } = renderHook(() => useTeamVoteSync(baseOptions));

    await act(async () => {
      await result.current.ensureVote();
    });

    await waitFor(() => expect(result.current.error).toBe("網路斷"));

    // 失敗後 ensuredRef 重置，可以重試
    mockApiRequest.mockResolvedValueOnce(
      mockResponse([
        {
          id: "vote-retry",
          teamId: "team-1",
          pageId: "page-1",
          status: "active",
          ballots: [],
          options: [],
          votingMode: "majority",
        },
      ]),
    );

    await act(async () => {
      await result.current.ensureVote();
    });

    expect(result.current.voteId).toBe("vote-retry");
    expect(result.current.error).toBe(null);
  });
});
