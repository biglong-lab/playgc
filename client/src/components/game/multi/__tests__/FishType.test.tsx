import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FishType } from "../FishType";

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

describe("FishType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-title").textContent).toBe("我是哪種魚");
  });

  it("顯示自定義標題", () => {
    render(<FishType {...defaultProps} config={{ title: "水族大集合" }} />);
    expect(screen.getByTestId("fsh-title").textContent).toBe("水族大集合");
  });

  it("顯示提示文字", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<FishType {...defaultProps} config={{ prompt: "你最像哪種魚？" }} />);
    expect(screen.getByTestId("fsh-prompt").textContent).toBe("你最像哪種魚？");
  });

  it("顯示已選擇人數", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-form")).toBeTruthy();
  });

  it("顯示鮭魚選項", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-fish-salmon")).toBeTruthy();
  });

  it("顯示鯊魚選項", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-fish-shark")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<FishType {...defaultProps} />);
    const btn = screen.getByTestId("fsh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇魚並輸入理由後啟用送出", () => {
    render(<FishType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fsh-fish-koi"));
    fireEvent.change(screen.getByTestId("fsh-reason-input"), { target: { value: "堅持向上吉祥如意" } });
    const btn = screen.getByTestId("fsh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<FishType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fsh-fish-tuna"));
    fireEvent.change(screen.getByTestId("fsh-reason-input"), { target: { value: "快" } });
    const btn = screen.getByTestId("fsh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<FishType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("fsh-fish-clownfish"));
    fireEvent.change(screen.getByTestId("fsh-reason-input"), { target: { value: "活潑可愛保護家園" } });
    fireEvent.click(screen.getByTestId("fsh-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", fish: "goldfish", reason: "優雅觀賞帶來好運" }], revealed: false };
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<FishType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("fsh-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<FishType {...defaultProps} />);
    expect(screen.queryByTestId("fsh-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 fsh-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", fish: "angelfish", reason: "飄逸美麗氣質出眾" }],
      revealed: true,
    };
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-result")).toBeTruthy();
  });

  it("結果區顯示魚類 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", fish: "shark", reason: "強勢果決永不停歇" }],
      revealed: true,
    };
    render(<FishType {...defaultProps} />);
    expect(screen.getByTestId("fsh-badge-shark")).toBeTruthy();
  });
});
