import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChallengeFlag } from "../ChallengeFlag";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("ChallengeFlag", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-loading")).toBeDefined();
  });

  test("顯示預設標題與提示", () => {
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-title").textContent).toBe("挑戰旗幟");
    expect(screen.getByTestId("cf-prompt").textContent).toContain("挑戰");
  });

  test("顯示自訂 config", () => {
    render(<ChallengeFlag {...defaultProps} config={{ title: "My Challenge" }} />);
    expect(screen.getByTestId("cf-title").textContent).toBe("My Challenge");
  });

  test("顯示已分享人數", () => {
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-count").textContent).toContain("0");
  });

  test("空輸入時提交鈕禁用", () => {
    render(<ChallengeFlag {...defaultProps} />);
    const btn = screen.getByTestId("cf-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("輸入後提交鈕啟用", () => {
    render(<ChallengeFlag {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cf-input"), { target: { value: "時間不夠用" } });
    const btn = screen.getByTestId("cf-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶正確 challenge", () => {
    render(<ChallengeFlag {...defaultProps} />);
    fireEvent.change(screen.getByTestId("cf-input"), { target: { value: "跨部門溝通困難" } });
    fireEvent.click(screen.getByTestId("cf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ challenge: string; reactions: unknown[] }> };
    expect(called.entries[0].challenge).toBe("跨部門溝通困難");
    expect(called.entries[0].reactions).toHaveLength(0);
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", challenge: "壓力大", reactions: [] }],
      revealed: false,
    };
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<ChallengeFlag {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cf-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ChallengeFlag {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cf-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<ChallengeFlag {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("cf-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片與 emoji 反應按鈕", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", challenge: "時間不夠", reactions: [] }],
      revealed: true,
    };
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-result")).toBeDefined();
    expect(screen.getByTestId("cf-card-e1")).toBeDefined();
    expect(screen.getByTestId("cf-react-e1-💪")).toBeDefined();
  });

  test("點 emoji 反應呼叫 updateState 加入 reaction", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u2", userName: "小華", challenge: "壓力大", reactions: [] }],
      revealed: true,
    };
    render(<ChallengeFlag {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cf-react-e1-💪"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ reactions: Array<{ emoji: string }> }> };
    expect(called.entries[0].reactions[0].emoji).toBe("💪");
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ChallengeFlag {...defaultProps} />);
    expect(screen.getByTestId("cf-empty")).toBeDefined();
  });
});
