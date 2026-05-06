import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpiralShell } from "../SpiralShell";

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

describe("SpiralShell", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-title").textContent).toBe("螺旋貝心聲");
  });

  it("顯示自訂標題", () => {
    render(<SpiralShell {...defaultProps} config={{ title: "貝殼回聲" }} />);
    expect(screen.getByTestId("sps-title").textContent).toBe("貝殼回聲");
  });

  it("顯示預設 prompt", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-prompt").textContent).toContain("貝殼");
  });

  it("顯示自訂 prompt", () => {
    render(<SpiralShell {...defaultProps} config={{ prompt: "聽見海洋的回響" }} />);
    expect(screen.getByTestId("sps-prompt").textContent).toBe("聽見海洋的回響");
  });

  it("顯示已聆聽貝殼數", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-form")).toBeTruthy();
  });

  it("顯示五種貝殼類型選項", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-shell-nautilus")).toBeTruthy();
    expect(screen.getByTestId("sps-shell-conch")).toBeTruthy();
    expect(screen.getByTestId("sps-shell-cowrie")).toBeTruthy();
    expect(screen.getByTestId("sps-shell-turban")).toBeTruthy();
    expect(screen.getByTestId("sps-shell-moon_snail")).toBeTruthy();
  });

  it("顯示回聲輸入框", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-echo-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<SpiralShell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sps-echo-input"), { target: { value: "短" } });
    expect(screen.getByTestId("sps-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<SpiralShell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sps-echo-input"), { target: { value: "貝殼裡住著我最深的秘密" } });
    expect(screen.getByTestId("sps-submit-btn")).not.toBeDisabled();
  });

  it("切換貝殼類型選擇", () => {
    render(<SpiralShell {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sps-shell-conch"));
    expect(screen.getByTestId("sps-shell-conch").className).toContain("teal");
  });

  it("提交呼叫 updateState", () => {
    render(<SpiralShell {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sps-echo-input"), { target: { value: "法螺的聲音傳遞著我的心聲" } });
    fireEvent.click(screen.getByTestId("sps-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", shellType: "moon_snail", echo: "月螺的靜謐讓我找到內心的平靜" }], revealed: false };
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", shellType: "moon_snail", echo: "月螺的靜謐讓我找到內心的平靜" }], revealed: false };
    render(<SpiralShell {...defaultProps} />);
    expect(screen.queryByTestId("sps-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SpiralShell {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sps-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<SpiralShell {...defaultProps} />);
    expect(screen.queryByTestId("sps-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", shellType: "nautilus", echo: "鸚鵡螺的螺旋代表我無限成長的心" }],
      revealed: true,
    };
    render(<SpiralShell {...defaultProps} />);
    expect(screen.getByTestId("sps-result")).toBeTruthy();
    expect(screen.getByTestId("sps-card-e99")).toBeTruthy();
  });
});
