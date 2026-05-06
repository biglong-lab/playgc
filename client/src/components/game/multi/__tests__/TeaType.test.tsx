import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeaType } from "../TeaType";

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

describe("TeaType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-title").textContent).toBe("我是哪種茶");
    expect(screen.getByTestId("tea-prompt").textContent).toContain("茶");
  });

  it("自訂 config 標題", () => {
    render(<TeaType {...defaultProps} config={{ title: "你的茶道性格", prompt: "選一種茶！" }} />);
    expect(screen.getByTestId("tea-title").textContent).toBe("你的茶道性格");
    expect(screen.getByTestId("tea-prompt").textContent).toBe("選一種茶！");
  });

  it("顯示已選擇人數", () => {
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-form")).toBeTruthy();
    expect(screen.getByTestId("tea-reason-input")).toBeTruthy();
    expect(screen.getByTestId("tea-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種茶按鈕", () => {
    render(<TeaType {...defaultProps} />);
    ["green","black","oolong","matcha","herbal","puerh","white","jasmine","bubble"].forEach((id) => {
      expect(screen.getByTestId(`tea-type-${id}`)).toBeTruthy();
    });
  });

  it("未選茶時提交按鈕 disabled", () => {
    render(<TeaType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("tea-reason-input"), { target: { value: "清新爽口思維清晰" } });
    const btn = screen.getByTestId("tea-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選茶但原因太短時 disabled", () => {
    render(<TeaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tea-type-matcha"));
    fireEvent.change(screen.getByTestId("tea-reason-input"), { target: { value: "專注" } });
    const btn = screen.getByTestId("tea-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選茶且原因 ≥5 字時提交按鈕啟用", () => {
    render(<TeaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tea-type-green"));
    fireEvent.change(screen.getByTestId("tea-reason-input"), { target: { value: "清新爽口思維超清晰" } });
    const btn = screen.getByTestId("tea-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<TeaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tea-type-black"));
    fireEvent.change(screen.getByTestId("tea-reason-input"), { target: { value: "溫暖醇厚穩定可靠感" } });
    fireEvent.click(screen.getByTestId("tea-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", tea: "oolong", reason: "兼容並蓄中庸之道處世" }],
      revealed: false,
    };
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("tea-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<TeaType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("tea-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<TeaType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tea-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<TeaType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("tea-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 tea-result 和茶類摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", tea: "puerh", reason: "沉澱歲月越陳越香價值" }],
      revealed: true,
    };
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-result")).toBeTruthy();
    expect(screen.getByTestId("tea-type-summary")).toBeTruthy();
    expect(screen.getByTestId("tea-badge-puerh")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", tea: "jasmine", reason: "優雅芬芳帶來好心情享受" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", tea: "bubble", reason: "多元混搭活潑帶來驚喜" },
      ],
      revealed: true,
    };
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tea-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<TeaType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("tea-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", tea: "white", reason: "低調純粹靜靜發光無聲" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", tea: "herbal", reason: "療癒溫柔關懷他人用心" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", tea: "green", reason: "清新爽口思維超清晰透" },
      ],
      revealed: false,
    };
    render(<TeaType {...defaultProps} />);
    expect(screen.getByTestId("tea-count").textContent).toContain("3");
  });
});
