import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AwardCeremony } from "../AwardCeremony";

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

describe("AwardCeremony", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-title").textContent).toBe("頒獎典禮");
  });

  it("顯示自定義標題", () => {
    render(<AwardCeremony {...defaultProps} config={{ title: "年度大獎" }} />);
    expect(screen.getByTestId("awd-title").textContent).toBe("年度大獎");
  });

  it("顯示提示文字", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-prompt")).toBeTruthy();
  });

  it("顯示已提名人數", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-form")).toBeTruthy();
  });

  it("顯示 5 個獎項類別", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-category-grid")).toBeTruthy();
    expect(screen.getByTestId("awd-category-effort")).toBeTruthy();
    expect(screen.getByTestId("awd-category-creativity")).toBeTruthy();
    expect(screen.getByTestId("awd-category-support")).toBeTruthy();
    expect(screen.getByTestId("awd-category-leadership")).toBeTruthy();
    expect(screen.getByTestId("awd-category-humor")).toBeTruthy();
  });

  it("顯示提名輸入框", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-nomination-input")).toBeTruthy();
  });

  it("未填提名時提交按鈕禁用", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect((screen.getByTestId("awd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<AwardCeremony {...defaultProps} />);
    fireEvent.change(screen.getByTestId("awd-nomination-input"), { target: { value: "好" } });
    expect((screen.getByTestId("awd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<AwardCeremony {...defaultProps} />);
    fireEvent.change(screen.getByTestId("awd-nomination-input"), { target: { value: "Bob 最努力永不放棄" } });
    expect((screen.getByTestId("awd-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換獎項類別", () => {
    render(<AwardCeremony {...defaultProps} />);
    fireEvent.click(screen.getByTestId("awd-category-humor"));
    expect(screen.getByTestId("awd-category-humor").className).toContain("amber-100");
  });

  it("提交後呼叫 updateState 含 category 和 nomination", () => {
    render(<AwardCeremony {...defaultProps} />);
    fireEvent.click(screen.getByTestId("awd-category-creativity"));
    fireEvent.change(screen.getByTestId("awd-nomination-input"), { target: { value: "提名 Carol 她的創意點子讓大家眼睛一亮" } });
    fireEvent.click(screen.getByTestId("awd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; category: string; nomination: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].category).toBe("creativity");
    expect(s.entries[0].nomination).toBe("提名 Carol 她的創意點子讓大家眼睛一亮");
  });

  it("已提交後顯示我的提名", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "support", nomination: "Bob 總是默默在背後支持大家" }], revealed: false };
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "support", nomination: "Bob 總是默默在背後支持大家" }], revealed: false };
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.queryByTestId("awd-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<AwardCeremony {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("awd-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.queryByTestId("awd-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 awd-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有提名", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", category: "effort", nomination: "Dave 每次都最早到最晚離開" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", category: "leadership", nomination: "Eve 帶領大家突破困境" },
      ],
      revealed: true,
    };
    render(<AwardCeremony {...defaultProps} />);
    expect(screen.getByTestId("awd-result")).toBeTruthy();
    expect(screen.getByTestId("awd-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("awd-card-u2-1")).toBeTruthy();
  });
});
