import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ActionPlan } from "../ActionPlan";

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

describe("ActionPlan", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<ActionPlan {...baseProps} config={{ title: "下一步行動" }} />);
    expect(screen.getByTestId("ap-title").textContent).toContain("下一步行動");
  });

  it("顯示預設標題", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-title").textContent).toContain("行動計畫");
  });

  it("顯示提示語", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-prompt")).toBeTruthy();
  });

  it("顯示已承諾數量", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-form")).toBeTruthy();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<ActionPlan {...baseProps} />);
    const btn = screen.getByTestId("ap-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("可以選擇截止時間", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-deadline-picker")).toBeTruthy();
    fireEvent.click(screen.getByTestId("ap-deadline-今天"));
    fireEvent.click(screen.getByTestId("ap-deadline-本月底"));
  });

  it("填入行動後可提交", () => {
    render(<ActionPlan {...baseProps} />);
    fireEvent.change(screen.getByTestId("ap-action-input"), {
      target: { value: "每天早上花 15 分鐘規劃當天優先任務" },
    });
    expect((screen.getByTestId("ap-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<ActionPlan {...baseProps} />);
    fireEvent.click(screen.getByTestId("ap-deadline-兩週內"));
    fireEvent.change(screen.getByTestId("ap-action-input"), {
      target: { value: "完成技能評估並制定學習計畫" },
    });
    fireEvent.change(screen.getByTestId("ap-support-input"), {
      target: { value: "需要 Bob 分享他的學習資源" },
    });
    fireEvent.click(screen.getByTestId("ap-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { action: string; deadline: string; support: string }[];
    };
    expect(call.entries[0].action).toBe("完成技能評估並制定學習計畫");
    expect(call.entries[0].deadline).toBe("兩週內");
    expect(call.entries[0].support).toBe("需要 Bob 分享他的學習資源");
  });

  it("已承諾顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        action: "每週進行一次一對一回饋面談", deadline: "本週內", support: "",
      }],
      revealed: false,
    };
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-my-entry").textContent).toContain("一對一回饋面談");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<ActionPlan {...baseProps} />);
    expect(screen.queryByTestId("ap-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<ActionPlan {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ap-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-empty")).toBeTruthy();
  });

  it("revealed 顯示行動卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "u1-1", userId: "u1", userName: "Alice",
          action: "建立知識分享文件", deadline: "本月底", support: "",
        },
        {
          entryId: "u2-1", userId: "u2", userName: "Bob",
          action: "主動找導師進行 1on1", deadline: "本週內", support: "需要推薦名單",
        },
      ],
      revealed: true,
    };
    render(<ActionPlan {...baseProps} />);
    expect(screen.getByTestId("ap-result")).toBeTruthy();
    expect(screen.getByTestId("ap-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ap-card-u2-1")).toBeTruthy();
  });
});
