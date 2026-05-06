import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LotusBloom } from "../LotusBloom";

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

describe("LotusBloom", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-title").textContent).toBe("蓮花盛開");
  });

  it("顯示自訂標題", () => {
    render(<LotusBloom {...defaultProps} config={{ title: "出淤泥之花" }} />);
    expect(screen.getByTestId("ltb-title").textContent).toBe("出淤泥之花");
  });

  it("顯示預設 prompt", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-prompt").textContent).toContain("蓮花");
  });

  it("顯示自訂 prompt", () => {
    render(<LotusBloom {...defaultProps} config={{ prompt: "你的心靈如何盛開" }} />);
    expect(screen.getByTestId("ltb-prompt").textContent).toBe("你的心靈如何盛開");
  });

  it("顯示已盛開蓮花數", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-form")).toBeTruthy();
  });

  it("顯示五種蓮花階段選項", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-stage-bud")).toBeTruthy();
    expect(screen.getByTestId("ltb-stage-half_open")).toBeTruthy();
    expect(screen.getByTestId("ltb-stage-full_bloom")).toBeTruthy();
    expect(screen.getByTestId("ltb-stage-petal_fall")).toBeTruthy();
    expect(screen.getByTestId("ltb-stage-seed_pod")).toBeTruthy();
  });

  it("顯示心境輸入框", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-purity-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<LotusBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltb-purity-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ltb-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<LotusBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltb-purity-input"), { target: { value: "蓮花出淤泥而不染是我的精神" } });
    expect(screen.getByTestId("ltb-submit-btn")).not.toBeDisabled();
  });

  it("切換蓮花階段選擇", () => {
    render(<LotusBloom {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ltb-stage-bud"));
    expect(screen.getByTestId("ltb-stage-bud").className).toContain("rose");
  });

  it("提交呼叫 updateState", () => {
    render(<LotusBloom {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltb-purity-input"), { target: { value: "盛開的蓮花象徵我的清白心靈" } });
    fireEvent.click(screen.getByTestId("ltb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", bloomStage: "full_bloom", purity: "出淤泥而不染是我最大的心願" }], revealed: false };
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", bloomStage: "full_bloom", purity: "出淤泥而不染是我最大的心願" }], revealed: false };
    render(<LotusBloom {...defaultProps} />);
    expect(screen.queryByTestId("ltb-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<LotusBloom {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ltb-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<LotusBloom {...defaultProps} />);
    expect(screen.queryByTestId("ltb-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", bloomStage: "petal_fall", purity: "落瓣也是一種優雅的告別方式" }],
      revealed: true,
    };
    render(<LotusBloom {...defaultProps} />);
    expect(screen.getByTestId("ltb-result")).toBeTruthy();
    expect(screen.getByTestId("ltb-card-e99")).toBeTruthy();
  });
});
