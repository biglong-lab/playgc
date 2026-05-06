import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WeddingVow } from "../WeddingVow";

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

describe("WeddingVow", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-title").textContent).toBe("婚禮祝福卡");
  });

  it("顯示自定義標題", () => {
    render(<WeddingVow {...defaultProps} config={{ title: "愛的傳遞" }} />);
    expect(screen.getByTestId("wdv-title").textContent).toBe("愛的傳遞");
  });

  it("顯示提示文字", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-prompt")).toBeTruthy();
  });

  it("顯示已送出祝福人數", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-form")).toBeTruthy();
  });

  it("顯示 5 個祝福主題", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-theme-grid")).toBeTruthy();
    expect(screen.getByTestId("wdv-theme-love")).toBeTruthy();
    expect(screen.getByTestId("wdv-theme-adventure")).toBeTruthy();
    expect(screen.getByTestId("wdv-theme-growth")).toBeTruthy();
    expect(screen.getByTestId("wdv-theme-peace")).toBeTruthy();
    expect(screen.getByTestId("wdv-theme-prosperity")).toBeTruthy();
  });

  it("顯示祝福輸入框", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-blessing-input")).toBeTruthy();
  });

  it("未填祝福時提交按鈕禁用", () => {
    render(<WeddingVow {...defaultProps} />);
    expect((screen.getByTestId("wdv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<WeddingVow {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wdv-blessing-input"), { target: { value: "祝福" } });
    expect((screen.getByTestId("wdv-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<WeddingVow {...defaultProps} />);
    fireEvent.change(screen.getByTestId("wdv-blessing-input"), { target: { value: "祝你們白頭偕老" } });
    expect((screen.getByTestId("wdv-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換祝福主題", () => {
    render(<WeddingVow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wdv-theme-adventure"));
    expect(screen.getByTestId("wdv-theme-adventure").className).toContain("pink-100");
  });

  it("提交後呼叫 updateState 含 theme 和 blessing", () => {
    render(<WeddingVow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("wdv-theme-peace"));
    fireEvent.change(screen.getByTestId("wdv-blessing-input"), { target: { value: "祝你們家庭和諧幸福美滿" } });
    fireEvent.click(screen.getByTestId("wdv-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; theme: string; blessing: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].theme).toBe("peace");
    expect(s.entries[0].blessing).toBe("祝你們家庭和諧幸福美滿");
  });

  it("已提交後顯示我的祝福", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", theme: "love", blessing: "願你們相愛一輩子" }], revealed: false };
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", theme: "love", blessing: "願你們相愛一輩子" }], revealed: false };
    render(<WeddingVow {...defaultProps} />);
    expect(screen.queryByTestId("wdv-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<WeddingVow {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("wdv-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<WeddingVow {...defaultProps} />);
    expect(screen.queryByTestId("wdv-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 wdv-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有祝福", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", theme: "growth", blessing: "共同成長攜手前行" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", theme: "prosperity", blessing: "豐衣足食事業有成" },
      ],
      revealed: true,
    };
    render(<WeddingVow {...defaultProps} />);
    expect(screen.getByTestId("wdv-result")).toBeTruthy();
    expect(screen.getByTestId("wdv-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("wdv-card-u2-1")).toBeTruthy();
  });
});
