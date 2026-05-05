import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExpectationBoard } from "../ExpectationBoard";

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

describe("ExpectationBoard", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-title").textContent).toBe("期望看板");
  });

  test("顯示自訂 config", () => {
    render(<ExpectationBoard {...defaultProps} config={{ title: "Expectation Wall" }} />);
    expect(screen.getByTestId("eb-title").textContent).toBe("Expectation Wall");
  });

  test("顯示兩個標籤", () => {
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-expect-label")).toBeDefined();
    expect(screen.getByTestId("eb-contribute-label")).toBeDefined();
  });

  test("顯示已填寫人數", () => {
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-count").textContent).toContain("0");
  });

  test("兩欄都空時提交鈕禁用", () => {
    render(<ExpectationBoard {...defaultProps} />);
    const btn = screen.getByTestId("eb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("填一欄即可提交", () => {
    render(<ExpectationBoard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("eb-expect-input"), { target: { value: "學到新東西" } });
    const btn = screen.getByTestId("eb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 expectation 與 contribution", () => {
    render(<ExpectationBoard {...defaultProps} />);
    fireEvent.change(screen.getByTestId("eb-expect-input"), { target: { value: "認識新朋友" } });
    fireEvent.change(screen.getByTestId("eb-contribute-input"), { target: { value: "我的設計能力" } });
    fireEvent.click(screen.getByTestId("eb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ expectation: string; contribution: string }>;
    };
    expect(called.entries[0].expectation).toBe("認識新朋友");
    expect(called.entries[0].contribution).toBe("我的設計能力");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u1",
          userName: "小明",
          expectation: "成長",
          contribution: "熱情",
        },
      ],
      revealed: false,
    };
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<ExpectationBoard {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("eb-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<ExpectationBoard {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("eb-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<ExpectationBoard {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("eb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示結果卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "e1",
          userId: "u2",
          userName: "小華",
          expectation: "A",
          contribution: "B",
        },
      ],
      revealed: true,
    };
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-result")).toBeDefined();
    expect(screen.getByTestId("eb-card-e1")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<ExpectationBoard {...defaultProps} />);
    expect(screen.getByTestId("eb-empty")).toBeDefined();
  });
});
