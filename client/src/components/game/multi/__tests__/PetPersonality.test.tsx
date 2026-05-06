import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PetPersonality } from "../PetPersonality";

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

describe("PetPersonality", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-title").textContent).toBe("我是哪種寵物");
    expect(screen.getByTestId("pp-prompt").textContent).toContain("寵物");
  });

  it("自訂 config 標題", () => {
    render(<PetPersonality {...defaultProps} config={{ title: "你是哪種動物", prompt: "選一隻！" }} />);
    expect(screen.getByTestId("pp-title").textContent).toBe("你是哪種動物");
    expect(screen.getByTestId("pp-prompt").textContent).toBe("選一隻！");
  });

  it("顯示已選擇人數", () => {
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-form")).toBeTruthy();
    expect(screen.getByTestId("pp-reason-input")).toBeTruthy();
    expect(screen.getByTestId("pp-submit-btn")).toBeTruthy();
  });

  it("顯示所有 10 種寵物按鈕", () => {
    render(<PetPersonality {...defaultProps} />);
    ["dog","cat","rabbit","hamster","bird","fish","turtle","parrot","hedgehog","penguin"].forEach((id) => {
      expect(screen.getByTestId(`pp-pet-${id}`)).toBeTruthy();
    });
  });

  it("未選寵物時提交按鈕 disabled", () => {
    render(<PetPersonality {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pp-reason-input"), { target: { value: "忠誠熱情愛陪伴大家" } });
    const btn = screen.getByTestId("pp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選寵物但原因太短時 disabled", () => {
    render(<PetPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pp-pet-cat"));
    fireEvent.change(screen.getByTestId("pp-reason-input"), { target: { value: "獨立" } });
    const btn = screen.getByTestId("pp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選寵物且原因 ≥5 字時提交按鈕啟用", () => {
    render(<PetPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pp-pet-dog"));
    fireEvent.change(screen.getByTestId("pp-reason-input"), { target: { value: "忠誠熱情愛陪伴大家" } });
    const btn = screen.getByTestId("pp-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<PetPersonality {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pp-pet-rabbit"));
    fireEvent.change(screen.getByTestId("pp-reason-input"), { target: { value: "溫柔可愛總是乾乾淨淨" } });
    fireEvent.click(screen.getByTestId("pp-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", pet: "penguin", reason: "紳士優雅重視家人情感" }],
      revealed: false,
    };
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("pp-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<PetPersonality {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("pp-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<PetPersonality {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("pp-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<PetPersonality {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("pp-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 pp-result 和寵物摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", pet: "parrot", reason: "聰明模仿善於溝通表達" }],
      revealed: true,
    };
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-result")).toBeTruthy();
    expect(screen.getByTestId("pp-pet-summary")).toBeTruthy();
    expect(screen.getByTestId("pp-badge-parrot")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", pet: "hamster", reason: "勤奮儲備精力十足每天" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", pet: "turtle", reason: "穩健踏實長線思考規劃" },
      ],
      revealed: true,
    };
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pp-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<PetPersonality {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("pp-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", pet: "bird", reason: "活潑好動愛唱歌每天" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", pet: "fish", reason: "悠然自在無拘無束生活" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", pet: "hedgehog", reason: "外冷內熱需要靠近溝通" },
      ],
      revealed: false,
    };
    render(<PetPersonality {...defaultProps} />);
    expect(screen.getByTestId("pp-count").textContent).toContain("3");
  });
});
