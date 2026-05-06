import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FavMemory } from "../FavMemory";

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

describe("FavMemory", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<FavMemory {...baseProps} config={{ title: "難忘時光" }} />);
    expect(screen.getByTestId("fm-title").textContent).toContain("難忘時光");
  });

  it("顯示預設標題", () => {
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-title").textContent).toContain("最愛回憶");
  });

  it("顯示提示語", () => {
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-prompt")).toBeTruthy();
  });

  it("顯示已分享數量", () => {
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-count").textContent).toContain("0");
  });

  it("顯示表單和 6 個時間選項", () => {
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-form")).toBeTruthy();
    expect(screen.getByTestId("fm-period-long_ago")).toBeTruthy();
    expect(screen.getByTestId("fm-period-five_years")).toBeTruthy();
    expect(screen.getByTestId("fm-period-few_years")).toBeTruthy();
    expect(screen.getByTestId("fm-period-last_year")).toBeTruthy();
    expect(screen.getByTestId("fm-period-this_year")).toBeTruthy();
    expect(screen.getByTestId("fm-period-recently")).toBeTruthy();
  });

  it("未選時間時 disabled", () => {
    render(<FavMemory {...baseProps} />);
    fireEvent.change(screen.getByTestId("fm-memory-input"), { target: { value: "那次一起爬山的回憶" } });
    expect((screen.getByTestId("fm-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("未填回憶時 disabled", () => {
    render(<FavMemory {...baseProps} />);
    fireEvent.click(screen.getByTestId("fm-period-recently"));
    expect((screen.getByTestId("fm-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("回憶少於5字時 disabled", () => {
    render(<FavMemory {...baseProps} />);
    fireEvent.click(screen.getByTestId("fm-period-this_year"));
    fireEvent.change(screen.getByTestId("fm-memory-input"), { target: { value: "旅行" } });
    expect((screen.getByTestId("fm-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("選時間且填回憶後可提交", () => {
    render(<FavMemory {...baseProps} />);
    fireEvent.click(screen.getByTestId("fm-period-last_year"));
    fireEvent.change(screen.getByTestId("fm-memory-input"), { target: { value: "去年一起去日本賞楓葉的旅行" } });
    expect((screen.getByTestId("fm-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<FavMemory {...baseProps} />);
    fireEvent.click(screen.getByTestId("fm-period-five_years"));
    fireEvent.change(screen.getByTestId("fm-memory-input"), { target: { value: "第一次一起出國的緊張又興奮" } });
    fireEvent.click(screen.getByTestId("fm-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as { entries: { memory: string; period: string }[] };
    expect(call.entries[0].memory).toBe("第一次一起出國的緊張又興奮");
    expect(call.entries[0].period).toBe("five_years");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        memory: "婚禮上我們一起跳舞的那晚", period: "this_year",
      }],
      revealed: false,
    };
    render(<FavMemory {...baseProps} />);
    const el = screen.getByTestId("fm-my-entry");
    expect(el.textContent).toContain("婚禮上我們一起跳舞的那晚");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<FavMemory {...baseProps} />);
    expect(screen.queryByTestId("fm-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<FavMemory {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("fm-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(
      expect.objectContaining({ revealed: true }),
    );
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-empty")).toBeTruthy();
  });

  it("revealed 顯示回憶牆與卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", memory: "一起在海邊看日出", period: "recently" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", memory: "第一次見面時完全不認識", period: "long_ago" },
      ],
      revealed: true,
    };
    render(<FavMemory {...baseProps} />);
    expect(screen.getByTestId("fm-result")).toBeTruthy();
    expect(screen.getByTestId("fm-memory-wall")).toBeTruthy();
    expect(screen.getByTestId("fm-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("fm-card-u2-1")).toBeTruthy();
  });
});
