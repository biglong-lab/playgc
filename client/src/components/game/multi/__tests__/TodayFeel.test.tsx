import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TodayFeel } from "../TodayFeel";

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

describe("TodayFeel", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<TodayFeel {...baseProps} config={{ title: "今日心情" }} />);
    expect(screen.getByTestId("tf-title").textContent).toContain("今日心情");
  });

  it("顯示預設標題", () => {
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-title").textContent).toContain("今天感覺");
  });

  it("顯示提示語", () => {
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-count").textContent).toContain("0");
  });

  it("顯示輸入表單和 emoji 選擇器", () => {
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-form")).toBeTruthy();
    expect(screen.getByTestId("tf-word-input")).toBeTruthy();
    expect(screen.getByTestId("tf-emoji-picker")).toBeTruthy();
  });

  it("未選 emoji 時 disabled", () => {
    render(<TodayFeel {...baseProps} />);
    fireEvent.change(screen.getByTestId("tf-word-input"), { target: { value: "開心" } });
    expect((screen.getByTestId("tf-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未填詞語時 disabled", () => {
    render(<TodayFeel {...baseProps} />);
    fireEvent.click(screen.getByTestId("tf-emoji-😊"));
    expect((screen.getByTestId("tf-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填詞語且選 emoji 後可提交", () => {
    render(<TodayFeel {...baseProps} />);
    fireEvent.change(screen.getByTestId("tf-word-input"), { target: { value: "期待" } });
    fireEvent.click(screen.getByTestId("tf-emoji-🔥"));
    expect((screen.getByTestId("tf-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<TodayFeel {...baseProps} />);
    fireEvent.change(screen.getByTestId("tf-word-input"), { target: { value: "充實" } });
    fireEvent.click(screen.getByTestId("tf-emoji-💪"));
    fireEvent.click(screen.getByTestId("tf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { word: string; emoji: string }[] };
    expect(call.entries[0].word).toBe("充實");
    expect(call.entries[0].emoji).toBe("💪");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", word: "期待", emoji: "🌟" }],
      revealed: false,
    };
    render(<TodayFeel {...baseProps} />);
    const el = screen.getByTestId("tf-my-entry");
    expect(el.textContent).toContain("期待");
    expect(el.textContent).toContain("🌟");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<TodayFeel {...baseProps} />);
    expect(screen.queryByTestId("tf-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<TodayFeel {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tf-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-empty")).toBeTruthy();
  });

  it("revealed 顯示詞語牆與成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", word: "開心", emoji: "😄" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", word: "充實", emoji: "💪" },
      ],
      revealed: true,
    };
    render(<TodayFeel {...baseProps} />);
    expect(screen.getByTestId("tf-result")).toBeTruthy();
    expect(screen.getByTestId("tf-word-wall")).toBeTruthy();
    expect(screen.getByTestId("tf-member-list")).toBeTruthy();
    expect(screen.getByTestId("tf-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tf-card-u2-1")).toBeTruthy();
  });
});
