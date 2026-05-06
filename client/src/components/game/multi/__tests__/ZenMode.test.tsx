import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ZenMode } from "../ZenMode";

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

describe("ZenMode", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-title").textContent).toBe("正念時刻");
  });

  it("顯示自定義標題", () => {
    render(<ZenMode {...defaultProps} config={{ title: "靜心片刻" }} />);
    expect(screen.getByTestId("zen-title").textContent).toBe("靜心片刻");
  });

  it("顯示提示文字", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<ZenMode {...defaultProps} config={{ prompt: "此刻你感受到什麼？" }} />);
    expect(screen.getByTestId("zen-prompt").textContent).toBe("此刻你感受到什麼？");
  });

  it("顯示已完成人數", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-form")).toBeTruthy();
  });

  it("顯示三個感官輸入框", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-see-input")).toBeTruthy();
    expect(screen.getByTestId("zen-hear-input")).toBeTruthy();
    expect(screen.getByTestId("zen-feel-input")).toBeTruthy();
  });

  it("三個欄位都空時提交按鈕禁用", () => {
    render(<ZenMode {...defaultProps} />);
    expect((screen.getByTestId("zen-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填 see 時仍禁用", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.change(screen.getByTestId("zen-see-input"), { target: { value: "窗外的樹" } });
    expect((screen.getByTestId("zen-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填 see 和 hear 時仍禁用", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.change(screen.getByTestId("zen-see-input"), { target: { value: "窗外的樹" } });
    fireEvent.change(screen.getByTestId("zen-hear-input"), { target: { value: "遠處的音樂" } });
    expect((screen.getByTestId("zen-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("三個欄位都填寫後啟用提交按鈕", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.change(screen.getByTestId("zen-see-input"), { target: { value: "窗外的樹" } });
    fireEvent.change(screen.getByTestId("zen-hear-input"), { target: { value: "遠處的音樂" } });
    fireEvent.change(screen.getByTestId("zen-feel-input"), { target: { value: "輕鬆自在" } });
    expect((screen.getByTestId("zen-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 see、hear、feel", () => {
    render(<ZenMode {...defaultProps} />);
    fireEvent.change(screen.getByTestId("zen-see-input"), { target: { value: "窗外的樹" } });
    fireEvent.change(screen.getByTestId("zen-hear-input"), { target: { value: "遠處的音樂" } });
    fireEvent.change(screen.getByTestId("zen-feel-input"), { target: { value: "輕鬆自在" } });
    fireEvent.click(screen.getByTestId("zen-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; see: string; hear: string; feel: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].see).toBe("窗外的樹");
    expect(s.entries[0].hear).toBe("遠處的音樂");
    expect(s.entries[0].feel).toBe("輕鬆自在");
  });

  it("已提交後顯示我的感受", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", see: "藍天", hear: "鳥鳴", feel: "平靜" }], revealed: false };
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", see: "藍天", hear: "鳥鳴", feel: "平靜" }], revealed: false };
    render(<ZenMode {...defaultProps} />);
    expect(screen.queryByTestId("zen-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ZenMode {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("zen-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ZenMode {...defaultProps} />);
    expect(screen.queryByTestId("zen-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 zen-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊感受牆", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", see: "藍天", hear: "風聲", feel: "平靜" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", see: "綠草", hear: "音樂", feel: "愉快" },
      ],
      revealed: true,
    };
    render(<ZenMode {...defaultProps} />);
    expect(screen.getByTestId("zen-result")).toBeTruthy();
    expect(screen.getByTestId("zen-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("zen-card-u2-1")).toBeTruthy();
  });
});
