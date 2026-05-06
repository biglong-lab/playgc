import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudDrift } from "../CloudDrift";

const mockUpdateState = vi.fn();
let mockState: Record<string, unknown> = { entries: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { entries: [], revealed: false };
});

describe("CloudDrift", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-title").textContent).toBe("雲朵漂移");
  });

  it("顯示自訂標題", () => {
    render(<CloudDrift {...defaultProps} config={{ title: "我的雲朵" }} />);
    expect(screen.getByTestId("cld-title").textContent).toBe("我的雲朵");
  });

  it("顯示預設 prompt", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-prompt").textContent).toContain("雲");
  });

  it("顯示自訂 prompt", () => {
    render(<CloudDrift {...defaultProps} config={{ prompt: "你的思緒如何？" }} />);
    expect(screen.getByTestId("cld-prompt").textContent).toBe("你的思緒如何？");
  });

  it("顯示已飄過雲數", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-form")).toBeTruthy();
  });

  it("顯示五種雲朵類型選項", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-cloud-cumulus")).toBeTruthy();
    expect(screen.getByTestId("cld-cloud-cirrus")).toBeTruthy();
    expect(screen.getByTestId("cld-cloud-thunder")).toBeTruthy();
    expect(screen.getByTestId("cld-cloud-sunset")).toBeTruthy();
    expect(screen.getByTestId("cld-cloud-rainbow")).toBeTruthy();
  });

  it("顯示思緒輸入框", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-thought-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<CloudDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cld-thought-input"), { target: { value: "短" } });
    expect(screen.getByTestId("cld-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<CloudDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cld-thought-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("cld-submit-btn")).not.toBeDisabled();
  });

  it("切換雲朵類型選擇", () => {
    render(<CloudDrift {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cld-cloud-cirrus"));
    expect(screen.getByTestId("cld-cloud-cirrus").className).toContain("sky");
  });

  it("提交呼叫 updateState", () => {
    render(<CloudDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cld-thought-input"), { target: { value: "我的思緒像積雲飄" } });
    fireEvent.click(screen.getByTestId("cld-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", cloudType: "cumulus", thought: "積雲般的思緒" }], revealed: false };
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", cloudType: "cumulus", thought: "積雲般的思緒" }], revealed: false };
    render(<CloudDrift {...defaultProps} />);
    expect(screen.queryByTestId("cld-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<CloudDrift {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("cld-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<CloudDrift {...defaultProps} />);
    expect(screen.queryByTestId("cld-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", cloudType: "cumulus", thought: "我的雲朵故事" }],
      revealed: true,
    };
    render(<CloudDrift {...defaultProps} />);
    expect(screen.getByTestId("cld-result")).toBeTruthy();
    expect(screen.getByTestId("cld-card-e99")).toBeTruthy();
  });
});
