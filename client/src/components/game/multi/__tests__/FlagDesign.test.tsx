import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlagDesign } from "../FlagDesign";

let mockState: Record<string, unknown> = { stage: "design", designs: [], votes: [] };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

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

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { stage: "design", designs: [], votes: [] };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("FlagDesign", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-title").textContent).toBe("隊伍旗幟設計");
  });

  it("顯示自定義標題", () => {
    render(<FlagDesign {...defaultProps} config={{ title: "我們的隊徽" }} />);
    expect(screen.getByTestId("fld-title").textContent).toBe("我們的隊徽");
  });

  it("顯示提示文字", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-prompt")).toBeTruthy();
  });

  it("顯示設計階段標示", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-stage").textContent).toContain("設計");
  });

  it("顯示設計表單", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-form")).toBeTruthy();
  });

  it("顯示 emoji 選項網格", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-emoji-grid")).toBeTruthy();
  });

  it("顯示標語輸入框", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-motto-input")).toBeTruthy();
  });

  it("未選 emoji 和標語時提交禁用", () => {
    render(<FlagDesign {...defaultProps} />);
    const btn = screen.getByTestId("fld-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選emoji+填標語後啟用提交按鈕", () => {
    render(<FlagDesign {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fld-emoji-🔥"));
    fireEvent.change(screen.getByTestId("fld-motto-input"), { target: { value: "勇往直前" } });
    const btn = screen.getByTestId("fld-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 emoji 和 motto", () => {
    render(<FlagDesign {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fld-emoji-⚡"));
    fireEvent.change(screen.getByTestId("fld-motto-input"), { target: { value: "閃電無敵" } });
    fireEvent.click(screen.getByTestId("fld-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      designs: Array<{ emoji: string; motto: string; userId: string }>;
    };
    expect(newState.designs[0].emoji).toBe("⚡");
    expect(newState.designs[0].motto).toBe("閃電無敵");
    expect(newState.designs[0].userId).toBe("u1");
  });

  it("已提交後顯示我的設計", () => {
    mockState = {
      stage: "design",
      designs: [{ entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🌟", motto: "閃亮隊" }],
      votes: [],
    };
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-my-design")).toBeTruthy();
  });

  it("隊長看到推進按鈕", () => {
    render(<FlagDesign {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("fld-advance-btn")).toBeTruthy();
  });

  it("非隊長看不到推進按鈕", () => {
    render(<FlagDesign {...defaultProps} />);
    expect(screen.queryByTestId("fld-advance-btn")).toBeNull();
  });

  it("隊長點推進後更新 stage 到 vote", () => {
    render(<FlagDesign {...defaultProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("fld-advance-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { stage: string };
    expect(newState.stage).toBe("vote");
  });

  it("投票階段顯示旗幟列表", () => {
    mockState = {
      stage: "vote",
      designs: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🔥", motto: "火焰隊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", emoji: "🌊", motto: "海浪組" },
      ],
      votes: [],
    };
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-vote-list")).toBeTruthy();
    expect(screen.getByTestId("fld-vote-item-u1-1")).toBeTruthy();
    expect(screen.getByTestId("fld-vote-item-u2-1")).toBeTruthy();
  });

  it("點擊旗幟後呼叫 updateState 加入票", () => {
    mockState = {
      stage: "vote",
      designs: [{ entryId: "u2-1", userId: "u2", userName: "Bob", emoji: "🚀", motto: "火箭隊" }],
      votes: [],
    };
    render(<FlagDesign {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fld-vote-item-u2-1"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as {
      votes: Array<{ userId: string; targetEntryId: string }>;
    };
    expect(newState.votes[0].targetEntryId).toBe("u2-1");
  });

  it("揭曉後顯示獲勝旗幟", () => {
    mockState = {
      stage: "reveal",
      designs: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", emoji: "🦁", motto: "獅子隊" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", emoji: "🦅", motto: "雄鷹隊" },
      ],
      votes: [
        { userId: "u1", targetEntryId: "u2-1" },
        { userId: "u2", targetEntryId: "u2-1" },
      ],
    };
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-result")).toBeTruthy();
    expect(screen.getByTestId("fld-winner").textContent).toContain("雄鷹隊");
    expect(screen.getByTestId("fld-winner").textContent).toContain("2");
  });

  it("揭曉後無設計顯示 fld-empty", () => {
    mockState = { stage: "reveal", designs: [], votes: [] };
    render(<FlagDesign {...defaultProps} />);
    expect(screen.getByTestId("fld-empty")).toBeTruthy();
  });
});
