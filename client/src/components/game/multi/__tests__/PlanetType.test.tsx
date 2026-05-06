import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlanetType } from "../PlanetType";

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

describe("PlanetType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-title").textContent).toBe("我是哪顆星球");
    expect(screen.getByTestId("pln-prompt").textContent).toContain("星球");
  });

  it("自訂 config 標題", () => {
    render(<PlanetType {...defaultProps} config={{ title: "你的星球性格", prompt: "選一顆星球！" }} />);
    expect(screen.getByTestId("pln-title").textContent).toBe("你的星球性格");
    expect(screen.getByTestId("pln-prompt").textContent).toBe("選一顆星球！");
  });

  it("顯示已選擇人數", () => {
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-form")).toBeTruthy();
    expect(screen.getByTestId("pln-reason-input")).toBeTruthy();
    expect(screen.getByTestId("pln-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 顆星球按鈕", () => {
    render(<PlanetType {...defaultProps} />);
    ["mercury","venus","earth","mars","jupiter","saturn","uranus","neptune","pluto"].forEach((id) => {
      expect(screen.getByTestId(`pln-planet-${id}`)).toBeTruthy();
    });
  });

  it("未選星球時提交按鈕 disabled", () => {
    render(<PlanetType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("pln-reason-input"), { target: { value: "包容踏實生生不息" } });
    const btn = screen.getByTestId("pln-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選星球但原因太短時 disabled", () => {
    render(<PlanetType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pln-planet-saturn"));
    fireEvent.change(screen.getByTestId("pln-reason-input"), { target: { value: "自律" } });
    const btn = screen.getByTestId("pln-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選星球且原因 ≥5 字時提交按鈕啟用", () => {
    render(<PlanetType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pln-planet-earth"));
    fireEvent.change(screen.getByTestId("pln-reason-input"), { target: { value: "包容踏實生生不息呼" } });
    const btn = screen.getByTestId("pln-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<PlanetType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pln-planet-mars"));
    fireEvent.change(screen.getByTestId("pln-reason-input"), { target: { value: "勇猛衝勁充滿鬥志感" } });
    fireEvent.click(screen.getByTestId("pln-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", planet: "jupiter", reason: "寬廣慷慨無所不包容納" }],
      revealed: false,
    };
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("pln-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<PlanetType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("pln-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<PlanetType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("pln-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<PlanetType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("pln-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 pln-result 和星球摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", planet: "neptune", reason: "夢幻直覺神秘深邃海洋" }],
      revealed: true,
    };
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-result")).toBeTruthy();
    expect(screen.getByTestId("pln-planet-summary")).toBeTruthy();
    expect(screen.getByTestId("pln-badge-neptune")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", planet: "uranus", reason: "革新創意突破所有傳統" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", planet: "pluto", reason: "轉化深層重生蛻變成長" },
      ],
      revealed: true,
    };
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("pln-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<PlanetType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("pln-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", planet: "venus", reason: "優雅美麗重視所有關係" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", planet: "mercury", reason: "快速多變反應靈敏超快" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", planet: "saturn", reason: "自律規律重視秩序感覺" },
      ],
      revealed: false,
    };
    render(<PlanetType {...defaultProps} />);
    expect(screen.getByTestId("pln-count").textContent).toContain("3");
  });
});
