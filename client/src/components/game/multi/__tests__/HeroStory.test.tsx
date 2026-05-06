import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HeroStory } from "../HeroStory";

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

describe("HeroStory", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<HeroStory {...baseProps} config={{ title: "我的故事" }} />);
    expect(screen.getByTestId("hs-title").textContent).toContain("我的故事");
  });

  it("顯示預設標題", () => {
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-title").textContent).toContain("英雄故事");
  });

  it("顯示提示語", () => {
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-form")).toBeTruthy();
    expect(screen.getByTestId("hs-title-input")).toBeTruthy();
    expect(screen.getByTestId("hs-challenge-input")).toBeTruthy();
    expect(screen.getByTestId("hs-lesson-input")).toBeTruthy();
  });

  it("標題不足 2 字時 disabled", () => {
    render(<HeroStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("hs-title-input"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("hs-challenge-input"), { target: { value: "面對很大困難" } });
    fireEvent.change(screen.getByTestId("hs-lesson-input"), { target: { value: "學到堅持到底" } });
    expect((screen.getByTestId("hs-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("挑戰不足 5 字時 disabled", () => {
    render(<HeroStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("hs-title-input"), { target: { value: "超越極限" } });
    fireEvent.change(screen.getByTestId("hs-challenge-input"), { target: { value: "難" } });
    fireEvent.change(screen.getByTestId("hs-lesson-input"), { target: { value: "學到堅持到底" } });
    expect((screen.getByTestId("hs-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填滿必填後可提交", () => {
    render(<HeroStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("hs-title-input"), { target: { value: "第一次公開演講" } });
    fireEvent.change(screen.getByTestId("hs-challenge-input"), { target: { value: "極度緊張，差點說不出話" } });
    fireEvent.change(screen.getByTestId("hs-lesson-input"), { target: { value: "準備充分能抵抗恐懼" } });
    expect((screen.getByTestId("hs-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<HeroStory {...baseProps} />);
    fireEvent.change(screen.getByTestId("hs-title-input"), { target: { value: "跑完馬拉松" } });
    fireEvent.change(screen.getByTestId("hs-challenge-input"), { target: { value: "35公里後體力幾近崩潰" } });
    fireEvent.change(screen.getByTestId("hs-lesson-input"), { target: { value: "心理素質比體力更重要" } });
    fireEvent.click(screen.getByTestId("hs-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { title: string; challenge: string; lesson: string }[];
    };
    expect(call.entries[0].title).toBe("跑完馬拉松");
    expect(call.entries[0].challenge).toBe("35公里後體力幾近崩潰");
    expect(call.entries[0].lesson).toBe("心理素質比體力更重要");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        title: "創業第一年", challenge: "現金流危機讓我寢食難安", lesson: "信任你的團隊",
      }],
      revealed: false,
    };
    render(<HeroStory {...baseProps} />);
    const el = screen.getByTestId("hs-my-entry");
    expect(el.textContent).toContain("創業第一年");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<HeroStory {...baseProps} />);
    expect(screen.queryByTestId("hs-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<HeroStory {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("hs-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-empty")).toBeTruthy();
  });

  it("revealed 顯示故事卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", title: "第一次創業", challenge: "資金燒盡", lesson: "學會求助" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", title: "換職涯跑道", challenge: "從零開始的恐懼", lesson: "勇氣越用越多" },
      ],
      revealed: true,
    };
    render(<HeroStory {...baseProps} />);
    expect(screen.getByTestId("hs-result")).toBeTruthy();
    expect(screen.getByTestId("hs-story-list")).toBeTruthy();
    expect(screen.getByTestId("hs-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("hs-card-u2-1")).toBeTruthy();
  });
});
