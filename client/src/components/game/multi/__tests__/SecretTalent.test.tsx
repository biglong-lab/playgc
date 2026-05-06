import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SecretTalent } from "../SecretTalent";

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

describe("SecretTalent", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-title").textContent).toBe("隱藏才能大揭密");
    expect(screen.getByTestId("st-prompt").textContent).toContain("隱藏才能");
  });

  it("自訂 config 標題", () => {
    render(<SecretTalent {...defaultProps} config={{ title: "神秘技能", prompt: "你有什麼驚人才能？" }} />);
    expect(screen.getByTestId("st-title").textContent).toBe("神秘技能");
    expect(screen.getByTestId("st-prompt").textContent).toBe("你有什麼驚人才能？");
  });

  it("顯示已揭密人數", () => {
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-form")).toBeTruthy();
    expect(screen.getByTestId("st-talent-input")).toBeTruthy();
    expect(screen.getByTestId("st-story-input")).toBeTruthy();
    expect(screen.getByTestId("st-submit-btn")).toBeTruthy();
  });

  it("顯示所有 5 個等級按鈕", () => {
    render(<SecretTalent {...defaultProps} />);
    ["beginner", "amateur", "decent", "good", "expert"].forEach((id) => {
      expect(screen.getByTestId(`st-level-${id}`)).toBeTruthy();
    });
  });

  it("未選等級時提交按鈕 disabled", () => {
    render(<SecretTalent {...defaultProps} />);
    fireEvent.change(screen.getByTestId("st-talent-input"), { target: { value: "打手鼓" } });
    fireEvent.change(screen.getByTestId("st-story-input"), { target: { value: "從小學到大的技能" } });
    const btn = screen.getByTestId("st-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("才能太短時 disabled", () => {
    render(<SecretTalent {...defaultProps} />);
    fireEvent.change(screen.getByTestId("st-talent-input"), { target: { value: "唱" } });
    fireEvent.click(screen.getByTestId("st-level-good"));
    fireEvent.change(screen.getByTestId("st-story-input"), { target: { value: "練習了很久才學會" } });
    const btn = screen.getByTestId("st-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("所有條件滿足時提交按鈕啟用", () => {
    render(<SecretTalent {...defaultProps} />);
    fireEvent.change(screen.getByTestId("st-talent-input"), { target: { value: "用腳彈吉他" } });
    fireEvent.click(screen.getByTestId("st-level-decent"));
    fireEvent.change(screen.getByTestId("st-story-input"), { target: { value: "因為無聊就練起來了" } });
    const btn = screen.getByTestId("st-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<SecretTalent {...defaultProps} />);
    fireEvent.change(screen.getByTestId("st-talent-input"), { target: { value: "口技模仿聲音" } });
    fireEvent.click(screen.getByTestId("st-level-expert"));
    fireEvent.change(screen.getByTestId("st-story-input"), { target: { value: "練了十年的隱藏技能" } });
    fireEvent.click(screen.getByTestId("st-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", talent: "空中瑜珈", level: "good", story: "練習三年了" }],
      revealed: false,
    };
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("st-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<SecretTalent {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("st-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<SecretTalent {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("st-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<SecretTalent {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("st-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 st-result", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", talent: "手影戲", level: "decent", story: "小時候媽媽教的" }],
      revealed: true,
    };
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-result")).toBeTruthy();
    expect(screen.getByTestId("st-talent-wall")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", talent: "倒立行走", level: "amateur", story: "在健身房練的" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", talent: "念繞口令", level: "expert", story: "從小就是快嘴" },
      ],
      revealed: true,
    };
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("st-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<SecretTalent {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("st-reveal-btn")).toBeNull();
  });

  it("已揭密人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", talent: "用腳寫字", level: "decent", story: "練了很久" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", talent: "貓步走秀", level: "good", story: "走路很有型" },
      ],
      revealed: false,
    };
    render(<SecretTalent {...defaultProps} />);
    expect(screen.getByTestId("st-count").textContent).toContain("2");
  });
});
