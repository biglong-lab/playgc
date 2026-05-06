import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamDream } from "../TeamDream";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("TeamDream", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-title").textContent).toBe("隊伍夢想清單");
  });

  it("顯示自定義標題", () => {
    render(<TeamDream {...defaultProps} config={{ title: "我們的夢想" }} />);
    expect(screen.getByTestId("tdm-title").textContent).toBe("我們的夢想");
  });

  it("顯示預設提示文字", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<TeamDream {...defaultProps} config={{ prompt: "你希望隊伍一起完成什麼？" }} />);
    expect(screen.getByTestId("tdm-prompt").textContent).toBe("你希望隊伍一起完成什麼？");
  });

  it("顯示已分享數量", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-dream-input")).toBeTruthy();
  });

  it("顯示字數計數", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-char-count")).toBeTruthy();
    expect(screen.getByTestId("tdm-char-count").textContent).toContain("0/50");
  });

  it("輸入少於5字時提交按鈕禁用", () => {
    render(<TeamDream {...defaultProps} />);
    const btn = screen.getByTestId("tdm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入5字以上時提交按鈕啟用", () => {
    render(<TeamDream {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdm-dream-input"), {
      target: { value: "一起去看海吧" },
    });
    const btn = screen.getByTestId("tdm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("輸入後字數計數更新", () => {
    render(<TeamDream {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdm-dream-input"), {
      target: { value: "夢想" },
    });
    expect(screen.getByTestId("tdm-char-count").textContent).toContain("2/50");
  });

  it("自定義 maxLength", () => {
    render(<TeamDream {...defaultProps} config={{ maxLength: 100 }} />);
    expect(screen.getByTestId("tdm-char-count").textContent).toContain("0/100");
  });

  it("提交後呼叫 updateState", () => {
    render(<TeamDream {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdm-dream-input"), {
      target: { value: "一起去爬玉山！" },
    });
    fireEvent.click(screen.getByTestId("tdm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: Array<{ dream: string }> };
    expect(newState.entries[0].dream).toBe("一起去爬玉山！");
  });

  it("提交後記錄 userId 和 userName", () => {
    render(<TeamDream {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tdm-dream-input"), {
      target: { value: "環遊世界一圈！" },
    });
    fireEvent.click(screen.getByTestId("tdm-submit-btn"));
    const newState = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ userId: string; userName: string }>;
    };
    expect(newState.entries[0].userId).toBe("u1");
    expect(newState.entries[0].userName).toBe("Alice");
  });

  it("已有分享時顯示我的分享區塊", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", dream: "一起去旅遊" }],
      revealed: false,
    };
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-my-entry")).toBeTruthy();
  });

  it("已有分享時隱藏輸入表單", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", dream: "一起去旅遊" }],
      revealed: false,
    };
    render(<TeamDream {...defaultProps} />);
    expect(screen.queryByTestId("tdm-form")).toBeNull();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<TeamDream {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tdm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<TeamDream {...defaultProps} />);
    expect(screen.queryByTestId("tdm-reveal-btn")).toBeNull();
  });

  it("揭曉後無分享顯示 tdm-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-empty")).toBeTruthy();
  });

  it("揭曉後有分享顯示夢想牆", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", dream: "一起去海邊" }],
      revealed: true,
    };
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-result")).toBeTruthy();
  });

  it("夢想牆顯示標題", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", dream: "一起去海邊" }],
      revealed: true,
    };
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-wall-title")).toBeTruthy();
  });

  it("夢想牆顯示各條目卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", dream: "去看極光" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", dream: "去爬富士山" },
      ],
      revealed: true,
    };
    render(<TeamDream {...defaultProps} />);
    expect(screen.getByTestId("tdm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tdm-card-u2-1")).toBeTruthy();
  });
});
