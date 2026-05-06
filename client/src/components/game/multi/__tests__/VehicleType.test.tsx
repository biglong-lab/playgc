import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VehicleType } from "../VehicleType";

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

describe("VehicleType", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-loading")).toBeTruthy();
  });

  it("顯示預設標題和提示文字", () => {
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-title").textContent).toBe("我是哪種交通工具");
    expect(screen.getByTestId("veh-prompt").textContent).toContain("交通工具");
  });

  it("自訂 config 標題", () => {
    render(<VehicleType {...defaultProps} config={{ title: "你的移動風格", prompt: "選一種工具！" }} />);
    expect(screen.getByTestId("veh-title").textContent).toBe("你的移動風格");
    expect(screen.getByTestId("veh-prompt").textContent).toBe("選一種工具！");
  });

  it("顯示已選擇人數", () => {
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-count").textContent).toContain("0");
  });

  it("表單初始顯示", () => {
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-form")).toBeTruthy();
    expect(screen.getByTestId("veh-reason-input")).toBeTruthy();
    expect(screen.getByTestId("veh-submit-btn")).toBeTruthy();
  });

  it("顯示所有 9 種交通工具按鈕", () => {
    render(<VehicleType {...defaultProps} />);
    ["bicycle","motorcycle","suv","sportscar","train","airplane","sailboat","hotairballoon","submarine"].forEach((id) => {
      expect(screen.getByTestId(`veh-vehicle-${id}`)).toBeTruthy();
    });
  });

  it("未選工具時提交按鈕 disabled", () => {
    render(<VehicleType {...defaultProps} />);
    fireEvent.change(screen.getByTestId("veh-reason-input"), { target: { value: "自由悠閒享受過程" } });
    const btn = screen.getByTestId("veh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選工具但原因太短時 disabled", () => {
    render(<VehicleType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("veh-vehicle-train"));
    fireEvent.change(screen.getByTestId("veh-reason-input"), { target: { value: "穩定" } });
    const btn = screen.getByTestId("veh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("選工具且原因 ≥5 字時提交按鈕啟用", () => {
    render(<VehicleType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("veh-vehicle-airplane"));
    fireEvent.change(screen.getByTestId("veh-reason-input"), { target: { value: "大格局視野宏遠超廣" } });
    const btn = screen.getByTestId("veh-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("提交後呼叫 updateState 並新增 entry", () => {
    render(<VehicleType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("veh-vehicle-bicycle"));
    fireEvent.change(screen.getByTestId("veh-reason-input"), { target: { value: "自由悠閒享受過程感覺" } });
    fireEvent.click(screen.getByTestId("veh-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const newState = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(newState.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry 隱藏 form", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", vehicle: "sailboat", reason: "順勢而為乘風破浪前行" }],
      revealed: false,
    };
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-my-entry")).toBeTruthy();
    expect(screen.queryByTestId("veh-form")).toBeNull();
  });

  it("isTeamLead 可見揭曉按鈕", () => {
    render(<VehicleType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("veh-reveal-btn")).toBeTruthy();
  });

  it("非 teamLead 不顯示揭曉按鈕", () => {
    render(<VehicleType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("veh-reveal-btn")).toBeNull();
  });

  it("揭曉後更新 state revealed=true", () => {
    render(<VehicleType {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("veh-reveal-btn"));
    const called = mockUpdateState.mock.calls[0][0] as { revealed: boolean };
    expect(called.revealed).toBe(true);
  });

  it("揭曉後無 entries 顯示 empty", () => {
    mockState = { entries: [], revealed: true };
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-empty")).toBeTruthy();
  });

  it("揭曉後有 entries 顯示 veh-result 和交通工具摘要", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Alice", vehicle: "hotairballoon", reason: "浪漫理想悠然自在飄" }],
      revealed: true,
    };
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-result")).toBeTruthy();
    expect(screen.getByTestId("veh-vehicle-summary")).toBeTruthy();
    expect(screen.getByTestId("veh-badge-hotairballoon")).toBeTruthy();
  });

  it("每個 entry 顯示對應卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", vehicle: "sportscar", reason: "熱情速度追求卓越表現" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", vehicle: "submarine", reason: "深邃內斂靜水流深感" },
      ],
      revealed: true,
    };
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("veh-card-u2-1")).toBeTruthy();
  });

  it("已揭曉後不再顯示揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<VehicleType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("veh-reveal-btn")).toBeNull();
  });

  it("已選擇人數隨 entries 更新", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", vehicle: "motorcycle", reason: "靈活機動隨機應變能力" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", vehicle: "suv", reason: "穩重踏實全能應對挑戰" },
        { entryId: "u3-1", userId: "u3", userName: "Cara", vehicle: "train", reason: "按部就班守時穩定前進" },
      ],
      revealed: false,
    };
    render(<VehicleType {...defaultProps} />);
    expect(screen.getByTestId("veh-count").textContent).toContain("3");
  });
});
