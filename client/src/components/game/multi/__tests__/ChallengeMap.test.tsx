import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChallengeMap } from "../ChallengeMap";

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

describe("ChallengeMap", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<ChallengeMap {...baseProps} config={{ title: "困難清單" }} />);
    expect(screen.getByTestId("cm-title").textContent).toContain("困難清單");
  });

  it("顯示預設標題", () => {
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-title").textContent).toContain("挑戰地圖");
  });

  it("顯示提示語", () => {
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-count").textContent).toContain("0");
  });

  it("顯示類別和嚴重程度選擇", () => {
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-categories")).toBeTruthy();
    expect(screen.getByTestId("cm-severity")).toBeTruthy();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<ChallengeMap {...baseProps} />);
    const btn = screen.getByTestId("cm-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("可以選擇類別", () => {
    render(<ChallengeMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("cm-cat-time"));
    fireEvent.click(screen.getByTestId("cm-cat-communication"));
  });

  it("可以選擇嚴重程度", () => {
    render(<ChallengeMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("cm-sev-high"));
    fireEvent.click(screen.getByTestId("cm-sev-low"));
  });

  it("填入挑戰後可提交", () => {
    render(<ChallengeMap {...baseProps} />);
    fireEvent.change(screen.getByTestId("cm-challenge-input"), {
      target: { value: "工作量太大，無法專注在最重要的事情上" },
    });
    expect((screen.getByTestId("cm-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<ChallengeMap {...baseProps} />);
    fireEvent.click(screen.getByTestId("cm-cat-resource"));
    fireEvent.click(screen.getByTestId("cm-sev-high"));
    fireEvent.change(screen.getByTestId("cm-challenge-input"), {
      target: { value: "預算不足以推進計畫到下一階段" },
    });
    fireEvent.click(screen.getByTestId("cm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { challenge: string; category: string; severity: string }[];
    };
    expect(call.entries[0].challenge).toBe("預算不足以推進計畫到下一階段");
    expect(call.entries[0].category).toBe("resource");
    expect(call.entries[0].severity).toBe("high");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        challenge: "跨部門溝通障礙太多", category: "communication", severity: "medium",
      }],
      revealed: false,
    };
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-my-entry").textContent).toContain("跨部門溝通障礙太多");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<ChallengeMap {...baseProps} />);
    expect(screen.queryByTestId("cm-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<ChallengeMap {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("cm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-empty")).toBeTruthy();
  });

  it("revealed 顯示挑戰卡片與類別統計", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", challenge: "技能不足", category: "skill", severity: "high" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", challenge: "時間不夠用", category: "time", severity: "medium" },
      ],
      revealed: true,
    };
    render(<ChallengeMap {...baseProps} />);
    expect(screen.getByTestId("cm-result")).toBeTruthy();
    expect(screen.getByTestId("cm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("cm-card-u2-1")).toBeTruthy();
    expect(screen.getByTestId("cm-category-stats")).toBeTruthy();
  });
});
