import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GiftBox } from "../GiftBox";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { gifts: [], revealed: false };
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
  mockState = { gifts: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("GiftBox", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<GiftBox {...baseProps} config={{ title: "感謝禮" }} />);
    expect(screen.getByTestId("gb-title").textContent).toContain("感謝禮");
  });

  it("顯示預設標題", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-title").textContent).toContain("禮物盒");
  });

  it("顯示提示語", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-prompt")).toBeTruthy();
  });

  it("顯示已送出數量", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-form")).toBeTruthy();
  });

  it("未填寫時提交按鈕 disabled", () => {
    render(<GiftBox {...baseProps} />);
    const btn = screen.getByTestId("gb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("可以選擇 emoji 象徵", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-emoji-picker")).toBeTruthy();
    fireEvent.click(screen.getByTestId("gb-emoji-💎"));
  });

  it("只填收件人但不填禮物名稱時仍 disabled", () => {
    render(<GiftBox {...baseProps} />);
    fireEvent.change(screen.getByTestId("gb-recipient-input"), {
      target: { value: "Bob" },
    });
    expect((screen.getByTestId("gb-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填入收件人與禮物後可提交", () => {
    render(<GiftBox {...baseProps} />);
    fireEvent.change(screen.getByTestId("gb-recipient-input"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByTestId("gb-gift-input"), {
      target: { value: "傾聽的力量" },
    });
    expect((screen.getByTestId("gb-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<GiftBox {...baseProps} />);
    fireEvent.change(screen.getByTestId("gb-recipient-input"), {
      target: { value: "Carol" },
    });
    fireEvent.change(screen.getByTestId("gb-gift-input"), {
      target: { value: "解決問題的直覺" },
    });
    fireEvent.change(screen.getByTestId("gb-message-input"), {
      target: { value: "謝謝你總是找到出路" },
    });
    fireEvent.click(screen.getByTestId("gb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      gifts: { recipientName: string; giftLabel: string; message: string }[];
    };
    expect(call.gifts[0].recipientName).toBe("Carol");
    expect(call.gifts[0].giftLabel).toContain("解決問題的直覺");
    expect(call.gifts[0].message).toBe("謝謝你總是找到出路");
  });

  it("已送出顯示 my-entry", () => {
    mockState = {
      gifts: [{
        entryId: "u1-1", userId: "u1", senderName: "Alice",
        recipientName: "Bob", giftLabel: "🎁 創意力", message: "",
      }],
      revealed: false,
    };
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-my-entry").textContent).toContain("創意力");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<GiftBox {...baseProps} />);
    expect(screen.queryByTestId("gb-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<GiftBox {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("gb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { gifts: [], revealed: true };
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-empty")).toBeTruthy();
  });

  it("revealed 顯示禮物卡片（以收件人分組）", () => {
    mockState = {
      gifts: [
        {
          entryId: "u1-1", userId: "u1", senderName: "Alice",
          recipientName: "Bob", giftLabel: "🌟 創意力", message: "感謝你",
        },
        {
          entryId: "u2-1", userId: "u2", senderName: "Carol",
          recipientName: "Bob", giftLabel: "💡 洞察力", message: "",
        },
      ],
      revealed: true,
    };
    render(<GiftBox {...baseProps} />);
    expect(screen.getByTestId("gb-result")).toBeTruthy();
    expect(screen.getByTestId("gb-recipient-Bob")).toBeTruthy();
    expect(screen.getByTestId("gb-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gb-card-u2-1")).toBeTruthy();
  });
});
