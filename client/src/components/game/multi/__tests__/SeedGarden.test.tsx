import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeedGarden } from "../SeedGarden";

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

describe("SeedGarden", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-title").textContent).toBe("種子花園");
  });

  it("顯示自訂標題", () => {
    render(<SeedGarden {...defaultProps} config={{ title: "我的花園" }} />);
    expect(screen.getByTestId("sdg-title").textContent).toBe("我的花園");
  });

  it("顯示預設 prompt", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-prompt").textContent).toContain("種子");
  });

  it("顯示自訂 prompt", () => {
    render(<SeedGarden {...defaultProps} config={{ prompt: "你想種什麼？" }} />);
    expect(screen.getByTestId("sdg-prompt").textContent).toBe("你想種什麼？");
  });

  it("顯示已種下種子數", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-form")).toBeTruthy();
  });

  it("顯示五種種子類型選項", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-seed-sunflower")).toBeTruthy();
    expect(screen.getByTestId("sdg-seed-dandelion")).toBeTruthy();
    expect(screen.getByTestId("sdg-seed-bamboo")).toBeTruthy();
    expect(screen.getByTestId("sdg-seed-oak")).toBeTruthy();
    expect(screen.getByTestId("sdg-seed-lotus")).toBeTruthy();
  });

  it("顯示意圖輸入框", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-intention-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<SeedGarden {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdg-intention-input"), { target: { value: "短" } });
    expect(screen.getByTestId("sdg-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<SeedGarden {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdg-intention-input"), { target: { value: "五個字以上的輸入" } });
    expect(screen.getByTestId("sdg-submit-btn")).not.toBeDisabled();
  });

  it("切換種子類型選擇", () => {
    render(<SeedGarden {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sdg-seed-bamboo"));
    expect(screen.getByTestId("sdg-seed-bamboo").className).toContain("emerald");
  });

  it("提交呼叫 updateState", () => {
    render(<SeedGarden {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sdg-intention-input"), { target: { value: "我要種下希望的種子" } });
    fireEvent.click(screen.getByTestId("sdg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", seedType: "sunflower", intention: "種下向日葵的希望" }], revealed: false };
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", seedType: "sunflower", intention: "種下向日葵的希望" }], revealed: false };
    render(<SeedGarden {...defaultProps} />);
    expect(screen.queryByTestId("sdg-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SeedGarden {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sdg-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<SeedGarden {...defaultProps} />);
    expect(screen.queryByTestId("sdg-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", seedType: "sunflower", intention: "我的種子故事" }],
      revealed: true,
    };
    render(<SeedGarden {...defaultProps} />);
    expect(screen.getByTestId("sdg-result")).toBeTruthy();
    expect(screen.getByTestId("sdg-card-e99")).toBeTruthy();
  });
});
