import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MusicType } from "../MusicType";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("MusicType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-title").textContent).toBe("我是哪種音樂");
  });

  it("顯示自定義標題", () => {
    render(<MusicType {...defaultProps} config={{ title: "音樂人格測驗" }} />);
    expect(screen.getByTestId("msc-title").textContent).toBe("音樂人格測驗");
  });

  it("顯示提示文字", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<MusicType {...defaultProps} config={{ prompt: "你最像哪種音樂？" }} />);
    expect(screen.getByTestId("msc-prompt").textContent).toBe("你最像哪種音樂？");
  });

  it("顯示已選擇人數", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-form")).toBeTruthy();
  });

  it("顯示古典樂選項", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-music-classical")).toBeTruthy();
  });

  it("顯示爵士樂選項", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-music-jazz")).toBeTruthy();
  });

  it("顯示嘻哈選項", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-music-hiphop")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<MusicType {...defaultProps} />);
    const btn = screen.getByTestId("msc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇音樂並輸入理由後啟用送出", () => {
    render(<MusicType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msc-music-rock"));
    fireEvent.change(screen.getByTestId("msc-reason-input"), { target: { value: "熱血奔放無拘無束" } });
    const btn = screen.getByTestId("msc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<MusicType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msc-music-pop"));
    fireEvent.change(screen.getByTestId("msc-reason-input"), { target: { value: "棒" } });
    const btn = screen.getByTestId("msc-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<MusicType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msc-music-folk"));
    fireEvent.change(screen.getByTestId("msc-reason-input"), { target: { value: "樸實真誠最像我" } });
    fireEvent.click(screen.getByTestId("msc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("送出後 entry 包含正確音樂類型", () => {
    render(<MusicType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msc-music-blues"));
    fireEvent.change(screen.getByTestId("msc-reason-input"), { target: { value: "憂鬱深情情感豐富" } });
    fireEvent.click(screen.getByTestId("msc-submit-btn"));
    const newState = mockUpdateState.mock.calls[0][0] as { entries: Array<{ music: string }> };
    expect(newState.entries[0].music).toBe("blues");
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", music: "electronic", reason: "前衛科技超未來感" }], revealed: false };
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<MusicType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("msc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MusicType {...defaultProps} />);
    expect(screen.queryByTestId("msc-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 msc-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", music: "r_and_b", reason: "律動節奏超帶感" }],
      revealed: true,
    };
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-result")).toBeTruthy();
  });

  it("結果區顯示音樂 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", music: "classical", reason: "精緻深邃歷久彌新" }],
      revealed: true,
    };
    render(<MusicType {...defaultProps} />);
    expect(screen.getByTestId("msc-badge-classical")).toBeTruthy();
  });
});
