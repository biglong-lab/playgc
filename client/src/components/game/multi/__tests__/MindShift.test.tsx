import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MindShift } from "../MindShift";

let mockState: Record<string, unknown> = { shifts: [], revealed: false };
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
  mockState = { shifts: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("MindShift", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-title").textContent).toBe("思維轉變");
  });

  it("顯示自定義標題", () => {
    render(<MindShift {...defaultProps} config={{ title: "想法改變" }} />);
    expect(screen.getByTestId("mds-title").textContent).toBe("想法改變");
  });

  it("顯示提示文字", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-prompt")).toBeTruthy();
  });

  it("顯示自定義提示", () => {
    render(<MindShift {...defaultProps} config={{ prompt: "你的觀念有哪些改變？" }} />);
    expect(screen.getByTestId("mds-prompt").textContent).toBe("你的觀念有哪些改變？");
  });

  it("顯示已分享人數", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-form")).toBeTruthy();
  });

  it("顯示以前想法輸入框", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-before-input")).toBeTruthy();
  });

  it("顯示現在想法輸入框", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-after-input")).toBeTruthy();
  });

  it("未填兩個欄位時提交按鈕禁用", () => {
    render(<MindShift {...defaultProps} />);
    expect((screen.getByTestId("mds-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填 before 時仍禁用", () => {
    render(<MindShift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mds-before-input"), { target: { value: "失敗是不好的" } });
    expect((screen.getByTestId("mds-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("只填 after 時仍禁用", () => {
    render(<MindShift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mds-after-input"), { target: { value: "失敗是成長的機會" } });
    expect((screen.getByTestId("mds-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("兩個欄位都填 3 字以上啟用提交", () => {
    render(<MindShift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mds-before-input"), { target: { value: "我不擅長表達" } });
    fireEvent.change(screen.getByTestId("mds-after-input"), { target: { value: "練習讓我越來越好" } });
    expect((screen.getByTestId("mds-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含 before 和 after", () => {
    render(<MindShift {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mds-before-input"), { target: { value: "我不擅長領導" } });
    fireEvent.change(screen.getByTestId("mds-after-input"), { target: { value: "領導是可以學習的" } });
    fireEvent.click(screen.getByTestId("mds-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { shifts: Array<{ userId: string; before: string; after: string }> };
    expect(s.shifts[0].userId).toBe("u1");
    expect(s.shifts[0].before).toBe("我不擅長領導");
    expect(s.shifts[0].after).toBe("領導是可以學習的");
  });

  it("已提交後顯示我的轉變", () => {
    mockState = { shifts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", before: "失敗是壞事", after: "失敗是學習" }], revealed: false };
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { shifts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", before: "失敗是壞事", after: "失敗是學習" }], revealed: false };
    render(<MindShift {...defaultProps} />);
    expect(screen.queryByTestId("mds-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MindShift {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("mds-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MindShift {...defaultProps} />);
    expect(screen.queryByTestId("mds-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 mds-empty", () => {
    mockState = { shifts: [], revealed: true };
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊轉變牆", () => {
    mockState = {
      shifts: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", before: "失敗是壞事", after: "失敗是成長機會" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", before: "我不會說話", after: "我可以學會表達" },
      ],
      revealed: true,
    };
    render(<MindShift {...defaultProps} />);
    expect(screen.getByTestId("mds-result")).toBeTruthy();
    expect(screen.getByTestId("mds-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mds-card-u2-1")).toBeTruthy();
  });
});
