// RelayMission 單元測試
//
// 覆蓋：
//   - 純函式：pickPlayerForSegment / isSegmentAnswerCorrect
//   - 元件：all-complete / 主畫面（輪到自己 / 等待隊友）
//   - 互動：提交答案 / 空字串不觸發 / Enter 鍵提交 / 點繼續觸發 onComplete

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RelayMission, {
  pickPlayerForSegment,
  isSegmentAnswerCorrect,
} from "../RelayMission";
import type { RelayMissionConfig } from "@shared/schema";

// ============================================================================
// 純函式
// ============================================================================

describe("pickPlayerForSegment", () => {
  it("回傳值在 memberUserIds 範圍內", () => {
    const members = ["u1", "u2", "u3"];
    const owner = pickPlayerForSegment(0, members, "session-1");
    expect(members).toContain(owner);
  });

  it("空成員陣列回 null", () => {
    expect(pickPlayerForSegment(0, [], "session-x")).toBeNull();
  });

  it("同 segmentIndex + sessionId + members → 永遠同一玩家（穩定）", () => {
    const members = ["u1", "u2", "u3", "u4"];
    const a = pickPlayerForSegment(2, members, "session-x");
    const b = pickPlayerForSegment(2, members, "session-x");
    expect(a).toBe(b);
  });

  it("不同 segmentIndex 通常分到不同玩家（公平打散）", () => {
    const members = ["u1", "u2", "u3", "u4"];
    const owners = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const o = pickPlayerForSegment(i, members, "session-x");
      if (o) owners.add(o);
    }
    // 10 段分 4 玩家應分到至少 2 位（簡單分散性檢查）
    expect(owners.size).toBeGreaterThanOrEqual(2);
  });

  it("玩家數 < 段數時，部分玩家會負責多段（重複分配）", () => {
    const members = ["u1", "u2"];
    const owners: string[] = [];
    for (let i = 0; i < 5; i++) {
      const o = pickPlayerForSegment(i, members, "session-x");
      if (o) owners.push(o);
    }
    // 5 段分 2 玩家 → 一定有重複
    expect(owners.length).toBe(5);
    expect(new Set(owners).size).toBeLessThanOrEqual(2);
  });
});

describe("isSegmentAnswerCorrect", () => {
  it("正規化後相同 → true（trim + lowercase）", () => {
    expect(isSegmentAnswerCorrect("  HELLO  ", "hello")).toBe(true);
    expect(isSegmentAnswerCorrect("ABC", "abc")).toBe(true);
  });

  it("不同字串 → false", () => {
    expect(isSegmentAnswerCorrect("hello", "world")).toBe(false);
  });

  it("空字串都 false（除非 expected 也空）", () => {
    expect(isSegmentAnswerCorrect("", "answer")).toBe(false);
    expect(isSegmentAnswerCorrect("", "")).toBe(true);
  });
});

// ============================================================================
// 元件渲染
// ============================================================================

const baseConfig: RelayMissionConfig = {
  title: "三段接力",
  segments: [
    { title: "第一段", prompt: "請輸入 A", answer: "A" },
    { title: "第二段", prompt: "請輸入 B", answer: "B" },
    { title: "第三段", prompt: "請輸入 C", answer: "C" },
  ],
};

const baseProps = {
  config: baseConfig,
  myUserId: "u1",
  sessionId: "session-test",
  memberUserIds: ["u1", "u2", "u3"],
  currentSegmentIndex: 0,
  completedSegments: [],
  isAllComplete: false,
  onSubmitAnswer: vi.fn(),
  onComplete: vi.fn(),
};

describe("RelayMission 元件渲染", () => {
  it("isAllComplete → 顯示完成畫面 + Trophy", () => {
    render(<RelayMission {...baseProps} isAllComplete />);
    expect(screen.getByTestId("relay-mission-all-complete")).toBeInTheDocument();
    expect(screen.getByText(/接力完成/)).toBeInTheDocument();
  });

  it("主畫面顯示標題 + 進度條 N 段", () => {
    render(<RelayMission {...baseProps} />);
    expect(screen.getByTestId("relay-mission")).toBeInTheDocument();
    expect(screen.getByText("三段接力")).toBeInTheDocument();
    expect(screen.getByText(/第 1 \/ 3 段/)).toBeInTheDocument();
  });

  it("進度條每段都有對應 dot（current / done / pending 狀態）", () => {
    render(
      <RelayMission
        {...baseProps}
        currentSegmentIndex={1}
        completedSegments={[{ segmentIndex: 0, completedBy: "u2" }]}
      />,
    );
    expect(screen.getByTestId("relay-segment-dot-0-done")).toBeInTheDocument();
    expect(screen.getByTestId("relay-segment-dot-1-current")).toBeInTheDocument();
    expect(screen.getByTestId("relay-segment-dot-2")).toBeInTheDocument();
  });

  it("已完成段顯示在「已完成」區塊", () => {
    render(
      <RelayMission
        {...baseProps}
        currentSegmentIndex={2}
        completedSegments={[
          { segmentIndex: 0, completedBy: "u2" },
          { segmentIndex: 1, completedBy: "u1" },
        ]}
      />,
    );
    expect(screen.getByTestId("relay-completed-0")).toBeInTheDocument();
    expect(screen.getByTestId("relay-completed-1")).toBeInTheDocument();
  });
});

// ============================================================================
// 輪到自己 vs 等待隊友
// ============================================================================

describe("RelayMission 輪到誰", () => {
  // 用穩定 hash 驗證：對 session-test，segment 0 落在 u1 / u2 / u3 中其一
  it("輪到自己時顯示題目 + 輸入框 + 提交按鈕", () => {
    const owner = pickPlayerForSegment(0, ["u1", "u2", "u3"], "session-test");
    render(<RelayMission {...baseProps} myUserId={owner ?? "u1"} />);
    expect(screen.getByText("輪到你了")).toBeInTheDocument();
    expect(screen.getByTestId("relay-segment-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("relay-segment-input")).toBeInTheDocument();
    expect(screen.getByTestId("btn-relay-submit")).toBeInTheDocument();
  });

  it("不是自己 → 顯示等待隊友完成 + 無輸入框", () => {
    // 強迫設一個不在隊伍裡的 userId 確保不輪到自己
    render(<RelayMission {...baseProps} myUserId="not-in-team" />);
    expect(screen.getByText(/等待隊友完成/)).toBeInTheDocument();
    expect(screen.queryByTestId("relay-segment-input")).not.toBeInTheDocument();
  });
});

// ============================================================================
// 互動
// ============================================================================

describe("RelayMission 互動", () => {
  it("輪到自己 + 輸入文字 + 點提交 → 觸發 onSubmitAnswer", () => {
    const onSubmit = vi.fn();
    const owner = pickPlayerForSegment(0, ["u1", "u2", "u3"], "session-test");
    render(
      <RelayMission
        {...baseProps}
        myUserId={owner ?? "u1"}
        onSubmitAnswer={onSubmit}
      />,
    );
    const input = screen.getByTestId("relay-segment-input");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.click(screen.getByTestId("btn-relay-submit"));
    expect(onSubmit).toHaveBeenCalledWith(0, "A");
  });

  it("空輸入 → 提交按鈕 disabled", () => {
    const owner = pickPlayerForSegment(0, ["u1", "u2", "u3"], "session-test");
    render(<RelayMission {...baseProps} myUserId={owner ?? "u1"} />);
    expect(screen.getByTestId("btn-relay-submit")).toBeDisabled();
  });

  it("Enter 鍵提交答案", () => {
    const onSubmit = vi.fn();
    const owner = pickPlayerForSegment(0, ["u1", "u2", "u3"], "session-test");
    render(
      <RelayMission
        {...baseProps}
        myUserId={owner ?? "u1"}
        onSubmitAnswer={onSubmit}
      />,
    );
    const input = screen.getByTestId("relay-segment-input");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith(0, "A");
  });

  it("全部完成 + 點繼續 → 觸發 onComplete 帶 reward + nextPageId", () => {
    const onComplete = vi.fn();
    const config: RelayMissionConfig = {
      ...baseConfig,
      rewardPoints: 100,
      nextPageId: "page-next",
    };
    render(
      <RelayMission
        {...baseProps}
        config={config}
        isAllComplete
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-relay-continue"));
    expect(onComplete).toHaveBeenCalledWith({ points: 100 }, "page-next");
  });
});
