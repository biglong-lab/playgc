import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PastaType } from "../PastaType";

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

describe("PastaType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-title")).toHaveTextContent("我是哪種義大利麵");
  });

  it("顯示自訂標題", () => {
    render(<PastaType {...defaultProps} config={{ title: "義大利麵個性測驗" }} />);
    expect(screen.getByTestId("pst-title")).toHaveTextContent("義大利麵個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<PastaType {...defaultProps} config={{ prompt: "你是什麼義大利麵？" }} />);
    expect(screen.getByTestId("pst-prompt")).toHaveTextContent("你是什麼義大利麵？");
  });

  it("顯示已選人數", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-form")).toBeInTheDocument();
  });

  it("顯示所有義大利麵選項", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-pasta-spaghetti")).toBeInTheDocument();
    expect(screen.getByTestId("pst-pasta-penne")).toBeInTheDocument();
    expect(screen.getByTestId("pst-pasta-lasagna")).toBeInTheDocument();
    expect(screen.getByTestId("pst-pasta-ravioli")).toBeInTheDocument();
  });

  it("未選義大利麵時提交按鈕 disabled", () => {
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-submit-btn")).toBeDisabled();
  });

  it("選義大利麵但理由不足 5 字時提交按鈕 disabled", () => {
    render(<PastaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pst-pasta-penne"));
    fireEvent.change(screen.getByTestId("pst-reason-input"), { target: { value: "直接" } });
    expect(screen.getByTestId("pst-submit-btn")).toBeDisabled();
  });

  it("選義大利麵且理由足夠時可提交", () => {
    render(<PastaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pst-pasta-fusilli"));
    fireEvent.change(screen.getByTestId("pst-reason-input"), { target: { value: "靈活旋轉充滿活力" } });
    expect(screen.getByTestId("pst-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<PastaType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("pst-pasta-gnocchi"));
    fireEvent.change(screen.getByTestId("pst-reason-input"), { target: { value: "柔軟溫暖家的味道" } });
    fireEvent.click(screen.getByTestId("pst-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].pasta).toBe("gnocchi");
    expect(call.entries[0].reason).toBe("柔軟溫暖家的味道");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", pasta: "lasagna", reason: "層層豐富多面深度" }],
      revealed: false,
    };
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("pst-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<PastaType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("pst-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<PastaType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("pst-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", pasta: "fettuccine", reason: "寬厚穩重包容萬事" }],
      revealed: true,
    };
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-result")).toBeInTheDocument();
    expect(screen.getByTestId("pst-pasta-summary")).toBeInTheDocument();
    expect(screen.getByTestId("pst-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示義大利麵徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", pasta: "tagliatelle", reason: "金黃絲滑細膩優雅" }],
      revealed: true,
    };
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-badge-tagliatelle")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-stu", userId: "u1", userName: "Tester", pasta: "rigatoni", reason: "紮實有力飽滿充沛" }],
      revealed: true,
    };
    render(<PastaType {...defaultProps} />);
    expect(screen.getByTestId("pst-card-u1-stu")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<PastaType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("pst-reveal-btn")).not.toBeInTheDocument();
  });
});
