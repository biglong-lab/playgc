import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SandTimer } from "../SandTimer";

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

describe("SandTimer", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-title").textContent).toBe("沙漏時光");
  });

  it("顯示自訂標題", () => {
    render(<SandTimer {...defaultProps} config={{ title: "時光沙漏" }} />);
    expect(screen.getByTestId("sdt-title").textContent).toBe("時光沙漏");
  });

  it("顯示預設 prompt", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-prompt").textContent).toContain("時間");
  });

  it("顯示自訂 prompt", () => {
    render(<SandTimer {...defaultProps} config={{ prompt: "你想定格哪一刻？" }} />);
    expect(screen.getByTestId("sdt-prompt").textContent).toBe("你想定格哪一刻？");
  });

  it("顯示已定格時刻數", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-form")).toBeTruthy();
  });

  it("顯示五個時間框架選項", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-frame-past")).toBeTruthy();
    expect(screen.getByTestId("sdt-frame-present")).toBeTruthy();
    expect(screen.getByTestId("sdt-frame-future")).toBeTruthy();
    expect(screen.getByTestId("sdt-frame-eternal")).toBeTruthy();
    expect(screen.getByTestId("sdt-frame-fleeting")).toBeTruthy();
  });

  it("顯示時刻輸入框", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-moment-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<SandTimer {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdt-moment-input"), { target: { value: "短" } });
    expect(screen.getByTestId("sdt-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<SandTimer {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdt-moment-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("sdt-submit-btn")).not.toBeDisabled();
  });

  it("切換時間框架選擇", () => {
    render(<SandTimer {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sdt-frame-past"));
    expect(screen.getByTestId("sdt-frame-past").className).toContain("orange");
  });

  it("提交呼叫 updateState", () => {
    render(<SandTimer {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdt-moment-input"), { target: { value: "現在的我很珍貴" } });
    fireEvent.click(screen.getByTestId("sdt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", timeFrame: "present", moment: "此刻最美好的當下" }], revealed: false };
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", timeFrame: "present", moment: "此刻最美好的當下" }], revealed: false };
    render(<SandTimer {...defaultProps} />);
    expect(screen.queryByTestId("sdt-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SandTimer {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sdt-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<SandTimer {...defaultProps} />);
    expect(screen.queryByTestId("sdt-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", timeFrame: "present", moment: "我的沙漏故事" }],
      revealed: true,
    };
    render(<SandTimer {...defaultProps} />);
    expect(screen.getByTestId("sdt-result")).toBeTruthy();
    expect(screen.getByTestId("sdt-card-e99")).toBeTruthy();
  });
});
