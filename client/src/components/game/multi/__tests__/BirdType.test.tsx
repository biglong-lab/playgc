import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BirdType } from "../BirdType";

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

describe("BirdType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-title").textContent).toBe("我是哪種鳥類");
  });

  it("顯示自定義標題", () => {
    render(<BirdType {...defaultProps} config={{ title: "鳥類大集合" }} />);
    expect(screen.getByTestId("brd-title").textContent).toBe("鳥類大集合");
  });

  it("顯示提示文字", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<BirdType {...defaultProps} config={{ prompt: "你最像哪種鳥？" }} />);
    expect(screen.getByTestId("brd-prompt").textContent).toBe("你最像哪種鳥？");
  });

  it("顯示已選擇人數", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-form")).toBeTruthy();
  });

  it("顯示老鷹選項", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-bird-eagle")).toBeTruthy();
  });

  it("顯示天鵝選項", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-bird-swan")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<BirdType {...defaultProps} />);
    const btn = screen.getByTestId("brd-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇鳥類並輸入理由後啟用送出", () => {
    render(<BirdType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("brd-bird-owl"));
    fireEvent.change(screen.getByTestId("brd-reason-input"), { target: { value: "智慧沉靜深夜思考" } });
    const btn = screen.getByTestId("brd-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<BirdType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("brd-bird-parrot"));
    fireEvent.change(screen.getByTestId("brd-reason-input"), { target: { value: "聒" } });
    const btn = screen.getByTestId("brd-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<BirdType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("brd-bird-flamingo"));
    fireEvent.change(screen.getByTestId("brd-reason-input"), { target: { value: "優雅獨特引人注目" } });
    fireEvent.click(screen.getByTestId("brd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", bird: "penguin", reason: "忠誠團隊努力可愛" }], revealed: false };
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<BirdType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("brd-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<BirdType {...defaultProps} />);
    expect(screen.queryByTestId("brd-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 brd-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", bird: "peacock", reason: "自信展現魅力無限" }],
      revealed: true,
    };
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-result")).toBeTruthy();
  });

  it("結果區顯示鳥類 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", bird: "eagle", reason: "視野遠大獨立自主" }],
      revealed: true,
    };
    render(<BirdType {...defaultProps} />);
    expect(screen.getByTestId("brd-badge-eagle")).toBeTruthy();
  });
});
