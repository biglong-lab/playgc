import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LifeLine } from "../LifeLine";

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

describe("LifeLine", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<LifeLine {...baseProps} config={{ title: "我的故事軸" }} />);
    expect(screen.getByTestId("ll-title").textContent).toContain("我的故事軸");
  });

  it("顯示預設標題", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-title").textContent).toContain("人生時間軸");
  });

  it("顯示提示語", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-count").textContent).toContain("0");
  });

  it("預設顯示一個事件欄位", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-event-0")).toBeTruthy();
    expect(screen.getByTestId("ll-form")).toBeTruthy();
  });

  it("可以選擇影響程度（high/medium/low）", () => {
    render(<LifeLine {...baseProps} />);
    fireEvent.click(screen.getByTestId("ll-impact-0-medium"));
    fireEvent.click(screen.getByTestId("ll-impact-0-low"));
  });

  it("event 內容少於 3 字時提交按鈕 disabled", () => {
    render(<LifeLine {...baseProps} />);
    const btn = screen.getByTestId("ll-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填入事件描述後可提交", () => {
    render(<LifeLine {...baseProps} />);
    fireEvent.change(screen.getByTestId("ll-event-input-0"), {
      target: { value: "大學畢業，踏上社會" },
    });
    expect((screen.getByTestId("ll-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("可以新增事件（最多3個）", () => {
    render(<LifeLine {...baseProps} />);
    fireEvent.click(screen.getByTestId("ll-add-event-btn"));
    expect(screen.getByTestId("ll-event-1")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ll-add-event-btn"));
    expect(screen.getByTestId("ll-event-2")).toBeTruthy();
    expect(screen.queryByTestId("ll-add-event-btn")).toBeNull();
  });

  it("可以移除事件（剩一個時不能移除）", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.queryByTestId("ll-remove-0")).toBeNull();
    fireEvent.click(screen.getByTestId("ll-add-event-btn"));
    expect(screen.getByTestId("ll-remove-0")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ll-remove-0"));
    expect(screen.queryByTestId("ll-event-1")).toBeNull();
  });

  it("提交後呼叫 updateState 含 events 欄位", () => {
    render(<LifeLine {...baseProps} />);
    fireEvent.change(screen.getByTestId("ll-event-input-0"), {
      target: { value: "創業失敗，重新出發" },
    });
    fireEvent.click(screen.getByTestId("ll-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { events: { event: string }[] }[];
    };
    expect(call.entries[0].events[0].event).toBe("創業失敗，重新出發");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        events: [{ year: "2020", event: "出社會第一份工作", impact: "high" }],
        theme: "關鍵時刻",
      }],
      revealed: false,
    };
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-my-entry").textContent).toContain("出社會第一份工作");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<LifeLine {...baseProps} />);
    expect(screen.queryByTestId("ll-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<LifeLine {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ll-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-empty")).toBeTruthy();
  });

  it("revealed 顯示多人時間軸卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "u1-1", userId: "u1", userName: "Alice",
          events: [{ year: "2018", event: "考上大學", impact: "high" }],
          theme: "關鍵時刻",
        },
        {
          entryId: "u2-1", userId: "u2", userName: "Bob",
          events: [{ year: "2021", event: "第一份工作", impact: "medium" }],
          theme: "關鍵時刻",
        },
      ],
      revealed: true,
    };
    render(<LifeLine {...baseProps} />);
    expect(screen.getByTestId("ll-result")).toBeTruthy();
    expect(screen.getByTestId("ll-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ll-card-u2-1")).toBeTruthy();
  });
});
