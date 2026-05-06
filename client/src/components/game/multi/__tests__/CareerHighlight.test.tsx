import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CareerHighlight } from "../CareerHighlight";

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

describe("CareerHighlight", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<CareerHighlight {...baseProps} config={{ title: "我的里程碑" }} />);
    expect(screen.getByTestId("ch-title").textContent).toContain("我的里程碑");
  });

  it("顯示預設標題", () => {
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-title").textContent).toContain("職涯亮點");
  });

  it("顯示已分享人數", () => {
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-count").textContent).toContain("0");
  });

  it("顯示提示文字", () => {
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-prompt")).toBeTruthy();
  });

  it("未提交前顯示表單", () => {
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-form")).toBeTruthy();
    expect(screen.getByTestId("ch-achievement-input")).toBeTruthy();
    expect(screen.getByTestId("ch-year-select")).toBeTruthy();
  });

  it("成就少於 5 字時提交按鈕 disabled", () => {
    render(<CareerHighlight {...baseProps} />);
    const btn = screen.getByTestId("ch-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("成就達 5 字後可提交", () => {
    render(<CareerHighlight {...baseProps} />);
    fireEvent.change(screen.getByTestId("ch-achievement-input"), {
      target: { value: "主導首次跨部門整合" },
    });
    const btn = screen.getByTestId("ch-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("可以選擇年份", () => {
    render(<CareerHighlight {...baseProps} />);
    const select = screen.getByTestId("ch-year-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2020" } });
    expect(select.value).toBe("2020");
  });

  it("提交後呼叫 updateState", () => {
    render(<CareerHighlight {...baseProps} />);
    fireEvent.change(screen.getByTestId("ch-year-select"), { target: { value: "2022" } });
    fireEvent.change(screen.getByTestId("ch-achievement-input"), {
      target: { value: "帶領團隊完成年度最大客戶專案" },
    });
    fireEvent.change(screen.getByTestId("ch-impact-input"), {
      target: { value: "營收成長 30%" },
    });
    fireEvent.click(screen.getByTestId("ch-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { year: string; achievement: string; impact: string }[];
    };
    expect(call.entries[0].year).toBe("2022");
    expect(call.entries[0].impact).toBe("營收成長 30%");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1",
        userId: "u1",
        userName: "Alice",
        achievement: "拿到第一份管理職",
        year: "2021",
        impact: "讓我理解領導力的本質",
      }],
      revealed: false,
    };
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-my-entry")).toBeTruthy();
    expect(screen.getByTestId("ch-my-entry").textContent).toContain("拿到第一份管理職");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<CareerHighlight {...baseProps} />);
    expect(screen.queryByTestId("ch-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<CareerHighlight {...baseProps} isTeamLead />);
    expect(screen.getByTestId("ch-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕 updateState revealed=true", () => {
    render(<CareerHighlight {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ch-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<CareerHighlight {...baseProps} />);
    expect(screen.getByTestId("ch-result")).toBeTruthy();
    expect(screen.getByTestId("ch-empty")).toBeTruthy();
  });

  it("revealed 依年份排序顯示時間軸卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", achievement: "加入第一家新創", year: "2019", impact: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", achievement: "晉升資深工程師", year: "2023", impact: "薪資增加" },
      ],
      revealed: true,
    };
    render(<CareerHighlight {...baseProps} />);
    const cards = screen.getAllByTestId(/^ch-card-/);
    expect(cards.length).toBe(2);
    // 2023 應在前（降序）
    expect(cards[0].textContent).toContain("2023");
  });
});
