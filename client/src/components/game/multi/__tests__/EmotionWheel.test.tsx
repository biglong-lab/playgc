import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmotionWheel } from "../EmotionWheel";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("EmotionWheel", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-title").textContent).toBe("情緒之輪");
  });

  it("顯示自定義標題", () => {
    render(<EmotionWheel {...defaultProps} config={{ title: "今日情緒地圖" }} />);
    expect(screen.getByTestId("emw-title").textContent).toBe("今日情緒地圖");
  });

  it("顯示提示文字", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-form")).toBeTruthy();
  });

  it("顯示 6 種情緒選項", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-emotion-grid")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-joy")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-anger")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-sadness")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-fear")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-surprise")).toBeTruthy();
    expect(screen.getByTestId("emw-emotion-disgust")).toBeTruthy();
  });

  it("顯示 3 種強度選項", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-intensity-grid")).toBeTruthy();
    expect(screen.getByTestId("emw-intensity-mild")).toBeTruthy();
    expect(screen.getByTestId("emw-intensity-moderate")).toBeTruthy();
    expect(screen.getByTestId("emw-intensity-strong")).toBeTruthy();
  });

  it("顯示說明輸入框", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-note-input")).toBeTruthy();
  });

  it("未填說明時提交按鈕禁用", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect((screen.getByTestId("emw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<EmotionWheel {...defaultProps} />);
    fireEvent.change(screen.getByTestId("emw-note-input"), { target: { value: "好" } });
    expect((screen.getByTestId("emw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<EmotionWheel {...defaultProps} />);
    fireEvent.change(screen.getByTestId("emw-note-input"), { target: { value: "今天很開心" } });
    expect((screen.getByTestId("emw-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換情緒", () => {
    render(<EmotionWheel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("emw-emotion-anger"));
    expect(screen.getByTestId("emw-emotion-anger").className).toContain("red-100");
  });

  it("切換強度", () => {
    render(<EmotionWheel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("emw-intensity-strong"));
    expect(screen.getByTestId("emw-intensity-strong").className).toContain("orange-100");
  });

  it("提交後呼叫 updateState 含 emotion、intensity 和 note", () => {
    render(<EmotionWheel {...defaultProps} />);
    fireEvent.click(screen.getByTestId("emw-emotion-surprise"));
    fireEvent.click(screen.getByTestId("emw-intensity-moderate"));
    fireEvent.change(screen.getByTestId("emw-note-input"), { target: { value: "遇到出乎意料的好事" } });
    fireEvent.click(screen.getByTestId("emw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; emotion: string; intensity: string; note: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].emotion).toBe("surprise");
    expect(s.entries[0].intensity).toBe("moderate");
    expect(s.entries[0].note).toBe("遇到出乎意料的好事");
  });

  it("已提交後顯示我的情緒", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emotion: "joy", intensity: "strong", note: "超開心的一天" }], revealed: false };
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emotion: "joy", intensity: "strong", note: "超開心的一天" }], revealed: false };
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.queryByTestId("emw-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<EmotionWheel {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("emw-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.queryByTestId("emw-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 emw-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊情緒輪", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", emotion: "joy", intensity: "mild", note: "小確幸" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", emotion: "sadness", intensity: "moderate", note: "有點失落" },
      ],
      revealed: true,
    };
    render(<EmotionWheel {...defaultProps} />);
    expect(screen.getByTestId("emw-result")).toBeTruthy();
    expect(screen.getByTestId("emw-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("emw-card-u2-1")).toBeTruthy();
  });
});
