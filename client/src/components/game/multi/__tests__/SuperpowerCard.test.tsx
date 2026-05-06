import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SuperpowerCard } from "../SuperpowerCard";

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

describe("SuperpowerCard", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<SuperpowerCard {...baseProps} config={{ title: "英雄登記" }} />);
    expect(screen.getByTestId("sp-title").textContent).toContain("英雄登記");
  });

  it("顯示預設標題", () => {
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-title").textContent).toContain("超能力卡片");
  });

  it("顯示已建立卡片數", () => {
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-count").textContent).toContain("0");
  });

  it("未提交前顯示表單", () => {
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-form")).toBeTruthy();
    expect(screen.getByTestId("sp-suggestions")).toBeTruthy();
  });

  it("預設提交按鈕 disabled", () => {
    render(<SuperpowerCard {...baseProps} />);
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選標籤+填弱點後可提交", () => {
    render(<SuperpowerCard {...baseProps} />);
    fireEvent.click(screen.getByTestId("sp-suggest-快速學習"));
    fireEvent.change(screen.getByTestId("sp-kryptonite-input"), { target: { value: "拖延症" } });
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("自行輸入超能力+弱點後可提交", () => {
    render(<SuperpowerCard {...baseProps} />);
    fireEvent.change(screen.getByTestId("sp-custom-input"), { target: { value: "時間管理" } });
    fireEvent.change(screen.getByTestId("sp-kryptonite-input"), { target: { value: "開會" } });
    const btn = screen.getByTestId("sp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<SuperpowerCard {...baseProps} />);
    fireEvent.click(screen.getByTestId("sp-suggest-創意發想"));
    fireEvent.change(screen.getByTestId("sp-kryptonite-input"), { target: { value: "執行細節" } });
    fireEvent.change(screen.getByTestId("sp-origin-input"), { target: { value: "從小就喜歡畫圖" } });
    fireEvent.click(screen.getByTestId("sp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { superpower: string; kryptonite: string; origin: string }[];
    };
    expect(call.entries[0].superpower).toBe("創意發想");
    expect(call.entries[0].kryptonite).toBe("執行細節");
    expect(call.entries[0].origin).toBe("從小就喜歡畫圖");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        superpower: "說故事", kryptonite: "數字運算", origin: "",
      }],
      revealed: false,
    };
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-my-entry")).toBeTruthy();
    expect(screen.getByTestId("sp-my-entry").textContent).toContain("說故事");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.queryByTestId("sp-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<SuperpowerCard {...baseProps} isTeamLead />);
    expect(screen.getByTestId("sp-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕 updateState revealed=true", () => {
    render(<SuperpowerCard {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("sp-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-result")).toBeTruthy();
    expect(screen.getByTestId("sp-empty")).toBeTruthy();
  });

  it("revealed 顯示英雄卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", superpower: "快速學習", kryptonite: "拖延", origin: "自學程式" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", superpower: "同理傾聽", kryptonite: "拒絕", origin: "" },
      ],
      revealed: true,
    };
    render(<SuperpowerCard {...baseProps} />);
    expect(screen.getByTestId("sp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sp-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("sp-card-u1-1").textContent).toContain("快速學習");
  });
});
