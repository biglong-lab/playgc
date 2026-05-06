import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MovieGenre } from "../MovieGenre";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn((s: Record<string, unknown>) => { mockState = s; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("MovieGenre", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-title").textContent).toBe("我是哪種電影");
    expect(screen.getByTestId("mg-prompt").textContent).toContain("電影");
  });

  it("自訂 config 標題", () => {
    render(<MovieGenre {...defaultProps} config={{ title: "今日電影院", prompt: "你是哪種類型？" }} />);
    expect(screen.getByTestId("mg-title").textContent).toBe("今日電影院");
    expect(screen.getByTestId("mg-prompt").textContent).toBe("你是哪種類型？");
  });

  it("顯示已選擇人數", () => {
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-form")).toBeTruthy();
    expect(screen.getByTestId("mg-reason-input")).toBeTruthy();
    expect(screen.getByTestId("mg-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種電影類型按鈕", () => {
    render(<MovieGenre {...defaultProps} />);
    ["action","romance","thriller","scifi","documentary","animation","horror","family","indie"].forEach((id) => {
      expect(screen.getByTestId(`mg-genre-${id}`)).toBeTruthy();
    });
  });

  it("未選類型時提交按鈕 disabled", () => {
    render(<MovieGenre {...defaultProps} />);
    fireEvent.change(screen.getByTestId("mg-reason-input"), { target: { value: "今天充滿冒險精神" } });
    const btn = screen.getByTestId("mg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類型但原因太短時 disabled", () => {
    render(<MovieGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg-genre-action"));
    fireEvent.change(screen.getByTestId("mg-reason-input"), { target: { value: "好動" } });
    const btn = screen.getByTestId("mg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選類型且原因 ≥5 字時提交按鈕啟用", () => {
    render(<MovieGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg-genre-romance"));
    fireEvent.change(screen.getByTestId("mg-reason-input"), { target: { value: "今天心情特別溫馨" } });
    const btn = screen.getByTestId("mg-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<MovieGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mg-genre-scifi"));
    fireEvent.change(screen.getByTestId("mg-reason-input"), { target: { value: "腦袋充滿各種想法" } });
    fireEvent.click(screen.getByTestId("mg-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", genre: "documentary", reason: "今天很想深入探索本質" }],
      revealed: false,
    };
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("mg-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<MovieGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mg-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<MovieGenre {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mg-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<MovieGenre {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("mg-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 mg-result 和類型摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", genre: "indie", reason: "今天特別細膩敏感有感觸" }],
      revealed: true,
    };
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-result")).toBeTruthy();
    expect(screen.getByTestId("mg-genre-summary")).toBeTruthy();
    expect(screen.getByTestId("mg-badge-indie")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", genre: "horror", reason: "今天提心吊膽高度警覺" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", genre: "animation", reason: "今天充滿童趣天馬行空" },
      ],
      revealed: true,
    };
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mg-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MovieGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mg-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", genre: "family", reason: "今天很想回家陪家人" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", genre: "thriller", reason: "今天謎題一個接一個" },
      ],
      revealed: false,
    };
    render(<MovieGenre {...defaultProps} />);
    expect(screen.getByTestId("mg-count").textContent).toContain("2");
  });
});
