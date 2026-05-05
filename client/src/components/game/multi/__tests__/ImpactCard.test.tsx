import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImpactCard } from "../ImpactCard";

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

describe("ImpactCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-title").textContent).toContain("影響力卡片");
    expect(screen.getByTestId("ic-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <ImpactCard
        {...defaultProps}
        config={{ title: "我的貢獻卡", prompt: "你帶來什麼？" }}
      />,
    );
    expect(screen.getByTestId("ic-title").textContent).toContain("我的貢獻卡");
    expect(screen.getByTestId("ic-prompt").textContent).toContain("你帶來什麼？");
  });

  it("顯示卡片數量", () => {
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-count").textContent).toContain("0");
  });

  it("顯示兩個輸入欄", () => {
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-achievement-input")).toBeTruthy();
    expect(screen.getByTestId("ic-skill-input")).toBeTruthy();
    expect(screen.getByTestId("ic-submit-btn")).toBeTruthy();
  });

  it("兩欄皆空時提交鈕禁用", () => {
    render(<ImpactCard {...defaultProps} />);
    const btn = screen.getByTestId("ic-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填一欄時提交鈕禁用", () => {
    render(<ImpactCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ic-achievement-input"), { target: { value: "完成 MVP" } });
    const btn = screen.getByTestId("ic-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("兩欄都填後提交", () => {
    render(<ImpactCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ic-achievement-input"), { target: { value: "帶領 10 人團隊" } });
    fireEvent.change(screen.getByTestId("ic-skill-input"), { target: { value: "領導力" } });
    fireEvent.click(screen.getByTestId("ic-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].achievement).toBe("帶領 10 人團隊");
    expect(arg.entries[0].skill).toBe("領導力");
  });

  it("已提交顯示我的卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", achievement: "成就A", skill: "技能A" }],
      revealed: false,
    };
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-my-card")).toBeTruthy();
    expect(screen.queryByTestId("ic-achievement-input")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ImpactCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ic-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<ImpactCard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("ic-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<ImpactCard {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ic-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示卡片牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", achievement: "成就A", skill: "技能A" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", achievement: "成就B", skill: "技能B" },
      ],
      revealed: true,
    };
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-result")).toBeTruthy();
    expect(screen.getByTestId("ic-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ic-card-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ImpactCard {...defaultProps} />);
    expect(screen.getByTestId("ic-empty")).toBeTruthy();
  });
});
