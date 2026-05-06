import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BirthdayCandle } from "../BirthdayCandle";

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

describe("BirthdayCandle", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-title").textContent).toBe("生日許願蠟燭");
  });

  it("顯示自定義標題", () => {
    render(<BirthdayCandle {...defaultProps} config={{ title: "生日許願池" }} />);
    expect(screen.getByTestId("bcd-title").textContent).toBe("生日許願池");
  });

  it("顯示提示文字", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-prompt")).toBeTruthy();
  });

  it("顯示已許願人數", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-form")).toBeTruthy();
  });

  it("顯示 4 個時間選項", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-timeframe-grid")).toBeTruthy();
    expect(screen.getByTestId("bcd-timeframe-1year")).toBeTruthy();
    expect(screen.getByTestId("bcd-timeframe-3years")).toBeTruthy();
    expect(screen.getByTestId("bcd-timeframe-5years")).toBeTruthy();
    expect(screen.getByTestId("bcd-timeframe-forever")).toBeTruthy();
  });

  it("顯示祝願輸入框", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-wish-input")).toBeTruthy();
  });

  it("未填祝願時提交按鈕禁用", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect((screen.getByTestId("bcd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<BirthdayCandle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bcd-wish-input"), { target: { value: "快樂" } });
    expect((screen.getByTestId("bcd-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<BirthdayCandle {...defaultProps} />);
    fireEvent.change(screen.getByTestId("bcd-wish-input"), { target: { value: "身體健康萬事如意" } });
    expect((screen.getByTestId("bcd-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換時間選項", () => {
    render(<BirthdayCandle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bcd-timeframe-forever"));
    expect(screen.getByTestId("bcd-timeframe-forever").className).toContain("yellow-100");
  });

  it("提交後呼叫 updateState 含 timeframe 和 wish", () => {
    render(<BirthdayCandle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bcd-timeframe-5years"));
    fireEvent.change(screen.getByTestId("bcd-wish-input"), { target: { value: "希望你夢想都能成真" } });
    fireEvent.click(screen.getByTestId("bcd-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; timeframe: string; wish: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].timeframe).toBe("5years");
    expect(s.entries[0].wish).toBe("希望你夢想都能成真");
  });

  it("已提交後顯示我的祝願", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", timeframe: "1year", wish: "祝你生日快樂天天開心" }], revealed: false };
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", timeframe: "1year", wish: "祝你生日快樂天天開心" }], revealed: false };
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.queryByTestId("bcd-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<BirthdayCandle {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("bcd-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.queryByTestId("bcd-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 bcd-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-empty")).toBeTruthy();
  });

  it("揭曉後顯示全部祝願", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", timeframe: "forever", wish: "永遠健康快樂平安" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", timeframe: "3years", wish: "事業步步高升" },
      ],
      revealed: true,
    };
    render(<BirthdayCandle {...defaultProps} />);
    expect(screen.getByTestId("bcd-result")).toBeTruthy();
    expect(screen.getByTestId("bcd-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("bcd-card-u2-1")).toBeTruthy();
  });
});
