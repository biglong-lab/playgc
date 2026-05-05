import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppreciationNote } from "../AppreciationNote";

let mockState: Record<string, unknown> = { entries: [], participants: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], participants: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("AppreciationNote", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-title").textContent).toBe("感謝便條");
  });

  test("顯示自訂標題", () => {
    render(<AppreciationNote {...defaultProps} config={{ title: "Kudos Board" }} />);
    expect(screen.getByTestId("an-title").textContent).toBe("Kudos Board");
  });

  test("顯示 prompt", () => {
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-prompt")).toBeDefined();
  });

  test("顯示已送出便條數", () => {
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-count").textContent).toContain("0");
  });

  test("無收件人時提交鈕禁用", () => {
    render(<AppreciationNote {...defaultProps} />);
    fireEvent.change(screen.getByTestId("an-note-input"), { target: { value: "很棒的貢獻" } });
    const btn = screen.getByTestId("an-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("填收件人和便條可提交", () => {
    render(<AppreciationNote {...defaultProps} />);
    fireEvent.change(screen.getByTestId("an-to-input"), { target: { value: "小華" } });
    fireEvent.change(screen.getByTestId("an-note-input"), { target: { value: "感謝你的幫忙" } });
    const btn = screen.getByTestId("an-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 toUserName 與 note", () => {
    render(<AppreciationNote {...defaultProps} />);
    fireEvent.change(screen.getByTestId("an-to-input"), { target: { value: "小華" } });
    fireEvent.change(screen.getByTestId("an-note-input"), { target: { value: "謝謝你的陪伴" } });
    fireEvent.click(screen.getByTestId("an-submit-btn"));
    const calls = mockUpdateState.mock.calls;
    const lastCall = calls[calls.length - 1][0] as {
      entries: Array<{ toUserName: string; note: string }>;
    };
    expect(lastCall.entries.length).toBeGreaterThan(0);
    expect(lastCall.entries[lastCall.entries.length - 1].toUserName).toBe("小華");
    expect(lastCall.entries[lastCall.entries.length - 1].note).toBe("謝謝你的陪伴");
  });

  test("有其他參與者時顯示選擇按鈕", () => {
    mockState = { entries: [], participants: ["小明", "小華", "小芳"], revealed: false };
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-participants")).toBeDefined();
    expect(screen.getByTestId("an-pick-小華")).toBeDefined();
    expect(screen.getByTestId("an-pick-小芳")).toBeDefined();
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          fromUserId: "u1",
          fromUserName: "小明",
          toUserName: "小華",
          note: "很棒",
        },
      ],
      participants: ["小明"],
      revealed: false,
    };
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<AppreciationNote {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("an-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<AppreciationNote {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("an-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<AppreciationNote {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("an-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示便條卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          fromUserId: "u2",
          fromUserName: "小華",
          toUserName: "小芳",
          note: "很用心",
        },
      ],
      participants: ["小明", "小華"],
      revealed: true,
    };
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-result")).toBeDefined();
    expect(screen.getByTestId("an-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], participants: [], revealed: true };
    render(<AppreciationNote {...defaultProps} />);
    expect(screen.getByTestId("an-empty")).toBeDefined();
  });
});
