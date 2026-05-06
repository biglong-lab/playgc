import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GroupNickname } from "../GroupNickname";

let mockState: Record<string, unknown> = { stage: "submit", nicks: [], votes: [] };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

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

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { stage: "submit", nicks: [], votes: [] };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("GroupNickname", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-title").textContent).toBe("隊伍外號大徵集");
  });

  it("顯示自定義標題", () => {
    render(<GroupNickname {...defaultProps} config={{ title: "幫我們取個外號吧" }} />);
    expect(screen.getByTestId("gnn-title").textContent).toBe("幫我們取個外號吧");
  });

  it("顯示提示文字", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-prompt")).toBeTruthy();
  });

  it("顯示提名階段標示", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-stage").textContent).toContain("提名");
  });

  it("顯示提名數量", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-count").textContent).toContain("0");
  });

  it("顯示提名表單", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-form")).toBeTruthy();
  });

  it("輸入少於2字時提交按鈕禁用", () => {
    render(<GroupNickname {...defaultProps} />);
    const btn = screen.getByTestId("gnn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入2字以上後啟用提交按鈕", () => {
    render(<GroupNickname {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gnn-nick-input"), { target: { value: "閃電隊" } });
    const btn = screen.getByTestId("gnn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<GroupNickname {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gnn-nick-input"), { target: { value: "超強隊" } });
    fireEvent.click(screen.getByTestId("gnn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      nicks: Array<{ nick: string; userId: string }>;
    };
    expect(newState.nicks[0].nick).toBe("超強隊");
    expect(newState.nicks[0].userId).toBe("u1");
  });

  it("已提名後顯示我的提名區塊", () => {
    mockState = {
      stage: "submit",
      nicks: [{ entryId: "u1-1", userId: "u1", userName: "Alice", nick: "霹靂火" }],
      votes: [],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-my-nick")).toBeTruthy();
  });

  it("已提名後隱藏提名表單", () => {
    mockState = {
      stage: "submit",
      nicks: [{ entryId: "u1-1", userId: "u1", userName: "Alice", nick: "霹靂火" }],
      votes: [],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.queryByTestId("gnn-form")).toBeNull();
  });

  it("隊長看到進入投票按鈕", () => {
    render(<GroupNickname {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("gnn-advance-btn")).toBeTruthy();
  });

  it("非隊長看不到進入投票按鈕", () => {
    render(<GroupNickname {...defaultProps} />);
    expect(screen.queryByTestId("gnn-advance-btn")).toBeNull();
  });

  it("隊長點進入投票後更新 stage", () => {
    render(<GroupNickname {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("gnn-advance-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { stage: string };
    expect(newState.stage).toBe("vote");
  });

  it("投票階段顯示外號列表", () => {
    mockState = {
      stage: "vote",
      nicks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", nick: "閃電隊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", nick: "烈焰組" },
      ],
      votes: [],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-vote-list")).toBeTruthy();
    expect(screen.getByTestId("gnn-vote-item-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gnn-vote-item-u2-1")).toBeTruthy();
  });

  it("點擊外號後呼叫 updateState 加入票", () => {
    mockState = {
      stage: "vote",
      nicks: [{ entryId: "u2-1", userId: "u2", userName: "Bob", nick: "烈焰組" }],
      votes: [],
    };
    render(<GroupNickname {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gnn-vote-item-u2-1"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      votes: Array<{ userId: string; targetEntryId: string }>;
    };
    expect(newState.votes[0].userId).toBe("u1");
    expect(newState.votes[0].targetEntryId).toBe("u2-1");
  });

  it("已投票後顯示已投票提示", () => {
    mockState = {
      stage: "vote",
      nicks: [{ entryId: "u2-1", userId: "u2", userName: "Bob", nick: "烈焰組" }],
      votes: [{ userId: "u1", targetEntryId: "u2-1" }],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-my-vote")).toBeTruthy();
  });

  it("揭曉後無提名顯示 gnn-empty", () => {
    mockState = { stage: "reveal", nicks: [], votes: [] };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-empty")).toBeTruthy();
  });

  it("揭曉後顯示獲勝外號", () => {
    mockState = {
      stage: "reveal",
      nicks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", nick: "閃電隊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", nick: "烈焰組" },
      ],
      votes: [
        { userId: "u1", targetEntryId: "u2-1" },
        { userId: "u2", targetEntryId: "u2-1" },
        { userId: "u3", targetEntryId: "u1-1" },
      ],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-result")).toBeTruthy();
    expect(screen.getByTestId("gnn-winner").textContent).toContain("烈焰組");
    expect(screen.getByTestId("gnn-winner").textContent).toContain("2 票");
  });

  it("揭曉後顯示所有外號得票數", () => {
    mockState = {
      stage: "reveal",
      nicks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", nick: "閃電隊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", nick: "烈焰組" },
      ],
      votes: [{ userId: "u1", targetEntryId: "u2-1" }],
    };
    render(<GroupNickname {...defaultProps} />);
    expect(screen.getByTestId("gnn-result-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gnn-result-u2-1")).toBeTruthy();
  });
});
