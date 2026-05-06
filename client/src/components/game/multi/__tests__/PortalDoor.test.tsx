import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PortalDoor } from "../PortalDoor";

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

describe("PortalDoor", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-title").textContent).toBe("任意門");
  });

  it("顯示自訂標題", () => {
    render(<PortalDoor {...defaultProps} config={{ title: "我的傳送門" }} />);
    expect(screen.getByTestId("pdr-title").textContent).toBe("我的傳送門");
  });

  it("顯示預設 prompt", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-prompt").textContent).toContain("任意門");
  });

  it("顯示自訂 prompt", () => {
    render(<PortalDoor {...defaultProps} config={{ prompt: "你想去哪裡？" }} />);
    expect(screen.getByTestId("pdr-prompt").textContent).toBe("你想去哪裡？");
  });

  it("顯示已打開門數", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-form")).toBeTruthy();
  });

  it("顯示五個目的地選項", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-dest-dream_world")).toBeTruthy();
    expect(screen.getByTestId("pdr-dest-childhood")).toBeTruthy();
    expect(screen.getByTestId("pdr-dest-future")).toBeTruthy();
    expect(screen.getByTestId("pdr-dest-parallel")).toBeTruthy();
    expect(screen.getByTestId("pdr-dest-secret_garden")).toBeTruthy();
  });

  it("顯示原因輸入框", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-reason-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<PortalDoor {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pdr-reason-input"), { target: { value: "短" } });
    expect(screen.getByTestId("pdr-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<PortalDoor {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pdr-reason-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("pdr-submit-btn")).not.toBeDisabled();
  });

  it("切換目的地選擇", () => {
    render(<PortalDoor {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pdr-dest-future"));
    expect(screen.getByTestId("pdr-dest-future").className).toContain("violet");
  });

  it("提交呼叫 updateState", () => {
    render(<PortalDoor {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pdr-reason-input"), { target: { value: "我想去未來探索" } });
    fireEvent.click(screen.getByTestId("pdr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", destination: "dream_world", reason: "想去夢中世界探索" }], revealed: false };
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", destination: "dream_world", reason: "想去夢中世界探索" }], revealed: false };
    render(<PortalDoor {...defaultProps} />);
    expect(screen.queryByTestId("pdr-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<PortalDoor {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("pdr-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<PortalDoor {...defaultProps} />);
    expect(screen.queryByTestId("pdr-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", destination: "dream_world", reason: "我的任意門故事" }],
      revealed: true,
    };
    render(<PortalDoor {...defaultProps} />);
    expect(screen.getByTestId("pdr-result")).toBeTruthy();
    expect(screen.getByTestId("pdr-card-e99")).toBeTruthy();
  });
});
