import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TalentSwap } from "../TalentSwap";

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

describe("TalentSwap", () => {
  it("loading 狀態顯示 spinner", () => {
    mockIsLoaded = false;
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-loading")).toBeTruthy();
  });

  it("顯示自訂標題", () => {
    render(<TalentSwap {...baseProps} config={{ title: "知識交換台" }} />);
    expect(screen.getByTestId("ts-title").textContent).toContain("知識交換台");
  });

  it("顯示預設標題", () => {
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-title").textContent).toContain("技能交換市集");
  });

  it("顯示已提交數量", () => {
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-count").textContent).toContain("0");
  });

  it("顯示表單", () => {
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-form")).toBeTruthy();
  });

  it("未填寫時提交按鈕 disabled", () => {
    render(<TalentSwap {...baseProps} />);
    const btn = screen.getByTestId("ts-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("只填一半時按鈕仍 disabled", () => {
    render(<TalentSwap {...baseProps} />);
    fireEvent.change(screen.getByTestId("ts-teach-skill"), {
      target: { value: "Excel 資料分析" },
    });
    expect((screen.getByTestId("ts-submit-btn") as HTMLButtonElement).disabled).toBe(true);
  });

  it("全部填寫後按鈕可用", () => {
    render(<TalentSwap {...baseProps} />);
    fireEvent.change(screen.getByTestId("ts-teach-skill"), {
      target: { value: "Excel 資料分析" },
    });
    fireEvent.change(screen.getByTestId("ts-teach-target"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByTestId("ts-learn-skill"), {
      target: { value: "公開演講" },
    });
    fireEvent.change(screen.getByTestId("ts-learn-target"), {
      target: { value: "Carol" },
    });
    expect((screen.getByTestId("ts-submit-btn") as HTMLButtonElement).disabled).toBe(false);
  });

  it("提交後呼叫 updateState 含正確欄位", () => {
    render(<TalentSwap {...baseProps} />);
    fireEvent.change(screen.getByTestId("ts-teach-skill"), {
      target: { value: "Python 程式" },
    });
    fireEvent.change(screen.getByTestId("ts-teach-target"), {
      target: { value: "Dave" },
    });
    fireEvent.change(screen.getByTestId("ts-learn-skill"), {
      target: { value: "設計思考" },
    });
    fireEvent.change(screen.getByTestId("ts-learn-target"), {
      target: { value: "Eve" },
    });
    fireEvent.click(screen.getByTestId("ts-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalled();
    const call = mockUpdateState.mock.calls[0][0] as {
      entries: {
        teachSkill: string;
        teachTarget: string;
        learnSkill: string;
        learnTarget: string;
      }[];
    };
    expect(call.entries[0].teachSkill).toBe("Python 程式");
    expect(call.entries[0].teachTarget).toBe("Dave");
    expect(call.entries[0].learnSkill).toBe("設計思考");
    expect(call.entries[0].learnTarget).toBe("Eve");
  });

  it("已提交顯示 my-entry", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        teachSkill: "資料分析", teachTarget: "Bob",
        learnSkill: "簡報設計", learnTarget: "Carol",
      }],
      revealed: false,
    };
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-my-entry").textContent).toContain("資料分析");
  });

  it("非 isTeamLead 不顯示揭示按鈕", () => {
    render(<TalentSwap {...baseProps} />);
    expect(screen.queryByTestId("ts-reveal-btn")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕並可點擊", () => {
    render(<TalentSwap {...baseProps} isTeamLead />);
    fireEvent.click(screen.getByTestId("ts-reveal-btn"));
    expect(mockUpdateState).toHaveBeenCalledWith(expect.objectContaining({ revealed: true }));
  });

  it("revealed 空狀態顯示提示", () => {
    mockState = { entries: [], revealed: true };
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-empty")).toBeTruthy();
  });

  it("revealed 顯示提案卡片", () => {
    mockState = {
      entries: [
        {
          entryId: "u1-1", userId: "u1", userName: "Alice",
          teachSkill: "Python", teachTarget: "Bob",
          learnSkill: "設計", learnTarget: "Carol",
        },
        {
          entryId: "u2-1", userId: "u2", userName: "Bob",
          teachSkill: "Figma", teachTarget: "Alice",
          learnSkill: "Python", learnTarget: "Alice",
        },
      ],
      revealed: true,
    };
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-result")).toBeTruthy();
    expect(screen.getByTestId("ts-card-u1-1")).toBeTruthy();
    expect(screen.getByTestId("ts-card-u2-1")).toBeTruthy();
  });

  it("revealed 顯示匹配地圖", () => {
    mockState = {
      entries: [{
        entryId: "u1-1", userId: "u1", userName: "Alice",
        teachSkill: "Python", teachTarget: "Bob",
        learnSkill: "設計", learnTarget: "Carol",
      }],
      revealed: true,
    };
    render(<TalentSwap {...baseProps} />);
    expect(screen.getByTestId("ts-match-map")).toBeTruthy();
  });
});
