import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PeerPraise } from "../PeerPraise";

let mockState: Record<string, unknown> = { praises: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { praises: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("PeerPraise", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-title").textContent).toBe("隊友讚美時間");
  });

  it("顯示自定義標題", () => {
    render(<PeerPraise {...defaultProps} config={{ title: "給隊友的話" }} />);
    expect(screen.getByTestId("ppr-title").textContent).toBe("給隊友的話");
  });

  it("顯示提示文字", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-prompt")).toBeTruthy();
  });

  it("顯示已送出數量", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-form")).toBeTruthy();
  });

  it("顯示收件人輸入框", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-recipient-input")).toBeTruthy();
  });

  it("顯示訊息輸入框", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-message-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<PeerPraise {...defaultProps} />);
    const btn = screen.getByTestId("ppr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填收件人時提交仍禁用", () => {
    render(<PeerPraise {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ppr-recipient-input"), { target: { value: "Bob" } });
    const btn = screen.getByTestId("ppr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("兩欄填寫後啟用提交按鈕", () => {
    render(<PeerPraise {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ppr-recipient-input"), { target: { value: "Bob" } });
    fireEvent.change(screen.getByTestId("ppr-message-input"), { target: { value: "你真的很有耐心！" } });
    const btn = screen.getByTestId("ppr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含收件人和訊息", () => {
    render(<PeerPraise {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ppr-recipient-input"), { target: { value: "Charlie" } });
    fireEvent.change(screen.getByTestId("ppr-message-input"), { target: { value: "你的創意讓大家驚艷！" } });
    fireEvent.click(screen.getByTestId("ppr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      praises: Array<{ recipientName: string; message: string; fromUserId: string }>;
    };
    expect(newState.praises[0].recipientName).toBe("Charlie");
    expect(newState.praises[0].message).toBe("你的創意讓大家驚艷！");
    expect(newState.praises[0].fromUserId).toBe("u1");
  });

  it("已提交後顯示我的讚美", () => {
    mockState = {
      praises: [{
        entryId: "u1-1", fromUserId: "u1", fromName: "Alice",
        recipientName: "Bob", message: "你很厲害",
      }],
      revealed: false,
    };
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-my-praise")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = {
      praises: [{
        entryId: "u1-1", fromUserId: "u1", fromName: "Alice",
        recipientName: "Bob", message: "你很厲害",
      }],
      revealed: false,
    };
    render(<PeerPraise {...defaultProps} />);
    expect(screen.queryByTestId("ppr-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<PeerPraise {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ppr-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PeerPraise {...defaultProps} />);
    expect(screen.queryByTestId("ppr-reveal-btn")).toBeNull();
  });

  it("揭曉後無讚美顯示 ppr-empty", () => {
    mockState = { praises: [], revealed: true };
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-empty")).toBeTruthy();
  });

  it("揭曉後顯示讚美牆", () => {
    mockState = {
      praises: [{
        entryId: "u1-1", fromUserId: "u1", fromName: "Alice",
        recipientName: "Bob", message: "你很有領導力",
      }],
      revealed: true,
    };
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-result")).toBeTruthy();
  });

  it("讚美牆顯示各卡片", () => {
    mockState = {
      praises: [
        { entryId: "u1-1", fromUserId: "u1", fromName: "Alice", recipientName: "Bob", message: "讚1" },
        { entryId: "u2-1", fromUserId: "u2", fromName: "Bob", recipientName: "Alice", message: "讚2" },
      ],
      revealed: true,
    };
    render(<PeerPraise {...defaultProps} />);
    expect(screen.getByTestId("ppr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ppr-card-u2-1")).toBeTruthy();
  });
});
