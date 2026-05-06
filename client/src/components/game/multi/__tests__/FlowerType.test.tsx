import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FlowerType } from "../FlowerType";

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
  useAuth: () => ({ user: { id: "u1", firstName: "Tester", email: "t@test.com" } }),
}));

const defaultProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
};

beforeEach(() => {
  mockIsLoaded = true;
  mockState = { entries: [], revealed: false };
  mockUpdateState.mockClear();
});

describe("FlowerType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-title")).toHaveTextContent("我是哪種花");
  });

  it("顯示自訂標題", () => {
    render(<FlowerType {...defaultProps} config={{ title: "花卉性格測驗" }} />);
    expect(screen.getByTestId("flo-title")).toHaveTextContent("花卉性格測驗");
  });

  it("顯示預設 prompt", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<FlowerType {...defaultProps} config={{ prompt: "你是什麼花？" }} />);
    expect(screen.getByTestId("flo-prompt")).toHaveTextContent("你是什麼花？");
  });

  it("顯示已選人數", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-form")).toBeInTheDocument();
  });

  it("顯示所有花朵選項", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-flower-rose")).toBeInTheDocument();
    expect(screen.getByTestId("flo-flower-lily")).toBeInTheDocument();
    expect(screen.getByTestId("flo-flower-tulip")).toBeInTheDocument();
    expect(screen.getByTestId("flo-flower-lavender")).toBeInTheDocument();
  });

  it("未選花朵時提交按鈕 disabled", () => {
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-submit-btn")).toBeDisabled();
  });

  it("選花朵但理由不足 5 字時提交按鈕 disabled", () => {
    render(<FlowerType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("flo-flower-rose"));
    fireEvent.change(screen.getByTestId("flo-reason-input"), { target: { value: "美" } });
    expect(screen.getByTestId("flo-submit-btn")).toBeDisabled();
  });

  it("選花朵且理由足夠時可提交", () => {
    render(<FlowerType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("flo-flower-peony"));
    fireEvent.change(screen.getByTestId("flo-reason-input"), { target: { value: "氣場強大很有魄力" } });
    expect(screen.getByTestId("flo-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<FlowerType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("flo-flower-lily"));
    fireEvent.change(screen.getByTestId("flo-reason-input"), { target: { value: "優雅高貴喜歡純粹" } });
    fireEvent.click(screen.getByTestId("flo-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].flower).toBe("lily");
    expect(call.entries[0].reason).toBe("優雅高貴喜歡純粹");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", flower: "tulip", reason: "精緻完美注重品味" }],
      revealed: false,
    };
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("flo-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<FlowerType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("flo-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<FlowerType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("flo-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", flower: "daisy", reason: "自然純樸親切可愛" }],
      revealed: true,
    };
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-result")).toBeInTheDocument();
    expect(screen.getByTestId("flo-flower-summary")).toBeInTheDocument();
    expect(screen.getByTestId("flo-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示花朵徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", flower: "iris", reason: "神秘獨特充滿個性" }],
      revealed: true,
    };
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-badge-iris")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-xyz", userId: "u1", userName: "Tester", flower: "chrysanthemum", reason: "堅毅長久不放棄" }],
      revealed: true,
    };
    render(<FlowerType {...defaultProps} />);
    expect(screen.getByTestId("flo-card-u1-xyz")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<FlowerType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("flo-reveal-btn")).not.toBeInTheDocument();
  });
});
