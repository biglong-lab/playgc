import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MovieRole } from "../MovieRole";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("MovieRole", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-title").textContent).toBe("我在故事中的角色");
    expect(screen.getByTestId("mr-prompt").textContent).toContain("角色");
  });

  it("自訂 config 標題", () => {
    render(<MovieRole {...defaultProps} config={{ title: "你的故事角色", prompt: "選一個角色！" }} />);
    expect(screen.getByTestId("mr-title").textContent).toBe("你的故事角色");
    expect(screen.getByTestId("mr-prompt").textContent).toBe("選一個角色！");
  });

  it("顯示已選擇人數", () => {
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-form")).toBeTruthy();
    expect(screen.getByTestId("mr-reason-input")).toBeTruthy();
    expect(screen.getByTestId("mr-submit-btn")).toBeTruthy();
  });

  it("顯示所有 8 種故事角色按鈕", () => {
    render(<MovieRole {...defaultProps} />);
    ["hero","mentor","sidekick","villain","trickster","sage","guardian","creator"].forEach((id) => {
      expect(screen.getByTestId(`mr-role-${id}`)).toBeTruthy();
    });
  });

  it("未選角色時提交按鈕 disabled", () => {
    render(<MovieRole {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mr-reason-input"), { target: { value: "勇於承擔推動故事發展" } });
    const btn = screen.getByTestId("mr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選角色但原因太短時 disabled", () => {
    render(<MovieRole {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mr-role-sage"));
    fireEvent.change(screen.getByTestId("mr-reason-input"), { target: { value: "智慧" } });
    const btn = screen.getByTestId("mr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選角色且原因 ≥5 字時提交按鈕啟用", () => {
    render(<MovieRole {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mr-role-mentor"));
    fireEvent.change(screen.getByTestId("mr-reason-input"), { target: { value: "智慧引導傳承經驗給他人" } });
    const btn = screen.getByTestId("mr-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MovieRole {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mr-role-hero"));
    fireEvent.change(screen.getByTestId("mr-reason-input"), { target: { value: "勇於承擔推動故事發展" } });
    fireEvent.click(screen.getByTestId("mr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", role: "trickster", reason: "打破規則製造驚喜效果" }],
      revealed: false,
    };
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mr-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MovieRole {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mr-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MovieRole {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mr-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MovieRole {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mr-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mr-result 和角色摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", role: "creator", reason: "無中生有帶來全新意義" }],
      revealed: true,
    };
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-result")).toBeTruthy();
    expect(screen.getByTestId("mr-role-summary")).toBeTruthy();
    expect(screen.getByTestId("mr-badge-creator")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", role: "guardian", reason: "保護珍視的人與事情" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", role: "sidekick", reason: "忠誠相伴鼎力支持夥伴" },
      ],
      revealed: true,
    };
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mr-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MovieRole {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mr-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", role: "villain", reason: "挑戰現狀製造張力能量" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", role: "sage", reason: "洞察本質提供獨特視角" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", role: "hero", reason: "勇於承擔推動故事前進" },
      ],
      revealed: false,
    };
    render(<MovieRole {...defaultProps} />);
    expect(screen.getByTestId("mr-count").textContent).toContain("3");
  });
});
