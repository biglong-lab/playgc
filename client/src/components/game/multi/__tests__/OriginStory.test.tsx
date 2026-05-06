import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OriginStory } from "../OriginStory";

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

describe("OriginStory", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<OriginStory {...baseProps} config={{ title: "我的轉折" }} />);
    expect(screen.getByTestId("os-title").textContent).toContain("我的轉折");
  });

  it("顯示預設標題", () => {
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-title").textContent).toContain("起源故事");
  });

  it("顯示已分享故事數", () => {
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-count").textContent).toContain("0");
  });

  it("顯示提示文字", () => {
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-prompt")).toBeTruthy();
  });

  it("未提交前顯示表單與 emoji 選擇器", () => {
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-form")).toBeTruthy();
    expect(screen.getByTestId("os-emoji-picker")).toBeTruthy();
  });

  it("轉折點少於 5 字時提交按鈕 disabled", () => {
    render(<OriginStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("os-turning-input"), { target: { value: "失敗" } });
    const btn = screen.getByTestId("os-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("轉折點達 5 字後可提交", () => {
    render(<OriginStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("os-turning-input"), { target: { value: "第一次創業失敗的經驗" } });
    const btn = screen.getByTestId("os-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("可以選擇 emoji", () => {
    render(<OriginStory {...baseProps} />);
    const fireBtn = screen.getByTestId("os-emoji-🔥");
    fireEvent.click(fireBtn);
    expect(fireBtn.className).toContain("ring-2");
  });

  it("提交後呼叫 updateState", () => {
    render(<OriginStory {...baseProps} />);
    fireEvent.click(screen.getByTestId("os-emoji-💡"));
    fireEvent.change(screen.getByTestId("os-turning-input"), {
      target: { value: "大學時期參加創業比賽落敗，但反而找到方向" },
    });
    fireEvent.change(screen.getByTestId("os-lesson-input"), {
      target: { value: "失敗是最好的老師" },
    });
    fireEvent.click(screen.getByTestId("os-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { emoji: string; turning: string; lesson: string }[];
    };
    expect(call.entries[0].emoji).toBe("💡");
    expect(call.entries[0].lesson).toBe("失敗是最好的老師");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        turning: "第一次出國讓我打開眼界", emoji: "🌟", lesson: "勇氣很重要",
      }],
      revealed: false,
    };
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-my-entry")).toBeTruthy();
    expect(screen.getByTestId("os-my-entry").textContent).toContain("第一次出國讓我打開眼界");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<OriginStory {...baseProps} />);
    expect(screen.queryByTestId("os-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<OriginStory {...baseProps} isTeamLead />);
    expect(screen.getByTestId("os-reveal-btn")).toBeTruthy();
  });

  it("點揭示按鈕 updateState revealed=true", () => {
    render(<OriginStory {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("os-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-result")).toBeTruthy();
    expect(screen.getByTestId("os-empty")).toBeTruthy();
  });

  it("revealed 顯示故事卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", turning: "第一次出國打工換宿改變我的想法", emoji: "🌟", lesson: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", turning: "被裁員後決定轉職進入科技業", emoji: "🔥", lesson: "危機就是轉機" },
      ],
      revealed: true,
    };
    render(<OriginStory {...baseProps} />);
    expect(screen.getByTestId("os-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("os-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("os-card-u2-1").textContent).toContain("危機就是轉機");
  });
});
