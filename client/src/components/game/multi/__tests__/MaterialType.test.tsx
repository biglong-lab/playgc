import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MaterialType } from "../MaterialType";

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

describe("MaterialType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-title").textContent).toBe("我是哪種材質");
  });

  it("顯示自定義標題", () => {
    render(<MaterialType {...defaultProps} config={{ title: "材質大賽" }} />);
    expect(screen.getByTestId("mat-title").textContent).toBe("材質大賽");
  });

  it("顯示提示文字", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<MaterialType {...defaultProps} config={{ prompt: "你最像哪種材質？" }} />);
    expect(screen.getByTestId("mat-prompt").textContent).toBe("你最像哪種材質？");
  });

  it("顯示已選擇人數", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-form")).toBeTruthy();
  });

  it("顯示木材選項", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-material-wood")).toBeTruthy();
  });

  it("顯示竹材選項", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-material-bamboo")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<MaterialType {...defaultProps} />);
    const btn = screen.getByTestId("mat-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇材質並輸入理由後啟用送出", () => {
    render(<MaterialType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mat-material-glass"));
    fireEvent.change(screen.getByTestId("mat-reason-input"), { target: { value: "透明清澈折射萬象" } });
    const btn = screen.getByTestId("mat-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<MaterialType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mat-material-stone"));
    fireEvent.change(screen.getByTestId("mat-reason-input"), { target: { value: "短" } });
    const btn = screen.getByTestId("mat-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<MaterialType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mat-material-metal"));
    fireEvent.change(screen.getByTestId("mat-reason-input"), { target: { value: "堅硬精準耐久可靠" } });
    fireEvent.click(screen.getByTestId("mat-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", material: "fabric", reason: "柔軟包容貼近人心" }], revealed: false };
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<MaterialType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mat-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MaterialType {...defaultProps} />);
    expect(screen.queryByTestId("mat-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 mat-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", material: "ceramic", reason: "雕琢細緻溫潤典雅" }],
      revealed: true,
    };
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-result")).toBeTruthy();
  });

  it("結果區顯示材質 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", material: "leather", reason: "成熟質感越用越美" }],
      revealed: true,
    };
    render(<MaterialType {...defaultProps} />);
    expect(screen.getByTestId("mat-badge-leather")).toBeTruthy();
  });
});
