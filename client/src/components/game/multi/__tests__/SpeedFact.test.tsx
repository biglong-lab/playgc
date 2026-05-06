import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpeedFact } from "../SpeedFact";

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

describe("SpeedFact", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<SpeedFact {...baseProps} config={{ title: "你不知道的我" }} />);
    expect(screen.getByTestId("sf-title").textContent).toContain("你不知道的我");
  });

  it("顯示預設標題", () => {
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-title").textContent).toContain("閃速事實");
  });

  it("顯示提示語", () => {
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-count").textContent).toContain("0");
  });

  it("顯示表單和 6 個類別", () => {
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-form")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-talent")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-travel")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-food")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-skill")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-dream")).toBeTruthy();
    expect(screen.getByTestId("sf-cat-record")).toBeTruthy();
  });

  it("未選類別時 disabled", () => {
    render(<SpeedFact {...baseProps} />);
    fireEvent.change(screen.getByTestId("sf-fact-input"), { target: { value: "我會說五種語言" } });
    expect((screen.getByTestId("sf-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未填事實時 disabled", () => {
    render(<SpeedFact {...baseProps} />);
    fireEvent.click(screen.getByTestId("sf-cat-talent"));
    expect((screen.getByTestId("sf-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("事實少於5字時 disabled", () => {
    render(<SpeedFact {...baseProps} />);
    fireEvent.click(screen.getByTestId("sf-cat-travel"));
    fireEvent.change(screen.getByTestId("sf-fact-input"), { target: { value: "旅" } });
    expect((screen.getByTestId("sf-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選類別且填事實後可提交", () => {
    render(<SpeedFact {...baseProps} />);
    fireEvent.click(screen.getByTestId("sf-cat-skill"));
    fireEvent.change(screen.getByTestId("sf-fact-input"), { target: { value: "我會倒立走路" } });
    expect((screen.getByTestId("sf-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<SpeedFact {...baseProps} />);
    fireEvent.click(screen.getByTestId("sf-cat-dream"));
    fireEvent.change(screen.getByTestId("sf-fact-input"), { target: { value: "我夢想環遊世界80天" } });
    fireEvent.click(screen.getByTestId("sf-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { fact: string; category: string }[] };
    expect(call.entries[0].fact).toBe("我夢想環遊世界80天");
    expect(call.entries[0].category).toBe("dream");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        fact: "我曾爬過玉山", category: "record",
      }],
      revealed: false,
    };
    render(<SpeedFact {...baseProps} />);
    const el = screen.getByTestId("sf-my-entry");
    expect(el.textContent).toContain("我曾爬過玉山");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<SpeedFact {...baseProps} />);
    expect(screen.queryByTestId("sf-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<SpeedFact {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("sf-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-empty")).toBeTruthy();
  });

  it("revealed 顯示事實牆與卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", fact: "我會說五種語言", category: "talent" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", fact: "我去過60個國家", category: "travel" },
      ],
      revealed: true,
    };
    render(<SpeedFact {...baseProps} />);
    expect(screen.getByTestId("sf-result")).toBeTruthy();
    expect(screen.getByTestId("sf-fact-wall")).toBeTruthy();
    expect(screen.getByTestId("sf-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("sf-card-u2-1")).toBeTruthy();
  });
});
