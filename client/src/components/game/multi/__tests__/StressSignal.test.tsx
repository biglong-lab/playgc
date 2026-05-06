import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StressSignal } from "../StressSignal";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "Alice", email: "alice@test.com" },
  }),
}));

const baseProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("StressSignal", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<StressSignal {...baseProps} config={{ title: "壓力檢測" }} />);
    expect(screen.getByTestId("ss-title").textContent).toContain("壓力檢測");
  });

  it("顯示預設標題", () => {
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-title").textContent).toContain("壓力信號");
  });

  it("顯示提示語", () => {
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-prompt")).toBeTruthy();
  });

  it("顯示已回報數量", () => {
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-form")).toBeTruthy();
    expect(screen.getByTestId("ss-level-picker")).toBeTruthy();
    expect(screen.getByTestId("ss-stressor-picker")).toBeTruthy();
  });

  it("未選等級時 disabled", () => {
    render(<StressSignal {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-stressor-工作量"));
    expect((screen.getByTestId("ss-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未選壓力來源時 disabled", () => {
    render(<StressSignal {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-level-3"));
    expect((screen.getByTestId("ss-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選好等級和來源後可提交", () => {
    render(<StressSignal {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-level-2"));
    fireEvent.click(screen.getByTestId("ss-stressor-時間壓力"));
    expect((screen.getByTestId("ss-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<StressSignal {...baseProps} />);
    fireEvent.click(screen.getByTestId("ss-level-4"));
    fireEvent.click(screen.getByTestId("ss-stressor-工作量"));
    fireEvent.change(screen.getByTestId("ss-note-input"), {
      target: { value: "截止日快到了" },
    });
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { level: number; stressor: string; note: string }[];
    };
    expect(call.entries[0].level).toBe(4);
    expect(call.entries[0].stressor).toBe("工作量");
    expect(call.entries[0].note).toBe("截止日快到了");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        level: 3, stressor: "不確定性", note: "",
      }],
      revealed: false,
    };
    render(<StressSignal {...baseProps} />);
    const el = screen.getByTestId("ss-my-entry");
    expect(el.textContent).toContain("3");
    expect(el.textContent).toContain("不確定性");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<StressSignal {...baseProps} />);
    expect(screen.queryByTestId("ss-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<StressSignal {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ss-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-empty")).toBeTruthy();
  });

  it("revealed 顯示平均值和長條圖", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", level: 2, stressor: "工作量", note: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", level: 4, stressor: "時間壓力", note: "" },
      ],
      revealed: true,
    };
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-result")).toBeTruthy();
    expect(screen.getByTestId("ss-avg")).toBeTruthy();
    expect(screen.getByTestId("ss-bar-2")).toBeTruthy();
    expect(screen.getByTestId("ss-bar-4")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", level: 1, stressor: "個人生活", note: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", level: 5, stressor: "溝通摩擦", note: "" },
      ],
      revealed: true,
    };
    render(<StressSignal {...baseProps} />);
    expect(screen.getByTestId("ss-member-list")).toBeTruthy();
    expect(screen.getByTestId("ss-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ss-card-u2-1")).toBeTruthy();
  });
});
