import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TeamFlag } from "../TeamFlag";

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

describe("TeamFlag", () => {
  test("未載入時顯示 loading", () => {
    mockIsLoaded = false;
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-loading")).toBeDefined();
  });

  test("顯示預設標題", () => {
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-title").textContent).toBe("團隊旗幟");
  });

  test("顯示自訂標題", () => {
    render(<TeamFlag {...defaultProps} config={{ title: "我們的精神" }} />);
    expect(screen.getByTestId("tf-title").textContent).toBe("我們的精神");
  });

  test("顯示建議詞組", () => {
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-suggestions")).toBeDefined();
    expect(screen.getByTestId("tf-suggest-創新")).toBeDefined();
    expect(screen.getByTestId("tf-suggest-合作")).toBeDefined();
  });

  test("顯示已提交人數", () => {
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-count").textContent).toContain("0");
  });

  test("未選詞時提交鈕禁用", () => {
    render(<TeamFlag {...defaultProps} />);
    const btn = screen.getByTestId("tf-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  test("點選建議詞後可提交", () => {
    render(<TeamFlag {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tf-suggest-創新"));
    const btn = screen.getByTestId("tf-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  test("提交呼叫 updateState 帶 words 陣列", () => {
    render(<TeamFlag {...defaultProps} />);
    fireEvent.click(screen.getByTestId("tf-suggest-合作"));
    fireEvent.click(screen.getByTestId("tf-suggest-信任"));
    fireEvent.click(screen.getByTestId("tf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const called = mockUpdateState.mock.calls[0][0] as {
      entries: Array<{ words: string[] }>;
    };
    expect(called.entries[0].words).toContain("合作");
    expect(called.entries[0].words).toContain("信任");
  });

  test("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "小明", words: ["創新", "熱情"] }],
      revealed: false,
    };
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-my-entry")).toBeDefined();
  });

  test("非 teamLead 不顯示揭示按鈕", () => {
    render(<TeamFlag {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("tf-reveal-btn")).toBeNull();
  });

  test("isTeamLead=true 顯示揭示按鈕", () => {
    render(<TeamFlag {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("tf-reveal-btn")).toBeDefined();
  });

  test("點揭示呼叫 updateState revealed=true", () => {
    render(<TeamFlag {...defaultProps} isTeamLead={true} />);
    fireEvent.click(screen.getByTestId("tf-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  test("revealed=true 顯示詞雲結果", () => {
    mockState = {
      entries: [
        { entryId: "e1", userId: "u2", userName: "A", words: ["創新", "合作"] },
        { entryId: "e2", userId: "u3", userName: "B", words: ["創新", "信任"] },
      ],
      revealed: true,
    };
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-result")).toBeDefined();
    expect(screen.getByTestId("tf-word-創新")).toBeDefined();
  });

  test("revealed=true 且無資料顯示空訊息", () => {
    mockState = { entries: [], revealed: true };
    render(<TeamFlag {...defaultProps} />);
    expect(screen.getByTestId("tf-empty")).toBeDefined();
  });
});
