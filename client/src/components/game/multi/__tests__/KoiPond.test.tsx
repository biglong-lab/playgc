import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KoiPond } from "../KoiPond";

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

describe("KoiPond", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-title").textContent).toBe("錦鯉許願池");
  });

  it("顯示自訂標題", () => {
    render(<KoiPond {...defaultProps} config={{ title: "錦鯉心願" }} />);
    expect(screen.getByTestId("koi-title").textContent).toBe("錦鯉心願");
  });

  it("顯示預設 prompt", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-prompt").textContent).toContain("錦鯉");
  });

  it("顯示自訂 prompt", () => {
    render(<KoiPond {...defaultProps} config={{ prompt: "許下你的心願" }} />);
    expect(screen.getByTestId("koi-prompt").textContent).toBe("許下你的心願");
  });

  it("顯示已許願錦鯉數", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-form")).toBeTruthy();
  });

  it("顯示五種錦鯉顏色選項", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-color-red_koi")).toBeTruthy();
    expect(screen.getByTestId("koi-color-gold_koi")).toBeTruthy();
    expect(screen.getByTestId("koi-color-black_koi")).toBeTruthy();
    expect(screen.getByTestId("koi-color-white_koi")).toBeTruthy();
    expect(screen.getByTestId("koi-color-blue_koi")).toBeTruthy();
  });

  it("顯示心願輸入框", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-reflection-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<KoiPond {...defaultProps} />);
    fireEvent.change(screen.getByTestId("koi-reflection-input"), { target: { value: "短" } });
    expect(screen.getByTestId("koi-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<KoiPond {...defaultProps} />);
    fireEvent.change(screen.getByTestId("koi-reflection-input"), { target: { value: "錦鯉帶走我的心願" } });
    expect(screen.getByTestId("koi-submit-btn")).not.toBeDisabled();
  });

  it("切換錦鯉顏色選擇", () => {
    render(<KoiPond {...defaultProps} />);
    fireEvent.click(screen.getByTestId("koi-color-gold_koi"));
    expect(screen.getByTestId("koi-color-gold_koi").className).toContain("cyan");
  });

  it("提交呼叫 updateState", () => {
    render(<KoiPond {...defaultProps} />);
    fireEvent.change(screen.getByTestId("koi-reflection-input"), { target: { value: "金錦鯉帶走我的心願入池" } });
    fireEvent.click(screen.getByTestId("koi-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", koiColor: "blue_koi", reflection: "藍色錦鯉代表我的平靜之心" }], revealed: false };
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", koiColor: "blue_koi", reflection: "藍色錦鯉代表我的平靜之心" }], revealed: false };
    render(<KoiPond {...defaultProps} />);
    expect(screen.queryByTestId("koi-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<KoiPond {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("koi-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<KoiPond {...defaultProps} />);
    expect(screen.queryByTestId("koi-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", koiColor: "white_koi", reflection: "白色錦鯉象徵我純潔的心靈" }],
      revealed: true,
    };
    render(<KoiPond {...defaultProps} />);
    expect(screen.getByTestId("koi-result")).toBeTruthy();
    expect(screen.getByTestId("koi-card-e99")).toBeTruthy();
  });
});
