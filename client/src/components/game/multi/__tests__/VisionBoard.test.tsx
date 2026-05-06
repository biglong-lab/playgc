import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VisionBoard } from "../VisionBoard";

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

describe("VisionBoard", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<VisionBoard {...baseProps} config={{ title: "夢想版" }} />);
    expect(screen.getByTestId("vb-title").textContent).toContain("夢想版");
  });

  it("顯示預設標題", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-title").textContent).toContain("願景板");
  });

  it("顯示提示語", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-prompt")).toBeTruthy();
  });

  it("顯示已提交數量", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-form")).toBeTruthy();
  });

  it("可以選擇時間跨度", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-horizon-picker")).toBeTruthy();
    fireEvent.click(screen.getByTestId("vb-horizon-三年後"));
    fireEvent.click(screen.getByTestId("vb-horizon-半年後"));
  });

  it("少於 2 個關鍵詞時提交按鈕 disabled", () => {
    render(<VisionBoard {...baseProps} />);
    fireEvent.change(screen.getByTestId("vb-kw1"), {
      target: { value: "自由" },
    });
    const btn = screen.getByTestId("vb-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("2 個關鍵詞 + 一句話後可提交", () => {
    render(<VisionBoard {...baseProps} />);
    fireEvent.change(screen.getByTestId("vb-kw1"), {
      target: { value: "自由" },
    });
    fireEvent.change(screen.getByTestId("vb-kw2"), {
      target: { value: "創造" },
    });
    fireEvent.change(screen.getByTestId("vb-sentence-input"), {
      target: { value: "我想要建立一個有影響力的事業" },
    });
    expect((screen.getByTestId("vb-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<VisionBoard {...baseProps} />);
    fireEvent.click(screen.getByTestId("vb-horizon-五年後"));
    fireEvent.change(screen.getByTestId("vb-kw1"), {
      target: { value: "影響力" },
    });
    fireEvent.change(screen.getByTestId("vb-kw2"), {
      target: { value: "自主" },
    });
    fireEvent.change(screen.getByTestId("vb-kw3"), {
      target: { value: "平衡" },
    });
    fireEvent.change(screen.getByTestId("vb-sentence-input"), {
      target: { value: "成為能帶動他人的領導者" },
    });
    fireEvent.click(screen.getByTestId("vb-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: { keywords: string[]; sentence: string; horizon: string }[];
    };
    expect(call.entries[0].keywords).toContain("影響力");
    expect(call.entries[0].sentence).toBe("成為能帶動他人的領導者");
    expect(call.entries[0].horizon).toBe("五年後");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        keywords: ["成長", "連結"], sentence: "打造有溫度的社群", horizon: "一年後",
      }],
      revealed: false,
    };
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-my-entry").textContent).toContain("打造有溫度的社群");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<VisionBoard {...baseProps} />);
    expect(screen.queryByTestId("vb-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<VisionBoard {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("vb-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-empty")).toBeTruthy();
  });

  it("revealed 顯示願景卡片", () => {
    mockState = {
      entries: [
        { entryId: "u1-1", userId: "u1", userName: "Alice", keywords: ["自由", "創造"], sentence: "建立喜愛的事業", horizon: "三年後" },
        { entryId: "u2-1", userId: "u2", userName: "Bob", keywords: ["健康", "家庭"], sentence: "工作生活平衡", horizon: "一年後" },
      ],
      revealed: true,
    };
    render(<VisionBoard {...baseProps} />);
    expect(screen.getByTestId("vb-result")).toBeTruthy();
    expect(screen.getByTestId("vb-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("vb-card-u2-1")).toBeTruthy();
  });
});
