import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RocketLaunch } from "../RocketLaunch";

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

describe("RocketLaunch", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-title").textContent).toBe("火箭發射");
  });

  it("顯示自訂標題", () => {
    render(<RocketLaunch {...defaultProps} config={{ title: "任務發射台" }} />);
    expect(screen.getByTestId("rkl-title").textContent).toBe("任務發射台");
  });

  it("顯示預設 prompt", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-prompt").textContent).toContain("發射");
  });

  it("顯示自訂 prompt", () => {
    render(<RocketLaunch {...defaultProps} config={{ prompt: "你的任務是什麼？" }} />);
    expect(screen.getByTestId("rkl-prompt").textContent).toBe("你的任務是什麼？");
  });

  it("顯示已發射火箭數", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-form")).toBeTruthy();
  });

  it("顯示五個發射階段選項", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-stage-prep")).toBeTruthy();
    expect(screen.getByTestId("rkl-stage-countdown")).toBeTruthy();
    expect(screen.getByTestId("rkl-stage-ignite")).toBeTruthy();
    expect(screen.getByTestId("rkl-stage-liftoff")).toBeTruthy();
    expect(screen.getByTestId("rkl-stage-orbit")).toBeTruthy();
  });

  it("顯示任務輸入框", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-mission-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<RocketLaunch {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rkl-mission-input"), { target: { value: "短" } });
    expect(screen.getByTestId("rkl-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<RocketLaunch {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rkl-mission-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("rkl-submit-btn")).not.toBeDisabled();
  });

  it("切換發射階段選擇", () => {
    render(<RocketLaunch {...defaultProps} />);
    fireEvent.click(screen.getByTestId("rkl-stage-liftoff"));
    expect(screen.getByTestId("rkl-stage-liftoff").className).toContain("indigo");
  });

  it("提交呼叫 updateState", () => {
    render(<RocketLaunch {...defaultProps} />);
    fireEvent.change(screen.getByTestId("rkl-mission-input"), { target: { value: "我的火箭任務是探索" } });
    fireEvent.click(screen.getByTestId("rkl-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", stage: "prep", mission: "準備中的任務" }], revealed: false };
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", stage: "prep", mission: "準備中的任務" }], revealed: false };
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.queryByTestId("rkl-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<RocketLaunch {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("rkl-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.queryByTestId("rkl-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", stage: "liftoff", mission: "我的火箭任務故事" }],
      revealed: true,
    };
    render(<RocketLaunch {...defaultProps} />);
    expect(screen.getByTestId("rkl-result")).toBeTruthy();
    expect(screen.getByTestId("rkl-card-e99")).toBeTruthy();
  });
});
