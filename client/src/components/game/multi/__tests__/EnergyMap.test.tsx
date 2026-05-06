import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnergyMap } from "../EnergyMap";

let mockIsLoaded = true;
let mockState: Record<string, unknown> = { entries: [], revealed: false };
const mockUpdateState = vi.fn();

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "Alice", email: "alice@test.com" },
  }),
}));

const baseProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("EnergyMap", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<EnergyMap {...baseProps} config={{ title: "狀態雷達" }} />);
    expect(screen.getByTestId("em-title").textContent).toContain("狀態雷達");
  });

  it("顯示預設標題", () => {
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-title").textContent).toContain("能量地圖");
  });

  it("顯示提示語", () => {
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-prompt")).toBeTruthy();
  });

  it("顯示已標記數量", () => {
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-count").textContent).toContain("0");
  });

  it("顯示 4 個象限選項", () => {
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-form")).toBeTruthy();
    expect(screen.getByTestId("em-quadrant-high-high")).toBeTruthy();
    expect(screen.getByTestId("em-quadrant-high-low")).toBeTruthy();
    expect(screen.getByTestId("em-quadrant-low-high")).toBeTruthy();
    expect(screen.getByTestId("em-quadrant-low-low")).toBeTruthy();
  });

  it("點選象限後呼叫 updateState", () => {
    render(<EnergyMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("em-quadrant-high-high"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { energy: string; will: string }[];
    };
    expect(call.entries[0].energy).toBe("high");
    expect(call.entries[0].will).toBe("high");
  });

  it("點選低能量低意願象限", () => {
    render(<EnergyMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("em-quadrant-low-low"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { energy: string; will: string }[];
    };
    expect(call.entries[0].energy).toBe("low");
    expect(call.entries[0].will).toBe("low");
  });

  it("已標記顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        energy: "high", will: "high", note: "",
      }],
      revealed: false,
    };
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-my-entry")).toBeTruthy();
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<EnergyMap {...baseProps} />);
    expect(screen.queryByTestId("em-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<EnergyMap {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("em-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-empty")).toBeTruthy();
  });

  it("revealed 顯示 4 個象限格子", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", energy: "high", will: "high", note: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", energy: "low", will: "high", note: "" },
      ],
      revealed: true,
    };
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-result")).toBeTruthy();
    expect(screen.getByTestId("em-cell-high-high")).toBeTruthy();
    expect(screen.getByTestId("em-cell-low-high")).toBeTruthy();
  });

  it("revealed 顯示成員卡片列表", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", energy: "high", will: "high", note: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", energy: "low", will: "low", note: "" },
      ],
      revealed: true,
    };
    render(<EnergyMap {...baseProps} />);
    expect(screen.getByTestId("em-member-list")).toBeTruthy();
    expect(screen.getByTestId("em-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("em-card-u2-1")).toBeTruthy();
  });
});
