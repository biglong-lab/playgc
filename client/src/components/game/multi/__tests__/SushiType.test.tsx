import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SushiType } from "../SushiType";

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

describe("SushiType", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-loading")).toBeTruthy();
  });

  it("顯示標題", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-title").textContent).toBe("我是哪種壽司");
  });

  it("顯示自定義標題", () => {
    render(<SushiType {...defaultProps} config={{ title: "壽司大會" }} />);
    expect(screen.getByTestId("ssh-title").textContent).toBe("壽司大會");
  });

  it("顯示提示文字", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-prompt")).toBeTruthy();
  });

  it("顯示自定義提示文字", () => {
    render(<SushiType {...defaultProps} config={{ prompt: "你最像哪種壽司？" }} />);
    expect(screen.getByTestId("ssh-prompt").textContent).toBe("你最像哪種壽司？");
  });

  it("顯示已選擇人數", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-count").textContent).toContain("0");
  });

  it("顯示選擇表單", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-form")).toBeTruthy();
  });

  it("顯示鮭魚握壽司選項", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-sushi-salmon_nigiri")).toBeTruthy();
  });

  it("顯示加州卷選項", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-sushi-california_roll")).toBeTruthy();
  });

  it("送出按鈕預設禁用", () => {
    render(<SushiType {...defaultProps} />);
    const btn = screen.getByTestId("ssh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選擇壽司並輸入理由後啟用送出", () => {
    render(<SushiType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ssh-sushi-inari"));
    fireEvent.change(screen.getByTestId("ssh-reason-input"), { target: { value: "甜蜜溫柔包容一切" } });
    const btn = screen.getByTestId("ssh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("理由不足5字時禁用送出", () => {
    render(<SushiType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ssh-sushi-temaki"));
    fireEvent.change(screen.getByTestId("ssh-reason-input"), { target: { value: "短" } });
    const btn = screen.getByTestId("ssh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("送出後呼叫 updateState", () => {
    render(<SushiType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ssh-sushi-gunkan"));
    fireEvent.change(screen.getByTestId("ssh-reason-input"), { target: { value: "飽滿圓潤獨特存在" } });
    fireEvent.click(screen.getByTestId("ssh-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已有作答時顯示我的作答區", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", sushi: "chirashi", reason: "豐盛多樣共同協作" }], revealed: false };
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-my-entry")).toBeTruthy();
  });

  it("隊長可看到揭曉按鈕", () => {
    render(<SushiType {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ssh-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SushiType {...defaultProps} />);
    expect(screen.queryByTestId("ssh-reveal-btn")).toBeNull();
  });

  it("揭曉後無作答顯示 ssh-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-empty")).toBeTruthy();
  });

  it("揭曉後有作答顯示結果區", () => {
    mockState = {
      entries: [{ entryId: "u1-2", userId: "u1", userName: "Alice", sushi: "sashimi", reason: "純粹直接本質展現" }],
      revealed: true,
    };
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-result")).toBeTruthy();
  });

  it("結果區顯示壽司 badge", () => {
    mockState = {
      entries: [{ entryId: "u1-3", userId: "u1", userName: "Alice", sushi: "tuna_nigiri", reason: "熱情濃郁備受追捧" }],
      revealed: true,
    };
    render(<SushiType {...defaultProps} />);
    expect(screen.getByTestId("ssh-badge-tuna_nigiri")).toBeTruthy();
  });
});
