import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BodyCompass } from "../BodyCompass";

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

describe("BodyCompass", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-title").textContent).toBe("身體羅盤");
  });

  it("顯示自定義標題", () => {
    render(<BodyCompass {...defaultProps} config={{ title: "身體智慧" }} />);
    expect(screen.getByTestId("bdc-title").textContent).toBe("身體智慧");
  });

  it("顯示提示文字", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-form")).toBeTruthy();
  });

  it("顯示 6 個身體部位", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-region-grid")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-head")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-chest")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-belly")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-hands")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-feet")).toBeTruthy();
    expect(screen.getByTestId("bdc-region-whole")).toBeTruthy();
  });

  it("顯示感受輸入框", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-sensation-input")).toBeTruthy();
  });

  it("未填感受時提交按鈕禁用", () => {
    render(<BodyCompass {...defaultProps} />);
    expect((screen.getByTestId("bdc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<BodyCompass {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bdc-sensation-input"), { target: { value: "緊" } });
    expect((screen.getByTestId("bdc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<BodyCompass {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bdc-sensation-input"), { target: { value: "感覺很放鬆" } });
    expect((screen.getByTestId("bdc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換身體部位", () => {
    render(<BodyCompass {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bdc-region-belly"));
    expect(screen.getByTestId("bdc-region-belly").className).toContain("teal-100");
  });

  it("提交後呼叫 updateState 含 region 和 sensation", () => {
    render(<BodyCompass {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bdc-region-head"));
    fireEvent.change(screen.getByTestId("bdc-sensation-input"), { target: { value: "思緒特別清晰" } });
    fireEvent.click(screen.getByTestId("bdc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; region: string; sensation: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].region).toBe("head");
    expect(s.entries[0].sensation).toBe("思緒特別清晰");
  });

  it("已提交後顯示我的身體羅盤", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", region: "chest", sensation: "胸口有點緊" }], revealed: false };
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", region: "chest", sensation: "胸口有點緊" }], revealed: false };
    render(<BodyCompass {...defaultProps} />);
    expect(screen.queryByTestId("bdc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<BodyCompass {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("bdc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<BodyCompass {...defaultProps} />);
    expect(screen.queryByTestId("bdc-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 bdc-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊身體羅盤", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", region: "whole", sensation: "全身充滿活力" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", region: "feet", sensation: "雙腳很穩定" },
      ],
      revealed: true,
    };
    render(<BodyCompass {...defaultProps} />);
    expect(screen.getByTestId("bdc-result")).toBeTruthy();
    expect(screen.getByTestId("bdc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("bdc-card-u2-1")).toBeTruthy();
  });
});
