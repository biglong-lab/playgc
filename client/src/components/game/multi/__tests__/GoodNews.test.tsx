import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoodNews } from "../GoodNews";

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

describe("GoodNews", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<GoodNews {...baseProps} config={{ title: "開心分享" }} />);
    expect(screen.getByTestId("gn-title").textContent).toContain("開心分享");
  });

  it("顯示預設標題", () => {
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-title").textContent).toContain("好消息分享");
  });

  it("顯示提示語", () => {
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-prompt")).toBeTruthy();
  });

  it("顯示已分享數量", () => {
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-count").textContent).toContain("0");
  });

  it("顯示表單和 6 個類別", () => {
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-form")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-achievement")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-growth")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-family")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-skill")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-lucky")).toBeTruthy();
    expect(screen.getByTestId("gn-cat-experience")).toBeTruthy();
  });

  it("未選類別時 disabled", () => {
    render(<GoodNews {...baseProps} />);
    fireEvent.change(screen.getByTestId("gn-news-input"), { target: { value: "今天順利完成一個大案子" } });
    expect((screen.getByTestId("gn-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未填消息時 disabled", () => {
    render(<GoodNews {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-cat-achievement"));
    expect((screen.getByTestId("gn-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("消息少於5字時 disabled", () => {
    render(<GoodNews {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-cat-lucky"));
    fireEvent.change(screen.getByTestId("gn-news-input"), { target: { value: "好" } });
    expect((screen.getByTestId("gn-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選類別且填消息後可提交", () => {
    render(<GoodNews {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-cat-growth"));
    fireEvent.change(screen.getByTestId("gn-news-input"), { target: { value: "我完成了第一個線上課程" } });
    expect((screen.getByTestId("gn-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<GoodNews {...baseProps} />);
    fireEvent.click(screen.getByTestId("gn-cat-experience"));
    fireEvent.change(screen.getByTestId("gn-news-input"), { target: { value: "上週去了一趟精彩的登山旅行" } });
    fireEvent.click(screen.getByTestId("gn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { news: string; category: string }[] };
    expect(call.entries[0].news).toBe("上週去了一趟精彩的登山旅行");
    expect(call.entries[0].category).toBe("experience");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        news: "我拿到了升遷機會", category: "achievement",
      }],
      revealed: false,
    };
    render(<GoodNews {...baseProps} />);
    const el = screen.getByTestId("gn-my-entry");
    expect(el.textContent).toContain("我拿到了升遷機會");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<GoodNews {...baseProps} />);
    expect(screen.queryByTestId("gn-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<GoodNews {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("gn-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-empty")).toBeTruthy();
  });

  it("revealed 顯示好消息牆與卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", news: "我升遷了！", category: "achievement" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", news: "我們家迎接了新成員", category: "family" },
      ],
      revealed: true,
    };
    render(<GoodNews {...baseProps} />);
    expect(screen.getByTestId("gn-result")).toBeTruthy();
    expect(screen.getByTestId("gn-news-wall")).toBeTruthy();
    expect(screen.getByTestId("gn-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gn-card-u2-1")).toBeTruthy();
  });
});
