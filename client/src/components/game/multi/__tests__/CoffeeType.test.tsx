import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoffeeType } from "../CoffeeType";

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

describe("CoffeeType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-title")).toHaveTextContent("我是哪種咖啡");
  });

  it("顯示自訂標題", () => {
    render(<CoffeeType {...defaultProps} config={{ title: "咖啡個性測驗" }} />);
    expect(screen.getByTestId("cof-title")).toHaveTextContent("咖啡個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<CoffeeType {...defaultProps} config={{ prompt: "你是什麼咖啡？" }} />);
    expect(screen.getByTestId("cof-prompt")).toHaveTextContent("你是什麼咖啡？");
  });

  it("顯示已選人數", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-form")).toBeInTheDocument();
  });

  it("顯示所有咖啡選項", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-coffee-espresso")).toBeInTheDocument();
    expect(screen.getByTestId("cof-coffee-latte")).toBeInTheDocument();
    expect(screen.getByTestId("cof-coffee-cappuccino")).toBeInTheDocument();
    expect(screen.getByTestId("cof-coffee-mocha")).toBeInTheDocument();
  });

  it("未選咖啡時提交按鈕 disabled", () => {
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-submit-btn")).toBeDisabled();
  });

  it("選咖啡但理由不足 5 字時提交按鈕 disabled", () => {
    render(<CoffeeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-coffee-espresso"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "濃" } });
    expect(screen.getByTestId("cof-submit-btn")).toBeDisabled();
  });

  it("選咖啡且理由足夠時可提交", () => {
    render(<CoffeeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-coffee-americano"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "低調務實不拖泥帶水" } });
    expect(screen.getByTestId("cof-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<CoffeeType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("cof-coffee-latte"));
    fireEvent.change(screen.getByTestId("cof-reason-input"), { target: { value: "溫和包容好相處啊" } });
    fireEvent.click(screen.getByTestId("cof-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].coffee).toBe("latte");
    expect(call.entries[0].reason).toBe("溫和包容好相處啊");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", coffee: "pour_over", reason: "講究過程享受細節" }],
      revealed: false,
    };
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("cof-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<CoffeeType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("cof-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<CoffeeType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("cof-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", coffee: "cold_brew", reason: "沉穩耐得住時間" }],
      revealed: true,
    };
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-result")).toBeInTheDocument();
    expect(screen.getByTestId("cof-coffee-summary")).toBeInTheDocument();
    expect(screen.getByTestId("cof-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示咖啡徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", coffee: "flat_white", reason: "簡約精準有品味的" }],
      revealed: true,
    };
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-badge-flat_white")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-def", userId: "u1", userName: "Tester", coffee: "macchiato", reason: "精緻有個性不從眾" }],
      revealed: true,
    };
    render(<CoffeeType {...defaultProps} />);
    expect(screen.getByTestId("cof-card-u1-def")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<CoffeeType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("cof-reveal-btn")).not.toBeInTheDocument();
  });
});
