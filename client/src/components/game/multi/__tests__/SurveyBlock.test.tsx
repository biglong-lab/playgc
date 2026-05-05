import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SurveyBlock } from "../SurveyBlock";

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

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

describe("SurveyBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-title").textContent).toContain("快速問卷");
    expect(screen.getByTestId("sb-prompt")).toBeTruthy();
  });

  it("顯示自訂 config", () => {
    render(
      <SurveyBlock
        {...defaultProps}
        config={{
          title: "團隊健康度調查",
          prompt: "請如實回答",
          questions: ["效率如何？"],
          options: ["好", "不好"],
        }}
      />,
    );
    expect(screen.getByTestId("sb-title").textContent).toContain("團隊健康度調查");
    expect(screen.getByTestId("sb-prompt").textContent).toContain("請如實回答");
  });

  it("顯示提交數量", () => {
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-count").textContent).toContain("0");
  });

  it("顯示問卷表單", () => {
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-form")).toBeTruthy();
    expect(screen.getByTestId("sb-submit-btn")).toBeTruthy();
  });

  it("未全部回答時提交鈕禁用", () => {
    render(<SurveyBlock {...defaultProps} />);
    expect((screen.getByTestId("sb-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選完所有選項後提交鈕啟用", () => {
    render(
      <SurveyBlock
        {...defaultProps}
        config={{ questions: ["Q1?"], options: ["是", "否"] }}
      />,
    );
    fireEvent.click(screen.getByTestId("sb-option-0-是"));
    expect((screen.getByTestId("sb-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交呼叫 updateState", () => {
    render(
      <SurveyBlock
        {...defaultProps}
        config={{ questions: ["Q1?"], options: ["是", "否"] }}
      />,
    );
    fireEvent.click(screen.getByTestId("sb-option-0-是"));
    fireEvent.click(screen.getByTestId("sb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].answers["Q1?"]).toBe("是");
  });

  it("已提交後顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", answers: { "Q1?": "是" } }],
      revealed: false,
    };
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("sb-form")).toBeNull();
  });

  it("isTeamLead=true 顯示揭示按鈕", () => {
    render(<SurveyBlock {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sb-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<SurveyBlock {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("sb-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<SurveyBlock {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("sb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示統計", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", answers: { "團隊合作效率如何？": "非常好" } }],
      revealed: true,
    };
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-result")).toBeTruthy();
    expect(screen.getByTestId("sb-stats-q-0")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<SurveyBlock {...defaultProps} />);
    expect(screen.getByTestId("sb-empty")).toBeTruthy();
  });
});
