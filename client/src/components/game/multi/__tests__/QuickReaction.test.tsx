import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickReaction } from "../QuickReaction";

let mockState: Record<string, unknown> = {};
const mockUpdateState = vi.fn((s: unknown) => { mockState = s as Record<string, unknown>; });
let mockIsLoaded = true;

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  config: { title: "快速反應", prompt: "你的感受？" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLoaded = true;
  mockState = { prompt: "你的感受？", reactions: [], revealed: false };
});

describe("QuickReaction", () => {
  it("顯示標題和提示", () => {
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-title")).toHaveTextContent("快速反應");
    expect(screen.getByTestId("qr-prompt")).toHaveTextContent("你的感受？");
  });

  it("顯示已反應人數", () => {
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-count")).toHaveTextContent("0");
  });

  it("未反應前顯示 emoji 格子", () => {
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-emoji-grid")).toBeInTheDocument();
    expect(screen.getByTestId("qr-emoji-👍")).toBeInTheDocument();
  });

  it("點擊 emoji 呼叫 updateState 並帶入正確 emoji", () => {
    render(<QuickReaction {...defaultProps} />);
    fireEvent.click(screen.getByTestId("qr-emoji-👍"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const called = mockUpdateState.mock.calls[0][0] as { reactions: { emoji: string }[] };
    expect(called.reactions[0].emoji).toBe("👍");
  });

  it("已反應後顯示我的反應 badge", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [{ reactionId: "r1", userId: "u1", userName: "Alice", emoji: "🎉" }],
      revealed: false,
    };
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-my-reaction")).toBeInTheDocument();
    expect(screen.getByTestId("qr-my-reaction")).toHaveTextContent("🎉");
  });

  it("已反應後不再顯示 emoji 格子", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [{ reactionId: "r1", userId: "u1", userName: "Alice", emoji: "🎉" }],
      revealed: false,
    };
    render(<QuickReaction {...defaultProps} />);
    expect(screen.queryByTestId("qr-emoji-grid")).not.toBeInTheDocument();
  });

  it("isTeamLead + 已反應 → 顯示公布結果按鈕", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [{ reactionId: "r1", userId: "u1", userName: "Alice", emoji: "👍" }],
      revealed: false,
    };
    render(<QuickReaction {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("qr-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長不顯示公布結果按鈕", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [{ reactionId: "r1", userId: "u1", userName: "Alice", emoji: "👍" }],
      revealed: false,
    };
    render(<QuickReaction {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("qr-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊公布結果呼叫 updateState revealed=true", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [{ reactionId: "r1", userId: "u1", userName: "Alice", emoji: "👍" }],
      revealed: false,
    };
    render(<QuickReaction {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("qr-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示結果區塊含 emoji bar", () => {
    mockState = {
      prompt: "你的感受？",
      reactions: [
        { reactionId: "r1", userId: "u1", userName: "Alice", emoji: "👍" },
        { reactionId: "r2", userId: "u2", userName: "Bob", emoji: "👍" },
        { reactionId: "r3", userId: "u3", userName: "Cathy", emoji: "❤️" },
      ],
      revealed: true,
    };
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-result")).toBeInTheDocument();
    expect(screen.getByTestId("qr-bar-👍")).toBeInTheDocument();
    expect(screen.getByTestId("qr-bar-❤️")).toBeInTheDocument();
  });

  it("revealed + 無反應顯示 empty 提示", () => {
    mockState = { prompt: "你的感受？", reactions: [], revealed: true };
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-empty")).toBeInTheDocument();
  });

  it("isLoaded=false 顯示 loading spinner", () => {
    mockIsLoaded = false;
    render(<QuickReaction {...defaultProps} />);
    expect(screen.getByTestId("qr-loading")).toBeInTheDocument();
  });
});
