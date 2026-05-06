import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SparkCapture } from "../SparkCapture";

let mockState: Record<string, unknown> = { sparks: [], revealed: false };
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
  mockState = { sparks: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("SparkCapture", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-title").textContent).toBe("捕捉火花");
  });

  it("顯示自定義標題", () => {
    render(<SparkCapture {...defaultProps} config={{ title: "靈感時刻" }} />);
    expect(screen.getByTestId("spc-title").textContent).toBe("靈感時刻");
  });

  it("顯示提示文字", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<SparkCapture {...defaultProps} config={{ prompt: "你今天學到什麼？" }} />);
    expect(screen.getByTestId("spc-prompt").textContent).toBe("你今天學到什麼？");
  });

  it("顯示已分享人數", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-form")).toBeTruthy();
  });

  it("顯示文字輸入框", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-spark-input")).toBeTruthy();
  });

  it("未填寫時提交按鈕禁用", () => {
    render(<SparkCapture {...defaultProps} />);
    expect((screen.getByTestId("spc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<SparkCapture {...defaultProps} />);
    fireEvent.change(screen.getByTestId("spc-spark-input"), { target: { value: "好的" } });
    expect((screen.getByTestId("spc-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<SparkCapture {...defaultProps} />);
    fireEvent.change(screen.getByTestId("spc-spark-input"), { target: { value: "大家的合作讓我很感動" } });
    expect((screen.getByTestId("spc-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 spark", () => {
    render(<SparkCapture {...defaultProps} />);
    fireEvent.change(screen.getByTestId("spc-spark-input"), { target: { value: "分享故事的時刻很珍貴" } });
    fireEvent.click(screen.getByTestId("spc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { sparks: Array<{ userId: string; spark: string }> };
    expect(s.sparks[0].userId).toBe("u1");
    expect(s.sparks[0].spark).toBe("分享故事的時刻很珍貴");
  });

  it("已提交後顯示我的火花", () => {
    mockState = { sparks: [{ entryId: "u1-1", userId: "u1", userName: "Alice", spark: "那個合作瞬間" }], revealed: false };
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { sparks: [{ entryId: "u1-1", userId: "u1", userName: "Alice", spark: "那個合作瞬間" }], revealed: false };
    render(<SparkCapture {...defaultProps} />);
    expect(screen.queryByTestId("spc-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<SparkCapture {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("spc-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<SparkCapture {...defaultProps} />);
    expect(screen.queryByTestId("spc-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 spc-empty", () => {
    mockState = { sparks: [], revealed: true };
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-empty")).toBeTruthy();
  });

  it("揭曉後顯示火花牆", () => {
    mockState = {
      sparks: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", spark: "那個合作瞬間讓我感動" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", spark: "一起解決難題的過程" },
      ],
      revealed: true,
    };
    render(<SparkCapture {...defaultProps} />);
    expect(screen.getByTestId("spc-result")).toBeTruthy();
    expect(screen.getByTestId("spc-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("spc-card-u2-1")).toBeTruthy();
  });
});
