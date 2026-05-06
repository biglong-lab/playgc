import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GiftToTeam } from "../GiftToTeam";

let mockState: Record<string, unknown> = { gifts: [], revealed: false };
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
  mockState = { gifts: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("GiftToTeam", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-title").textContent).toBe("送給隊伍的禮物");
  });

  it("顯示自定義標題", () => {
    render(<GiftToTeam {...defaultProps} config={{ title: "我的貢獻" }} />);
    expect(screen.getByTestId("gtt-title").textContent).toBe("我的貢獻");
  });

  it("顯示提示文字", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-prompt")).toBeTruthy();
  });

  it("顯示已送出人數", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-form")).toBeTruthy();
  });

  it("顯示禮物類型選擇", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-type-grid")).toBeTruthy();
    expect(screen.getByTestId("gtt-type-skill")).toBeTruthy();
    expect(screen.getByTestId("gtt-type-attitude")).toBeTruthy();
    expect(screen.getByTestId("gtt-type-knowledge")).toBeTruthy();
    expect(screen.getByTestId("gtt-type-energy")).toBeTruthy();
    expect(screen.getByTestId("gtt-type-support")).toBeTruthy();
  });

  it("顯示內容輸入框", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-content-input")).toBeTruthy();
  });

  it("未填內容時提交按鈕禁用", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect((screen.getByTestId("gtt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 3 字時仍禁用", () => {
    render(<GiftToTeam {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gtt-content-input"), { target: { value: "好" } });
    expect((screen.getByTestId("gtt-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("3 字以上啟用提交按鈕", () => {
    render(<GiftToTeam {...defaultProps} />);
    fireEvent.change(screen.getByTestId("gtt-content-input"), { target: { value: "整合能力" } });
    expect((screen.getByTestId("gtt-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換禮物類型", () => {
    render(<GiftToTeam {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gtt-type-energy"));
    expect(screen.getByTestId("gtt-type-energy").className).toContain("rose-100");
  });

  it("提交後呼叫 updateState 含 giftType 和 giftContent", () => {
    render(<GiftToTeam {...defaultProps} />);
    fireEvent.click(screen.getByTestId("gtt-type-knowledge"));
    fireEvent.change(screen.getByTestId("gtt-content-input"), { target: { value: "產品設計知識" } });
    fireEvent.click(screen.getByTestId("gtt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { gifts: Array<{ userId: string; giftType: string; giftContent: string }> };
    expect(s.gifts[0].userId).toBe("u1");
    expect(s.gifts[0].giftType).toBe("knowledge");
    expect(s.gifts[0].giftContent).toBe("產品設計知識");
  });

  it("已提交後顯示我的禮物", () => {
    mockState = { gifts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", giftType: "skill", giftContent: "設計思維" }], revealed: false };
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { gifts: [{ entryId: "u1-1", userId: "u1", userName: "Alice", giftType: "skill", giftContent: "設計思維" }], revealed: false };
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.queryByTestId("gtt-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<GiftToTeam {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("gtt-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.queryByTestId("gtt-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 gtt-empty", () => {
    mockState = { gifts: [], revealed: true };
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-empty")).toBeTruthy();
  });

  it("揭曉後顯示全隊禮物牆", () => {
    mockState = {
      gifts: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", giftType: "skill", giftContent: "設計思維" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", giftType: "energy", giftContent: "正向態度" },
      ],
      revealed: true,
    };
    render(<GiftToTeam {...defaultProps} />);
    expect(screen.getByTestId("gtt-result")).toBeTruthy();
    expect(screen.getByTestId("gtt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("gtt-card-u2-1")).toBeTruthy();
  });
});
