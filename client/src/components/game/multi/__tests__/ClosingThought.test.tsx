import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClosingThought } from "../ClosingThought";

let mockState: Record<string, unknown> = { thoughts: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { thoughts: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("ClosingThought", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-title").textContent).toBe("結語時刻");
  });

  it("顯示自定義標題", () => {
    render(<ClosingThought {...defaultProps} config={{ title: "最後的話" }} />);
    expect(screen.getByTestId("clt-title").textContent).toBe("最後的話");
  });

  it("顯示提示文字", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<ClosingThought {...defaultProps} config={{ prompt: "說出你的感想" }} />);
    expect(screen.getByTestId("clt-prompt").textContent).toBe("說出你的感想");
  });

  it("顯示已分享人數", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-thought-input")).toBeTruthy();
  });

  it("未填時提交按鈕禁用", () => {
    render(<ClosingThought {...defaultProps} />);
    expect((screen.getByTestId("clt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<ClosingThought {...defaultProps} />);
    fireEvent.change(screen.getByTestId("clt-thought-input"), { target: { value: "好" } });
    expect((screen.getByTestId("clt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<ClosingThought {...defaultProps} />);
    fireEvent.change(screen.getByTestId("clt-thought-input"), { target: { value: "今天活動很棒謝謝" } });
    expect((screen.getByTestId("clt-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 thought", () => {
    render(<ClosingThought {...defaultProps} />);
    fireEvent.change(screen.getByTestId("clt-thought-input"), { target: { value: "這次活動讓我獲益良多" } });
    fireEvent.click(screen.getByTestId("clt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { thoughts: Array<{ userId: string; thought: string }> };
    expect(s.thoughts[0].userId).toBe("u1");
    expect(s.thoughts[0].thought).toBe("這次活動讓我獲益良多");
  });

  it("已提交後顯示我的結語", () => {
    mockState = { thoughts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", thought: "很棒的一天" }], revealed: false };
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { thoughts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", thought: "很棒的一天" }], revealed: false };
    render(<ClosingThought {...defaultProps} />);
    expect(screen.queryByTestId("clt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ClosingThought {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("clt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ClosingThought {...defaultProps} />);
    expect(screen.queryByTestId("clt-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 clt-empty", () => {
    mockState = { thoughts: [], revealed: true };
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊結語牆", () => {
    mockState = {
      thoughts: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", thought: "大家都很棒" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", thought: "期待下次相聚" },
      ],
      revealed: true,
    };
    render(<ClosingThought {...defaultProps} />);
    expect(screen.getByTestId("clt-result")).toBeTruthy();
    expect(screen.getByTestId("clt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("clt-card-u2-1")).toBeTruthy();
  });
});
