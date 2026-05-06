import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MotivationMap } from "../MotivationMap";

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

describe("MotivationMap", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<MotivationMap {...baseProps} config={{ title: "我的驅動力" }} />);
    expect(screen.getByTestId("mm-title").textContent).toContain("我的驅動力");
  });

  it("顯示預設標題", () => {
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-title").textContent).toContain("動力地圖");
  });

  it("顯示提示語", () => {
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-prompt")).toBeTruthy();
  });

  it("顯示已選擇數量", () => {
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-count").textContent).toContain("0");
  });

  it("顯示 6 個動力選項", () => {
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-form")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-mastery")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-connection")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-autonomy")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-purpose")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-recognition")).toBeTruthy();
    expect(screen.getByTestId("mm-cat-security")).toBeTruthy();
  });

  it("點選動力後呼叫 updateState（使命感）", () => {
    render(<MotivationMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("mm-cat-purpose"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { category: string }[];
    };
    expect(call.entries[0].category).toBe("purpose");
  });

  it("點選動力後呼叫 updateState（自主空間）", () => {
    render(<MotivationMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("mm-cat-autonomy"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { category: string }[];
    };
    expect(call.entries[0].category).toBe("autonomy");
  });

  it("已選擇顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        category: "mastery",
      }],
      revealed: false,
    };
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-my-entry").textContent).toContain("追求精進");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<MotivationMap {...baseProps} />);
    expect(screen.queryByTestId("mm-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<MotivationMap {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("mm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-empty")).toBeTruthy();
  });

  it("revealed 顯示各動力比例條", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", category: "purpose" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", category: "mastery" },
        { entryId: "u3-1", userId: "u3", userName: "Carol", category: "purpose" },
      ],
      revealed: true,
    };
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-result")).toBeTruthy();
    expect(screen.getByTestId("mm-bar-purpose")).toBeTruthy();
    expect(screen.getByTestId("mm-bar-mastery")).toBeTruthy();
  });

  it("revealed 顯示成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", category: "connection" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", category: "security" },
      ],
      revealed: true,
    };
    render(<MotivationMap {...baseProps} />);
    expect(screen.getByTestId("mm-member-list")).toBeTruthy();
    expect(screen.getByTestId("mm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("mm-card-u2-1")).toBeTruthy();
  });
});
