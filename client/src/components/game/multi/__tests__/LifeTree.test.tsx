import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LifeTree } from "../LifeTree";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: mockIsLoaded }),
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

describe("LifeTree", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-title").textContent).toBe("生命之樹");
  });

  it("顯示自定義標題", () => {
    render(<LifeTree {...defaultProps} config={{ title: "我的生命旅程" }} />);
    expect(screen.getByTestId("ltr-title").textContent).toBe("我的生命旅程");
  });

  it("顯示提示文字", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-form")).toBeTruthy();
  });

  it("顯示 6 個生命階段", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-stage-grid")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-sprout")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-grow")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-bloom")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-fruit")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-fallen")).toBeTruthy();
    expect(screen.getByTestId("ltr-stage-rest")).toBeTruthy();
  });

  it("顯示說明輸入框", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-note-input")).toBeTruthy();
  });

  it("未填說明時提交按鈕禁用", () => {
    render(<LifeTree {...defaultProps} />);
    expect((screen.getByTestId("ltr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<LifeTree {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltr-note-input"), { target: { value: "成長" } });
    expect((screen.getByTestId("ltr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<LifeTree {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ltr-note-input"), { target: { value: "正在努力學習新事物" } });
    expect((screen.getByTestId("ltr-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換生命階段", () => {
    render(<LifeTree {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ltr-stage-bloom"));
    expect(screen.getByTestId("ltr-stage-bloom").className).toContain("amber-100");
  });

  it("提交後呼叫 updateState 含 stage 和 note", () => {
    render(<LifeTree {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ltr-stage-fruit"));
    fireEvent.change(screen.getByTestId("ltr-note-input"), { target: { value: "終於看到努力的成果了" } });
    fireEvent.click(screen.getByTestId("ltr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; stage: string; note: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].stage).toBe("fruit");
    expect(s.entries[0].note).toBe("終於看到努力的成果了");
  });

  it("已提交後顯示我的生命樹", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", stage: "sprout", note: "剛剛起步充滿期待" }], revealed: false };
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", stage: "sprout", note: "剛剛起步充滿期待" }], revealed: false };
    render(<LifeTree {...defaultProps} />);
    expect(screen.queryByTestId("ltr-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<LifeTree {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ltr-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<LifeTree {...defaultProps} />);
    expect(screen.queryByTestId("ltr-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 ltr-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-empty")).toBeTruthy();
  });

  it("揭曉後顯示生命之樹", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", stage: "bloom", note: "才能展現中" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", stage: "rest", note: "蓄積能量等待" },
      ],
      revealed: true,
    };
    render(<LifeTree {...defaultProps} />);
    expect(screen.getByTestId("ltr-result")).toBeTruthy();
    expect(screen.getByTestId("ltr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ltr-card-u2-1")).toBeTruthy();
  });
});
