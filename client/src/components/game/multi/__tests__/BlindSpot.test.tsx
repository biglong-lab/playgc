import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BlindSpot } from "../BlindSpot";

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

describe("BlindSpot", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<BlindSpot {...baseProps} config={{ title: "成長盲區" }} />);
    expect(screen.getByTestId("bs-title").textContent).toContain("成長盲區");
  });

  it("顯示預設標題", () => {
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-title").textContent).toContain("盲點揭示");
  });

  it("顯示已揭示數量", () => {
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-count").textContent).toContain("0");
  });

  it("顯示提示與表單", () => {
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-prompt")).toBeTruthy();
    expect(screen.getByTestId("bs-form")).toBeTruthy();
  });

  it("顯示意識程度選擇", () => {
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-awareness-picker")).toBeTruthy();
    expect(screen.getByTestId("bs-awareness-none")).toBeTruthy();
    expect(screen.getByTestId("bs-awareness-some")).toBeTruthy();
    expect(screen.getByTestId("bs-awareness-growing")).toBeTruthy();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<BlindSpot {...baseProps} />);
    const btn = screen.getByTestId("bs-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填入盲點描述後可提交", () => {
    render(<BlindSpot {...baseProps} />);
    fireEvent.change(screen.getByTestId("bs-blind-input"), {
      target: { value: "開會時話太多，讓別人沒有空間說話" },
    });
    expect((screen.getByTestId("bs-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("可以切換意識程度", () => {
    render(<BlindSpot {...baseProps} />);
    fireEvent.click(screen.getByTestId("bs-awareness-growing"));
    expect(screen.getByTestId("bs-awareness-growing").className).toContain("border-indigo-400");
  });

  it("提交後呼叫 updateState", () => {
    render(<BlindSpot {...baseProps} />);
    fireEvent.change(screen.getByTestId("bs-blind-input"), {
      target: { value: "容易打斷別人說話" },
    });
    fireEvent.change(screen.getByTestId("bs-self-input"), { target: { value: "急性子使然" } });
    fireEvent.change(screen.getByTestId("bs-action-input"), { target: { value: "練習先聽完" } });
    fireEvent.click(screen.getByTestId("bs-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { blindSpot: string; action: string }[];
    };
    expect(call.entries[0].blindSpot).toBe("容易打斷別人說話");
    expect(call.entries[0].action).toBe("練習先聽完");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        blindSpot: "完美主義讓我拖延", selfAware: "", action: "設定截止時間",
      }],
      revealed: false,
    };
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-my-entry").textContent).toContain("完美主義讓我拖延");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<BlindSpot {...baseProps} />);
    expect(screen.queryByTestId("bs-reveal-btn")).toBeNull();
  });

  it("isTeamLead 可以揭示", () => {
    render(<BlindSpot {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("bs-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-empty")).toBeTruthy();
  });

  it("revealed 顯示盲點卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", blindSpot: "避免衝突", selfAware: "不敢說NO", action: "" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", blindSpot: "過度承諾導致交付品質下降", selfAware: "", action: "量力而為" },
      ],
      revealed: true,
    };
    render(<BlindSpot {...baseProps} />);
    expect(screen.getByTestId("bs-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("bs-card-u2-1").textContent).toContain("量力而為");
  });
});
