import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TwoWords } from "../TwoWords";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

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
};

describe("TwoWords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-title").textContent).toContain("兩個字");
    expect(screen.getByTestId("tw-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <TwoWords
        {...defaultProps}
        config={{ title: "三字訣", prompt: "用三個字描述這次旅程" }}
      />,
    );
    expect(screen.getByTestId("tw-title").textContent).toContain("三字訣");
    expect(screen.getByTestId("tw-prompt").textContent).toContain("用三個字描述這次旅程");
  });

  it("顯示提交數量", () => {
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-count").textContent).toContain("0");
  });

  it("顯示兩個字輸入欄", () => {
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-word-a-input")).toBeTruthy();
    expect(screen.getByTestId("tw-word-b-input")).toBeTruthy();
    expect(screen.getByTestId("tw-submit-btn")).toBeTruthy();
  });

  it("兩欄皆空時提交鈕禁用", () => {
    render(<TwoWords {...defaultProps} />);
    const btn = screen.getByTestId("tw-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填一欄時提交鈕仍禁用", () => {
    render(<TwoWords {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tw-word-a-input"), { target: { value: "創新" } });
    const btn = screen.getByTestId("tw-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("兩欄都填後提交", () => {
    render(<TwoWords {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tw-word-a-input"), { target: { value: "超越" } });
    fireEvent.change(screen.getByTestId("tw-word-b-input"), { target: { value: "自我" } });
    fireEvent.click(screen.getByTestId("tw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].wordA).toBe("超越");
    expect(arg.entries[0].wordB).toBe("自我");
  });

  it("已提交顯示我的回應，隱藏輸入", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", wordA: "活力", wordB: "滿滿" }],
      revealed: false,
    };
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("tw-word-a-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<TwoWords {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("tw-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<TwoWords {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tw-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<TwoWords {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tw-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示所有卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wordA: "挑戰", wordB: "成長" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", wordA: "合作", wordB: "共贏" },
      ],
      revealed: true,
    };
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-result")).toBeTruthy();
    expect(screen.getByTestId("tw-entry-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tw-entry-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<TwoWords {...defaultProps} />);
    expect(screen.getByTestId("tw-empty")).toBeTruthy();
  });
});
