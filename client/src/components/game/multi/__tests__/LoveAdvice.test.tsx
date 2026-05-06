import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoveAdvice } from "../LoveAdvice";

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

describe("LoveAdvice", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<LoveAdvice {...baseProps} config={{ title: "婚姻祝福" }} />);
    expect(screen.getByTestId("la-title").textContent).toContain("婚姻祝福");
  });

  it("顯示預設標題", () => {
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-title").textContent).toContain("愛的建議");
  });

  it("顯示提示語", () => {
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-prompt")).toBeTruthy();
  });

  it("顯示已祝福數量", () => {
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-count").textContent).toContain("0");
  });

  it("顯示表單和 6 個類別", () => {
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-form")).toBeTruthy();
    expect(screen.getByTestId("la-cat-communication")).toBeTruthy();
    expect(screen.getByTestId("la-cat-adventure")).toBeTruthy();
    expect(screen.getByTestId("la-cat-respect")).toBeTruthy();
    expect(screen.getByTestId("la-cat-laughter")).toBeTruthy();
    expect(screen.getByTestId("la-cat-support")).toBeTruthy();
    expect(screen.getByTestId("la-cat-surprise")).toBeTruthy();
  });

  it("未選類別時 disabled", () => {
    render(<LoveAdvice {...baseProps} />);
    fireEvent.change(screen.getByTestId("la-advice-input"), { target: { value: "記得每天說謝謝" } });
    expect((screen.getByTestId("la-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未填建議時 disabled", () => {
    render(<LoveAdvice {...baseProps} />);
    fireEvent.click(screen.getByTestId("la-cat-communication"));
    expect((screen.getByTestId("la-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("建議少於5字時 disabled", () => {
    render(<LoveAdvice {...baseProps} />);
    fireEvent.click(screen.getByTestId("la-cat-laughter"));
    fireEvent.change(screen.getByTestId("la-advice-input"), { target: { value: "笑" } });
    expect((screen.getByTestId("la-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選類別且填建議後可提交", () => {
    render(<LoveAdvice {...baseProps} />);
    fireEvent.click(screen.getByTestId("la-cat-support"));
    fireEvent.change(screen.getByTestId("la-advice-input"), { target: { value: "風雨中互相扶持最重要" } });
    expect((screen.getByTestId("la-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<LoveAdvice {...baseProps} />);
    fireEvent.click(screen.getByTestId("la-cat-adventure"));
    fireEvent.change(screen.getByTestId("la-advice-input"), { target: { value: "一起去沒去過的地方冒險" } });
    fireEvent.click(screen.getByTestId("la-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { advice: string; category: string }[] };
    expect(call.entries[0].advice).toBe("一起去沒去過的地方冒險");
    expect(call.entries[0].category).toBe("adventure");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        advice: "每天睡前說一句我愛你", category: "laughter",
      }],
      revealed: false,
    };
    render(<LoveAdvice {...baseProps} />);
    const el = screen.getByTestId("la-my-entry");
    expect(el.textContent).toContain("每天睡前說一句我愛你");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<LoveAdvice {...baseProps} />);
    expect(screen.queryByTestId("la-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<LoveAdvice {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("la-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-empty")).toBeTruthy();
  });

  it("revealed 顯示建議牆與卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", advice: "多點耐心和包容", category: "respect" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", advice: "一起學做新料理", category: "adventure" },
      ],
      revealed: true,
    };
    render(<LoveAdvice {...baseProps} />);
    expect(screen.getByTestId("la-result")).toBeTruthy();
    expect(screen.getByTestId("la-advice-wall")).toBeTruthy();
    expect(screen.getByTestId("la-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("la-card-u2-1")).toBeTruthy();
  });
});
