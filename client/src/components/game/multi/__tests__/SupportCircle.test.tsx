import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SupportCircle } from "../SupportCircle";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("SupportCircle", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-title").textContent).toBe("支持圈");
  });

  it("顯示自定義標題", () => {
    render(<SupportCircle {...defaultProps} config={{ title: "我需要的支持" }} />);
    expect(screen.getByTestId("sco-title").textContent).toBe("我需要的支持");
  });

  it("顯示提示文字", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-prompt")).toBeTruthy();
  });

  it("顯示已分享人數", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-form")).toBeTruthy();
  });

  it("顯示支持類型選項", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-need-grid")).toBeTruthy();
    expect(screen.getByTestId("sco-need-help")).toBeTruthy();
    expect(screen.getByTestId("sco-need-encourage")).toBeTruthy();
    expect(screen.getByTestId("sco-need-advice")).toBeTruthy();
    expect(screen.getByTestId("sco-need-resource")).toBeTruthy();
    expect(screen.getByTestId("sco-need-space")).toBeTruthy();
  });

  it("顯示請求輸入框", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-request-input")).toBeTruthy();
  });

  it("未填請求時提交按鈕禁用", () => {
    render(<SupportCircle {...defaultProps} />);
    expect((screen.getByTestId("sco-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<SupportCircle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sco-request-input"), { target: { value: "好" } });
    expect((screen.getByTestId("sco-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<SupportCircle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("sco-request-input"), { target: { value: "希望隊友給我一些回饋" } });
    expect((screen.getByTestId("sco-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換支持類型", () => {
    render(<SupportCircle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sco-need-advice"));
    expect(screen.getByTestId("sco-need-advice").className).toContain("purple-100");
  });

  it("提交後呼叫 updateState 含 needType 和 request", () => {
    render(<SupportCircle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("sco-need-encourage"));
    fireEvent.change(screen.getByTestId("sco-request-input"), { target: { value: "需要隊友的加油打氣" } });
    fireEvent.click(screen.getByTestId("sco-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; needType: string; request: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].needType).toBe("encourage");
    expect(s.entries[0].request).toBe("需要隊友的加油打氣");
  });

  it("已提交後顯示我的需求", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", needType: "help", request: "需要有人協助簡報製作" }], revealed: false };
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", needType: "help", request: "需要有人協助簡報製作" }], revealed: false };
    render(<SupportCircle {...defaultProps} />);
    expect(screen.queryByTestId("sco-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<SupportCircle {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("sco-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SupportCircle {...defaultProps} />);
    expect(screen.queryByTestId("sco-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 sco-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊需求牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", needType: "help", request: "需要協助整理資料" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", needType: "resource", request: "需要更多參考資料" },
      ],
      revealed: true,
    };
    render(<SupportCircle {...defaultProps} />);
    expect(screen.getByTestId("sco-result")).toBeTruthy();
    expect(screen.getByTestId("sco-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sco-card-u2-1")).toBeTruthy();
  });
});
