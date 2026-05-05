import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeadlineNews } from "../HeadlineNews";

let mockIsLoaded = true;
const mockUpdateState = vi.fn();
let mockState = { entries: [], revealed: false };

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

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

describe("HeadlineNews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoaded = true;
    mockState = { entries: [], revealed: false };
  });

  it("載入中顯示 spinner", () => {
    mockIsLoaded = false;
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-loading")).toBeTruthy();
  });

  it("顯示預設標題與提示", () => {
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-title").textContent).toContain("未來頭條");
    expect(screen.getByTestId("hn-prompt")).toBeTruthy();
  });

  it("顯示自訂 config 標題與提示", () => {
    render(
      <HeadlineNews
        {...defaultProps}
        config={{ title: "我的頭條牆", prompt: "你的夢想是什麼？", timeframe: "一年後" }}
      />,
    );
    expect(screen.getByTestId("hn-title").textContent).toContain("我的頭條牆");
    expect(screen.getByTestId("hn-prompt").textContent).toContain("你的夢想是什麼？");
    expect(screen.getByTestId("hn-timeframe").textContent).toContain("一年後");
  });

  it("顯示已提交數量", () => {
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-count").textContent).toContain("0");
  });

  it("未提交顯示輸入欄", () => {
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-headline-input")).toBeTruthy();
    expect(screen.getByTestId("hn-detail-input")).toBeTruthy();
    expect(screen.getByTestId("hn-submit-btn")).toBeTruthy();
  });

  it("標題空白時提交鈕禁用", () => {
    render(<HeadlineNews {...defaultProps} />);
    const btn = screen.getByTestId("hn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入標題後提交鈕啟用", () => {
    render(<HeadlineNews {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hn-headline-input"), {
      target: { value: "團隊突破百萬目標！" },
    });
    const btn = screen.getByTestId("hn-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState", () => {
    render(<HeadlineNews {...defaultProps} />);
    fireEvent.change(screen.getByTestId("hn-headline-input"), {
      target: { value: "我們做到了！" },
    });
    fireEvent.change(screen.getByTestId("hn-detail-input"), {
      target: { value: "全年銷售突破紀錄" },
    });
    fireEvent.click(screen.getByTestId("hn-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const arg = mockUpdateState.mock.calls[0][0];
    expect(arg.entries[0].headline).toBe("我們做到了！");
    expect(arg.entries[0].detail).toBe("全年銷售突破紀錄");
  });

  it("已提交顯示我的頭條，隱藏輸入區", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", headline: "成功了！", detail: "" }],
      revealed: false,
    };
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("hn-headline-input")).toBeNull();
  });

  it("isTeamLead=true 且未揭示時顯示揭示按鈕", () => {
    render(<HeadlineNews {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("hn-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭示按鈕", () => {
    render(<HeadlineNews {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("hn-reveal-btn")).toBeNull();
  });

  it("點揭示呼叫 updateState revealed=true", () => {
    render(<HeadlineNews {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("hn-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed=true 顯示所有頭條", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", headline: "大標題A", detail: "副標A" },
        { entryId: "u2-2", userId: "u2", userName: "Bob", headline: "大標題B", detail: "" },
      ],
      revealed: true,
    };
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-result")).toBeTruthy();
    expect(screen.getByTestId("hn-entry-u1-1")).toBeTruthy();
    expect(screen.getByTestId("hn-entry-u2-2")).toBeTruthy();
  });

  it("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<HeadlineNews {...defaultProps} />);
    expect(screen.getByTestId("hn-empty")).toBeTruthy();
  });
});
