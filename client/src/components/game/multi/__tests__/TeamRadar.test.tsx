import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamRadar } from "../TeamRadar";

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

describe("TeamRadar", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<TeamRadar {...baseProps} config={{ title: "健康雷達" }} />);
    expect(screen.getByTestId("tr-title").textContent).toContain("健康雷達");
  });

  it("顯示預設標題", () => {
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-title").textContent).toContain("團隊雷達");
  });

  it("顯示提示語", () => {
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-prompt")).toBeTruthy();
  });

  it("顯示已評分數量", () => {
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-count").textContent).toContain("0");
  });

  it("顯示 5 個評分面向", () => {
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-form")).toBeTruthy();
    expect(screen.getByTestId("tr-dim-effectiveness")).toBeTruthy();
    expect(screen.getByTestId("tr-dim-communication")).toBeTruthy();
    expect(screen.getByTestId("tr-dim-trust")).toBeTruthy();
    expect(screen.getByTestId("tr-dim-energy")).toBeTruthy();
    expect(screen.getByTestId("tr-dim-innovation")).toBeTruthy();
  });

  it("未全部評分時 disabled", () => {
    render(<TeamRadar {...baseProps} />);
    fireEvent.click(screen.getByTestId("tr-score-effectiveness-4"));
    expect((screen.getByTestId("tr-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("全部評分後可提交", () => {
    render(<TeamRadar {...baseProps} />);
    fireEvent.click(screen.getByTestId("tr-score-effectiveness-4"));
    fireEvent.click(screen.getByTestId("tr-score-communication-3"));
    fireEvent.click(screen.getByTestId("tr-score-trust-5"));
    fireEvent.click(screen.getByTestId("tr-score-energy-2"));
    fireEvent.click(screen.getByTestId("tr-score-innovation-4"));
    expect((screen.getByTestId("tr-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<TeamRadar {...baseProps} />);
    fireEvent.click(screen.getByTestId("tr-score-effectiveness-5"));
    fireEvent.click(screen.getByTestId("tr-score-communication-4"));
    fireEvent.click(screen.getByTestId("tr-score-trust-3"));
    fireEvent.click(screen.getByTestId("tr-score-energy-4"));
    fireEvent.click(screen.getByTestId("tr-score-innovation-5"));
    fireEvent.click(screen.getByTestId("tr-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { scores: Record<string, number> }[];
    };
    expect(call.entries[0].scores.effectiveness).toBe(5);
    expect(call.entries[0].scores.communication).toBe(4);
    expect(call.entries[0].scores.trust).toBe(3);
  });

  it("已評分顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        scores: { effectiveness: 4, communication: 3, trust: 5, energy: 4, innovation: 3 },
      }],
      revealed: false,
    };
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-my-entry")).toBeTruthy();
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<TeamRadar {...baseProps} />);
    expect(screen.queryByTestId("tr-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<TeamRadar {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tr-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-empty")).toBeTruthy();
  });

  it("revealed 顯示平均分數", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", scores: { effectiveness: 4, communication: 3, trust: 5, energy: 4, innovation: 3 } },
        { entryId: "u2-1", userId: "u2", userName: "Bob", scores: { effectiveness: 3, communication: 4, trust: 4, energy: 5, innovation: 4 } },
      ],
      revealed: true,
    };
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-result")).toBeTruthy();
    expect(screen.getByTestId("tr-avg-scores")).toBeTruthy();
    expect(screen.getByTestId("tr-avg-effectiveness")).toBeTruthy();
    expect(screen.getByTestId("tr-avg-trust")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", scores: { effectiveness: 4, communication: 3, trust: 5, energy: 4, innovation: 3 } },
        { entryId: "u2-1", userId: "u2", userName: "Bob", scores: { effectiveness: 3, communication: 4, trust: 4, energy: 5, innovation: 4 } },
      ],
      revealed: true,
    };
    render(<TeamRadar {...baseProps} />);
    expect(screen.getByTestId("tr-member-list")).toBeTruthy();
    expect(screen.getByTestId("tr-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tr-card-u2-1")).toBeTruthy();
  });
});
