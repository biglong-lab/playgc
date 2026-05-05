import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OpinionSlider } from "../OpinionSlider";

let mockState: Record<string, unknown> = { entries: [], revealed: false };
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
  mockState = { entries: [], revealed: false };
  mockIsLoaded = true;
  mockUpdateState.mockClear();
});

describe("OpinionSlider", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-loading")).toBeDefined();
  });

  test("顯示預設標題與問題", () => {
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-title").textContent).toBe("意見滑桿");
    expect(screen.getByTestId("os-question").textContent).toContain("立場");
  });

  test("顯示自訂 config", () => {
    render(<OpinionSlider {...defaultProps} config={{ title: "Opinion Poll", leftLabel: "反對", rightLabel: "支持" }} />);
    expect(screen.getByTestId("os-title").textContent).toBe("Opinion Poll");
    expect(screen.getByTestId("os-left-label").textContent).toBe("反對");
    expect(screen.getByTestId("os-right-label").textContent).toBe("支持");
  });

  test("顯示已回應人數", () => {
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-count").textContent).toContain("0");
  });

  test("顯示滑桿", () => {
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-slider")).toBeDefined();
  });

  test("提交鈕始終啟用（有預設值）", () => {
    render(<OpinionSlider {...defaultProps} />);
    const btn = screen.getByTestId("os-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 value", () => {
    render(<OpinionSlider {...defaultProps} />);
    fireEvent.change(screen.getByTestId("os-slider"), { target: { value: "75" } });
    fireEvent.click(screen.getByTestId("os-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as { entries: Array<{ value: number }> };
    expect(called.entries[0].value).toBe(75);
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", value: 60 }],
      revealed: false,
    };
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<OpinionSlider {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("os-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<OpinionSlider {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("os-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<OpinionSlider {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("os-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示平均標記與點", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "小華", value: 30 },
        { entryId: "e2", userId: "u3", userName: "小美", value: 70 },
      ],
      revealed: true,
    };
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-result")).toBeDefined();
    expect(screen.getByTestId("os-avg-marker")).toBeDefined();
    expect(screen.getByTestId("os-dot-e1")).toBeDefined();
    expect(screen.getByTestId("os-dot-e2")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<OpinionSlider {...defaultProps} />);
    expect(screen.getByTestId("os-empty")).toBeDefined();
  });
});
