import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TimeCapsule } from "../TimeCapsule";

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

describe("TimeCapsule", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<TimeCapsule {...baseProps} config={{ title: "未來信箱" }} />);
    expect(screen.getByTestId("tc-title").textContent).toContain("未來信箱");
  });

  it("顯示預設標題", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-title").textContent).toContain("時光膠囊");
  });

  it("顯示提示語", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-prompt")).toBeTruthy();
  });

  it("顯示已封存數量", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-form")).toBeTruthy();
  });

  it("未填寫時提交按鈕 disabled", () => {
    render(<TimeCapsule {...baseProps} />);
    const btn = screen.getByTestId("tc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填期望但未填承諾時仍 disabled", () => {
    render(<TimeCapsule {...baseProps} />);
    fireEvent.change(screen.getByTestId("tc-hope-input"), {
      target: { value: "我希望三個月後我們更有默契" },
    });
    expect((screen.getByTestId("tc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("可以選擇開封時間", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-opendate-picker")).toBeTruthy();
    fireEvent.click(screen.getByTestId("tc-date-1 個月後"));
    fireEvent.click(screen.getByTestId("tc-date-1 年後"));
  });

  it("填入期望與承諾後可提交", () => {
    render(<TimeCapsule {...baseProps} />);
    fireEvent.change(screen.getByTestId("tc-hope-input"), {
      target: { value: "我希望三個月後我們更有默契" },
    });
    fireEvent.change(screen.getByTestId("tc-commitment-input"), {
      target: { value: "我承諾每次會議都準時出席" },
    });
    expect((screen.getByTestId("tc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<TimeCapsule {...baseProps} />);
    fireEvent.change(screen.getByTestId("tc-hope-input"), {
      target: { value: "希望我們成為夢幻團隊" },
    });
    fireEvent.change(screen.getByTestId("tc-commitment-input"), {
      target: { value: "我承諾主動給予隊友正向回饋" },
    });
    fireEvent.click(screen.getByTestId("tc-date-6 個月後"));
    fireEvent.click(screen.getByTestId("tc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { hope: string; commitment: string; openDate: string }[];
    };
    expect(call.entries[0].hope).toBe("希望我們成為夢幻團隊");
    expect(call.entries[0].commitment).toBe("我承諾主動給予隊友正向回饋");
    expect(call.entries[0].openDate).toBe("6 個月後");
  });

  it("已封存顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        hope: "希望我們更有凝聚力", commitment: "我承諾每週反思", openDate: "3 個月後",
      }],
      revealed: false,
    };
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-my-entry").textContent).toContain("更有凝聚力");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<TimeCapsule {...baseProps} />);
    expect(screen.queryByTestId("tc-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<TimeCapsule {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tc-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-empty")).toBeTruthy();
  });

  it("revealed 顯示膠囊卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "u1-1", userId: "u1", userName: "Alice",
          hope: "成為標竿團隊", commitment: "承諾每週分享學習", openDate: "3 個月後",
        },
        {
          entryId: "u2-1", userId: "u2", userName: "Bob",
          hope: "專案如期完成", commitment: "每日站立會議", openDate: "1 個月後",
        },
      ],
      revealed: true,
    };
    render(<TimeCapsule {...baseProps} />);
    expect(screen.getByTestId("tc-result")).toBeTruthy();
    expect(screen.getByTestId("tc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tc-card-u2-1")).toBeTruthy();
  });
});
