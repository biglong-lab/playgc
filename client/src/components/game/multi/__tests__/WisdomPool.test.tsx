import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WisdomPool } from "../WisdomPool";

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

describe("WisdomPool", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<WisdomPool {...baseProps} config={{ title: "金句池" }} />);
    expect(screen.getByTestId("wp-title").textContent).toContain("金句池");
  });

  it("顯示預設標題", () => {
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-title").textContent).toContain("智慧池");
  });

  it("顯示已貢獻數量", () => {
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-count").textContent).toContain("0");
  });

  it("顯示提示與表單", () => {
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-prompt")).toBeTruthy();
    expect(screen.getByTestId("wp-form")).toBeTruthy();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<WisdomPool {...baseProps} />);
    const btn = screen.getByTestId("wp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填入智慧後可提交", () => {
    render(<WisdomPool {...baseProps} />);
    fireEvent.change(screen.getByTestId("wp-wisdom-input"), {
      target: { value: "失敗是成功之母，要勇於嘗試" },
    });
    expect((screen.getByTestId("wp-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("可以選擇類別標籤", () => {
    render(<WisdomPool {...baseProps} />);
    const tagBtn = screen.getByTestId("wp-tag-領導力");
    fireEvent.click(tagBtn);
    expect(tagBtn.className).toContain("border-purple-400");
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<WisdomPool {...baseProps} />);
    fireEvent.click(screen.getByTestId("wp-tag-工作心得"));
    fireEvent.change(screen.getByTestId("wp-wisdom-input"), {
      target: { value: "好的問題比好的答案更重要" },
    });
    fireEvent.change(screen.getByTestId("wp-source-input"), {
      target: { value: "彼得·杜拉克" },
    });
    fireEvent.click(screen.getByTestId("wp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { wisdom: string; tag: string; source: string }[];
    };
    expect(call.entries[0].tag).toBe("工作心得");
    expect(call.entries[0].source).toBe("彼得·杜拉克");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        wisdom: "重要的不是知道，而是去做", tag: "人生智慧", source: "",
      }],
      revealed: false,
    };
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-my-entry").textContent).toContain("重要的不是知道");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<WisdomPool {...baseProps} />);
    expect(screen.queryByTestId("wp-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<WisdomPool {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("wp-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-empty")).toBeTruthy();
  });

  it("revealed 顯示智慧卡片與標籤統計", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", wisdom: "知易行難", tag: "人生智慧", source: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", wisdom: "問題即機會", tag: "領導力", source: "書" },
      ],
      revealed: true,
    };
    render(<WisdomPool {...baseProps} />);
    expect(screen.getByTestId("wp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("wp-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("wp-tag-stats")).toBeTruthy();
  });
});
