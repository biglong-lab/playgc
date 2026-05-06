import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LighthouseBeam } from "../LighthouseBeam";

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

describe("LighthouseBeam", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-title").textContent).toBe("燈塔光束");
  });

  it("顯示自訂標題", () => {
    render(<LighthouseBeam {...defaultProps} config={{ title: "指引之光" }} />);
    expect(screen.getByTestId("lhb-title").textContent).toBe("指引之光");
  });

  it("顯示預設 prompt", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-prompt").textContent).toContain("燈塔");
  });

  it("顯示自訂 prompt", () => {
    render(<LighthouseBeam {...defaultProps} config={{ prompt: "什麼照亮了你？" }} />);
    expect(screen.getByTestId("lhb-prompt").textContent).toBe("什麼照亮了你？");
  });

  it("顯示已點亮光束數", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-form")).toBeTruthy();
  });

  it("顯示五種光束方向選項", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-dir-family")).toBeTruthy();
    expect(screen.getByTestId("lhb-dir-work")).toBeTruthy();
    expect(screen.getByTestId("lhb-dir-learning")).toBeTruthy();
    expect(screen.getByTestId("lhb-dir-health")).toBeTruthy();
    expect(screen.getByTestId("lhb-dir-dream")).toBeTruthy();
  });

  it("顯示引導輸入框", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-guidance-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<LighthouseBeam {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lhb-guidance-input"), { target: { value: "短" } });
    expect(screen.getByTestId("lhb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<LighthouseBeam {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lhb-guidance-input"), { target: { value: "五個字以上的引導" } });
    expect(screen.getByTestId("lhb-submit-btn")).not.toBeDisabled();
  });

  it("切換光束方向選擇", () => {
    render(<LighthouseBeam {...defaultProps} />);
    fireEvent.click(screen.getByTestId("lhb-dir-work"));
    expect(screen.getByTestId("lhb-dir-work").className).toContain("teal");
  });

  it("提交呼叫 updateState", () => {
    render(<LighthouseBeam {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lhb-guidance-input"), { target: { value: "家人是我最大的依靠" } });
    fireEvent.click(screen.getByTestId("lhb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", beamDirection: "family", guidance: "家人是我最大的燈塔" }], revealed: false };
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", beamDirection: "family", guidance: "家人是我最大的燈塔" }], revealed: false };
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.queryByTestId("lhb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<LighthouseBeam {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("lhb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.queryByTestId("lhb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", beamDirection: "dream", guidance: "我的燈塔故事" }],
      revealed: true,
    };
    render(<LighthouseBeam {...defaultProps} />);
    expect(screen.getByTestId("lhb-result")).toBeTruthy();
    expect(screen.getByTestId("lhb-card-e99")).toBeTruthy();
  });
});
