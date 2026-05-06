import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GratitudeTree } from "../GratitudeTree";

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

describe("GratitudeTree", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-title").textContent).toBe("感恩之樹");
  });

  it("顯示自定義標題", () => {
    render(<GratitudeTree {...defaultProps} config={{ title: "感謝時刻" }} />);
    expect(screen.getByTestId("gtr-title").textContent).toBe("感謝時刻");
  });

  it("顯示提示文字", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-prompt")).toBeTruthy();
  });

  it("顯示已完成人數", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-form")).toBeTruthy();
  });

  it("顯示感謝對象選項", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-target-grid")).toBeTruthy();
    expect(screen.getByTestId("gtr-target-self")).toBeTruthy();
    expect(screen.getByTestId("gtr-target-teammate")).toBeTruthy();
    expect(screen.getByTestId("gtr-target-mentor")).toBeTruthy();
    expect(screen.getByTestId("gtr-target-environment")).toBeTruthy();
    expect(screen.getByTestId("gtr-target-chance")).toBeTruthy();
  });

  it("顯示感謝訊息輸入框", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-message-input")).toBeTruthy();
  });

  it("未填訊息時提交按鈕禁用", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect((screen.getByTestId("gtr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<GratitudeTree {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gtr-message-input"), { target: { value: "謝謝" } });
    expect((screen.getByTestId("gtr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<GratitudeTree {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gtr-message-input"), { target: { value: "謝謝你一直支持我" } });
    expect((screen.getByTestId("gtr-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換感謝對象", () => {
    render(<GratitudeTree {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gtr-target-teammate"));
    expect(screen.getByTestId("gtr-target-teammate").className).toContain("green-100");
  });

  it("提交後呼叫 updateState 含 target 和 message", () => {
    render(<GratitudeTree {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gtr-target-mentor"));
    fireEvent.change(screen.getByTestId("gtr-message-input"), { target: { value: "謝謝老師的指導讓我成長" } });
    fireEvent.click(screen.getByTestId("gtr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; target: string; message: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].target).toBe("mentor");
    expect(s.entries[0].message).toBe("謝謝老師的指導讓我成長");
  });

  it("已提交後顯示我的感謝", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", target: "self", message: "感謝自己堅持下來" }], revealed: false };
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", target: "self", message: "感謝自己堅持下來" }], revealed: false };
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.queryByTestId("gtr-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<GratitudeTree {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("gtr-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.queryByTestId("gtr-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 gtr-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-empty")).toBeTruthy();
  });

  it("揭曉後顯示感恩之樹", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", target: "teammate", message: "謝謝大家的支持" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", target: "environment", message: "感謝這個美麗的地方" },
      ],
      revealed: true,
    };
    render(<GratitudeTree {...defaultProps} />);
    expect(screen.getByTestId("gtr-result")).toBeTruthy();
    expect(screen.getByTestId("gtr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gtr-card-u2-1")).toBeTruthy();
  });
});
