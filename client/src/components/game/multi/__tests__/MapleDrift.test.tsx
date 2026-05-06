import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MapleDrift } from "../MapleDrift";

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

describe("MapleDrift", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-title").textContent).toBe("楓葉飄落");
  });

  it("顯示自訂標題", () => {
    render(<MapleDrift {...defaultProps} config={{ title: "秋葉情思" }} />);
    expect(screen.getByTestId("mpd-title").textContent).toBe("秋葉情思");
  });

  it("顯示預設 prompt", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-prompt").textContent).toContain("楓葉");
  });

  it("顯示自訂 prompt", () => {
    render(<MapleDrift {...defaultProps} config={{ prompt: "楓葉代表你的心情" }} />);
    expect(screen.getByTestId("mpd-prompt").textContent).toBe("楓葉代表你的心情");
  });

  it("顯示已飄落楓葉數", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-form")).toBeTruthy();
  });

  it("顯示五種楓葉顏色選項", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-maple-crimson_maple")).toBeTruthy();
    expect(screen.getByTestId("mpd-maple-golden_maple")).toBeTruthy();
    expect(screen.getByTestId("mpd-maple-amber_maple")).toBeTruthy();
    expect(screen.getByTestId("mpd-maple-russet_maple")).toBeTruthy();
    expect(screen.getByTestId("mpd-maple-green_maple")).toBeTruthy();
  });

  it("顯示感觸輸入框", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-drift-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<MapleDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpd-drift-input"), { target: { value: "短" } });
    expect(screen.getByTestId("mpd-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<MapleDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpd-drift-input"), { target: { value: "緋紅楓葉讓我感受到秋天的熱情" } });
    expect(screen.getByTestId("mpd-submit-btn")).not.toBeDisabled();
  });

  it("切換楓葉顏色選擇", () => {
    render(<MapleDrift {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mpd-maple-golden_maple"));
    expect(screen.getByTestId("mpd-maple-golden_maple").className).toContain("orange");
  });

  it("提交呼叫 updateState", () => {
    render(<MapleDrift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mpd-drift-input"), { target: { value: "金黃楓葉象徵我豐收的一年" } });
    fireEvent.click(screen.getByTestId("mpd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", mapleColor: "amber_maple", driftMeaning: "琥珀楓葉留住了美好的時光" }], revealed: false };
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", mapleColor: "amber_maple", driftMeaning: "琥珀楓葉留住了美好的時光" }], revealed: false };
    render(<MapleDrift {...defaultProps} />);
    expect(screen.queryByTestId("mpd-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<MapleDrift {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mpd-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<MapleDrift {...defaultProps} />);
    expect(screen.queryByTestId("mpd-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", mapleColor: "russet_maple", driftMeaning: "棕紅楓葉讓我想起歲月的沉澱" }],
      revealed: true,
    };
    render(<MapleDrift {...defaultProps} />);
    expect(screen.getByTestId("mpd-result")).toBeTruthy();
    expect(screen.getByTestId("mpd-card-e99")).toBeTruthy();
  });
});
