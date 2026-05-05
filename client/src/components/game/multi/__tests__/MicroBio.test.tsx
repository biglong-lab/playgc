import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MicroBio } from "../MicroBio";

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

describe("MicroBio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-title").textContent).toContain("迷你履歷");
    expect(screen.getByTestId("mb-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <MicroBio
        {...defaultProps}
        config={{ title: "我的名片", prompt: "說說你自己！" }}
      />,
    );
    expect(screen.getByTestId("mb-title").textContent).toContain("我的名片");
    expect(screen.getByTestId("mb-prompt").textContent).toContain("說說你自己！");
  });

  it("顯示履歷數量", () => {
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-count").textContent).toContain("0");
  });

  it("顯示三個輸入欄", () => {
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-superpower-input")).toBeTruthy();
    expect(screen.getByTestId("mb-funfact-input")).toBeTruthy();
    expect(screen.getByTestId("mb-goal-input")).toBeTruthy();
    expect(screen.getByTestId("mb-submit-btn")).toBeTruthy();
  });

  it("三欄皆空時提交鈕禁用", () => {
    render(<MicroBio {...defaultProps} />);
    const btn = screen.getByTestId("mb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填部分欄位時提交鈕禁用", () => {
    render(<MicroBio {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mb-superpower-input"), { target: { value: "快速學習" } });
    fireEvent.change(screen.getByTestId("mb-funfact-input"), { target: { value: "養了三隻貓" } });
    const btn = screen.getByTestId("mb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("三欄都填後提交", () => {
    render(<MicroBio {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mb-superpower-input"), { target: { value: "快速學習" } });
    fireEvent.change(screen.getByTestId("mb-funfact-input"), { target: { value: "養了三隻貓" } });
    fireEvent.change(screen.getByTestId("mb-goal-input"), { target: { value: "成為工程師" } });
    fireEvent.click(screen.getByTestId("mb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].superpower).toBe("快速學習");
    expect(arg.entries[0].funFact).toBe("養了三隻貓");
    expect(arg.entries[0].goal).toBe("成為工程師");
  });

  it("已提交顯示我的卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", superpower: "快速學習", funFact: "養了三隻貓", goal: "成為工程師" }],
      revealed: false,
    };
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-my-card")).toBeTruthy();
    expect(screen.queryByTestId("mb-superpower-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<MicroBio {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mb-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<MicroBio {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mb-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<MicroBio {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("mb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示履歷卡片牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", superpower: "超能力A", funFact: "冷知識A", goal: "目標A" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", superpower: "超能力B", funFact: "冷知識B", goal: "目標B" },
      ],
      revealed: true,
    };
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-result")).toBeTruthy();
    expect(screen.getByTestId("mb-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mb-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<MicroBio {...defaultProps} />);
    expect(screen.getByTestId("mb-empty")).toBeTruthy();
  });
});
