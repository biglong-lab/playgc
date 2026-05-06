import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MuseumCard } from "../MuseumCard";

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

describe("MuseumCard", () => {
  it("顯示載入動畫", () => {
    mockIsLoaded = false;
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-loading")).toBeTruthy();
  });

  it("顯示預設標題", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-title").textContent).toBe("博物館典藏卡");
  });

  it("顯示自定義標題", () => {
    render(<MuseumCard {...defaultProps} config={{ title: "我的珍藏" }} />);
    expect(screen.getByTestId("msm-title").textContent).toBe("我的珍藏");
  });

  it("顯示提示文字", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-prompt")).toBeTruthy();
  });

  it("顯示已典藏件數", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-count").textContent).toContain("0");
  });

  it("顯示輸入表單", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-form")).toBeTruthy();
  });

  it("顯示 5 個物品類別", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-category-grid")).toBeTruthy();
    expect(screen.getByTestId("msm-category-personal")).toBeTruthy();
    expect(screen.getByTestId("msm-category-childhood")).toBeTruthy();
    expect(screen.getByTestId("msm-category-work")).toBeTruthy();
    expect(screen.getByTestId("msm-category-heritage")).toBeTruthy();
    expect(screen.getByTestId("msm-category-creation")).toBeTruthy();
  });

  it("顯示描述輸入框", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-description-input")).toBeTruthy();
  });

  it("未填描述時提交按鈕禁用", () => {
    render(<MuseumCard {...defaultProps} />);
    expect((screen.getByTestId("msm-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("少於 5 字時仍禁用", () => {
    render(<MuseumCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("msm-description-input"), { target: { value: "很棒" } });
    expect((screen.getByTestId("msm-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("5 字以上啟用提交按鈕", () => {
    render(<MuseumCard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("msm-description-input"), { target: { value: "外婆留給我的玉手鐲" } });
    expect((screen.getByTestId("msm-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("切換物品類別", () => {
    render(<MuseumCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msm-category-heritage"));
    expect(screen.getByTestId("msm-category-heritage").className).toContain("stone-100");
  });

  it("提交後呼叫 updateState 含 category 和 description", () => {
    render(<MuseumCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msm-category-work"));
    fireEvent.change(screen.getByTestId("msm-description-input"), { target: { value: "第一個程式作品的原始碼手稿" } });
    fireEvent.click(screen.getByTestId("msm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const s = mockUpdateState.mock.calls[0][0] as { entries: Array<{ userId: string; category: string; description: string }> };
    expect(s.entries[0].userId).toBe("u1");
    expect(s.entries[0].category).toBe("work");
    expect(s.entries[0].description).toBe("第一個程式作品的原始碼手稿");
  });

  it("已提交後顯示我的典藏", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "childhood", description: "爺爺送我的第一個積木組" }], revealed: false };
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", category: "childhood", description: "爺爺送我的第一個積木組" }], revealed: false };
    render(<MuseumCard {...defaultProps} />);
    expect(screen.queryByTestId("msm-form")).toBeNull();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MuseumCard {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("msm-reveal-btn")).toBeTruthy();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MuseumCard {...defaultProps} />);
    expect(screen.queryByTestId("msm-reveal-btn")).toBeNull();
  });

  it("揭曉後無資料顯示 msm-empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-empty")).toBeTruthy();
  });

  it("揭曉後顯示所有典藏", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", category: "personal", description: "十年前的日記本記錄了我的成長" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", category: "creation", description: "我夢想中的環保建築模型" },
      ],
      revealed: true,
    };
    render(<MuseumCard {...defaultProps} />);
    expect(screen.getByTestId("msm-result")).toBeTruthy();
    expect(screen.getByTestId("msm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("msm-card-u2-1")).toBeTruthy();
  });
});
