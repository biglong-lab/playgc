import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LearningObjective } from "../LearningObjective";

let mockState: Record<string, unknown> = { entries: [], participants: [], revealed: false };
let mockIsLoaded = true;
const mockUpdateState = vi.fn((next) => { mockState = next; });

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: mockIsLoaded,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "小明", email: "user@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockState = { entries: [], participants: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("LearningObjective", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-title").textContent).toBe("學習目標");
  });

  test("顯示自訂標題", () => {
    render(<LearningObjective {...defaultProps} config={{ title: "My Learning Goal" }} />);
    expect(screen.getByTestId("lo-title").textContent).toBe("My Learning Goal");
  });

  test("顯示 prompt", () => {
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-prompt")).toBeDefined();
  });

  test("顯示已設定人數", () => {
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-count").textContent).toContain("0");
  });

  test("輸入少於 3 字時提交鈕禁用", () => {
    render(<LearningObjective {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lo-input"), { target: { value: "學" } });
    const btn = screen.getByTestId("lo-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("輸入 3 字以上可提交", () => {
    render(<LearningObjective {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lo-input"), { target: { value: "學會溝通" } });
    const btn = screen.getByTestId("lo-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 objective", () => {
    render(<LearningObjective {...defaultProps} />);
    fireEvent.change(screen.getByTestId("lo-input"), { target: { value: "了解設計思考" } });
    fireEvent.click(screen.getByTestId("lo-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ objective: string; status: string }>;
    };
    expect(called.entries[0].objective).toBe("了解設計思考");
    expect(called.entries[0].status).toBe("pending");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u1",
          userName: "小明",
          objective: "學會設計思考",
          status: "pending",
        },
      ],
      participants: ["小明"],
      revealed: false,
    };
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<LearningObjective {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("lo-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<LearningObjective {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("lo-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<LearningObjective {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("lo-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片與狀態按鈕", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u1",
          userName: "小明",
          objective: "學會設計思考",
          status: "pending",
        },
      ],
      participants: ["小明"],
      revealed: true,
    };
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-result")).toBeDefined();
    expect(screen.getByTestId("lo-card-e1")).toBeDefined();
    expect(screen.getByTestId("lo-my-entry")).toBeDefined();
    expect(screen.getByTestId("lo-status-achieved")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], participants: [], revealed: true };
    render(<LearningObjective {...defaultProps} />);
    expect(screen.getByTestId("lo-empty")).toBeDefined();
  });
});
