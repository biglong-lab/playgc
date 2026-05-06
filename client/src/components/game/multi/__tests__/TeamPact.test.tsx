import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamPact } from "../TeamPact";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { rules: [], revealed: false, pactTitle: "我們的公約" };
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
  mockState = { rules: [], revealed: false, pactTitle: "我們的公約" };
  mockUpdateState.mockClear();
});

describe("TeamPact", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<TeamPact {...baseProps} config={{ title: "團隊憲章" }} />);
    expect(screen.getByTestId("tp-title").textContent).toContain("團隊憲章");
  });

  it("顯示預設標題", () => {
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-title").textContent).toContain("隊伍公約");
  });

  it("顯示提示語", () => {
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-count").textContent).toContain("0");
  });

  it("顯示類別選擇與表單", () => {
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-form")).toBeTruthy();
    expect(screen.getByTestId("tp-categories")).toBeTruthy();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<TeamPact {...baseProps} />);
    const btn = screen.getByTestId("tp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("可以選擇類別", () => {
    render(<TeamPact {...baseProps} />);
    fireEvent.click(screen.getByTestId("tp-cat-respect"));
    fireEvent.click(screen.getByTestId("tp-cat-growth"));
  });

  it("填入規則後可提交", () => {
    render(<TeamPact {...baseProps} />);
    fireEvent.change(screen.getByTestId("tp-rule-input"), {
      target: { value: "每次會議準時出席，尊重彼此的時間" },
    });
    expect((screen.getByTestId("tp-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<TeamPact {...baseProps} />);
    fireEvent.click(screen.getByTestId("tp-cat-accountability"));
    fireEvent.change(screen.getByTestId("tp-rule-input"), {
      target: { value: "說到做到，承諾的事情要完成" },
    });
    fireEvent.click(screen.getByTestId("tp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      rules: { rule: string; category: string }[];
    };
    expect(call.rules[0].rule).toBe("說到做到，承諾的事情要完成");
    expect(call.rules[0].category).toBe("accountability");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      rules: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        rule: "開放溝通，勇於提問", category: "communication",
      }],
      revealed: false,
      pactTitle: "我們的公約",
    };
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-my-entry").textContent).toContain("開放溝通");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<TeamPact {...baseProps} />);
    expect(screen.queryByTestId("tp-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<TeamPact {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tp-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { rules: [], revealed: true, pactTitle: "我們的公約" };
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-empty")).toBeTruthy();
  });

  it("revealed 顯示公約卡片", () => {
    mockState = {
      rules: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", rule: "傾聽每個人的想法", category: "communication" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", rule: "分享就是成長", category: "growth" },
      ],
      revealed: true,
      pactTitle: "我們的公約",
    };
    render(<TeamPact {...baseProps} />);
    expect(screen.getByTestId("tp-result")).toBeTruthy();
    expect(screen.getByTestId("tp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tp-card-u2-1")).toBeTruthy();
  });
});
