import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThreeWords } from "../ThreeWords";

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

describe("ThreeWords", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<ThreeWords {...baseProps} config={{ title: "心情三字" }} />);
    expect(screen.getByTestId("tw-title").textContent).toContain("心情三字");
  });

  it("顯示預設標題", () => {
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-title").textContent).toContain("三個字");
  });

  it("顯示提示語", () => {
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-count").textContent).toContain("0");
  });

  it("顯示三個輸入框", () => {
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-form")).toBeTruthy();
    expect(screen.getByTestId("tw-word1")).toBeTruthy();
    expect(screen.getByTestId("tw-word2")).toBeTruthy();
    expect(screen.getByTestId("tw-word3")).toBeTruthy();
  });

  it("只填一個字時 disabled", () => {
    render(<ThreeWords {...baseProps} />);
    fireEvent.change(screen.getByTestId("tw-word1"), { target: { value: "熱情" } });
    expect((screen.getByTestId("tw-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("填滿三個字後可提交", () => {
    render(<ThreeWords {...baseProps} />);
    fireEvent.change(screen.getByTestId("tw-word1"), { target: { value: "熱情" } });
    fireEvent.change(screen.getByTestId("tw-word2"), { target: { value: "好奇" } });
    fireEvent.change(screen.getByTestId("tw-word3"), { target: { value: "感恩" } });
    expect((screen.getByTestId("tw-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<ThreeWords {...baseProps} />);
    fireEvent.change(screen.getByTestId("tw-word1"), { target: { value: "創意" } });
    fireEvent.change(screen.getByTestId("tw-word2"), { target: { value: "專注" } });
    fireEvent.change(screen.getByTestId("tw-word3"), { target: { value: "開放" } });
    fireEvent.click(screen.getByTestId("tw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { words: string[] }[];
    };
    expect(call.entries[0].words).toEqual(["創意", "專注", "開放"]);
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        words: ["活力", "熱血", "勇氣"],
      }],
      revealed: false,
    };
    render(<ThreeWords {...baseProps} />);
    const el = screen.getByTestId("tw-my-entry");
    expect(el.textContent).toContain("活力");
    expect(el.textContent).toContain("熱血");
    expect(el.textContent).toContain("勇氣");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<ThreeWords {...baseProps} />);
    expect(screen.queryByTestId("tw-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<ThreeWords {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("tw-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-empty")).toBeTruthy();
  });

  it("revealed 顯示字詞牆與成員清單", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", words: ["熱情", "創意", "開放"] },
        { entryId: "u2-1", userId: "u2", userName: "Bob", words: ["冷靜", "專注", "執行"] },
      ],
      revealed: true,
    };
    render(<ThreeWords {...baseProps} />);
    expect(screen.getByTestId("tw-result")).toBeTruthy();
    expect(screen.getByTestId("tw-word-wall")).toBeTruthy();
    expect(screen.getByTestId("tw-member-list")).toBeTruthy();
    expect(screen.getByTestId("tw-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("tw-card-u2-1")).toBeTruthy();
  });
});
