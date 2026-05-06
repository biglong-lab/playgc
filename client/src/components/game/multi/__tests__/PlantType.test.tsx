import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlantType } from "../PlantType";

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

describe("PlantType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-title").textContent).toBe("我是哪種植物");
    expect(screen.getByTestId("plt-prompt").textContent).toContain("植物");
  });

  it("自訂 config 標題", () => {
    render(<PlantType {...defaultProps} config={{ title: "你的植物性格", prompt: "選一種植物！" }} />);
    expect(screen.getByTestId("plt-title").textContent).toBe("你的植物性格");
    expect(screen.getByTestId("plt-prompt").textContent).toBe("選一種植物！");
  });

  it("顯示已選擇人數", () => {
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-form")).toBeTruthy();
    expect(screen.getByTestId("plt-reason-input")).toBeTruthy();
    expect(screen.getByTestId("plt-submit-btn")).toBeTruthy();
  });

  it("顯示所有 10 種植物按鈕", () => {
    render(<PlantType {...defaultProps} />);
    ["sunflower","cactus","bamboo","orchid","fern","lotus","vine","oak","moss","cherryblossom"].forEach((id) => {
      expect(screen.getByTestId(`plt-plant-${id}`)).toBeTruthy();
    });
  });

  it("未選植物時提交按鈕 disabled", () => {
    render(<PlantType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("plt-reason-input"), { target: { value: "樂觀積極充滿陽光" } });
    const btn = screen.getByTestId("plt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選植物但原因太短時 disabled", () => {
    render(<PlantType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("plt-plant-cactus"));
    fireEvent.change(screen.getByTestId("plt-reason-input"), { target: { value: "堅韌" } });
    const btn = screen.getByTestId("plt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選植物且原因 ≥5 字時提交按鈕啟用", () => {
    render(<PlantType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("plt-plant-bamboo"));
    fireEvent.change(screen.getByTestId("plt-reason-input"), { target: { value: "柔韌有節節節高升" } });
    const btn = screen.getByTestId("plt-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<PlantType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("plt-plant-sunflower"));
    fireEvent.change(screen.getByTestId("plt-reason-input"), { target: { value: "樂觀積極充滿陽光能量" } });
    fireEvent.click(screen.getByTestId("plt-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", plant: "lotus", reason: "出淤泥不染心境平靜" }],
      revealed: false,
    };
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("plt-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<PlantType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("plt-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<PlantType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("plt-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<PlantType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("plt-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 plt-result 和植物摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", plant: "oak", reason: "穩如磐石長遠眼光規劃" }],
      revealed: true,
    };
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-result")).toBeTruthy();
    expect(screen.getByTestId("plt-plant-summary")).toBeTruthy();
    expect(screen.getByTestId("plt-badge-oak")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", plant: "orchid", reason: "優雅細膩要求品質完美" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", plant: "moss", reason: "低調默默滋潤一切環境" },
      ],
      revealed: true,
    };
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("plt-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<PlantType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("plt-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", plant: "cherryblossom", reason: "珍惜當下絢爛短暫時光" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", plant: "vine", reason: "善於連結攀附成長學習" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", plant: "fern", reason: "喜歡靜謐陰涼舒服角落" },
      ],
      revealed: false,
    };
    render(<PlantType {...defaultProps} />);
    expect(screen.getByTestId("plt-count").textContent).toContain("3");
  });
});
