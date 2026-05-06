import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MushroomType } from "../MushroomType";

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

describe("MushroomType", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-title")).toHaveTextContent("我是哪種菇類");
  });

  it("顯示自訂標題", () => {
    render(<MushroomType {...defaultProps} config={{ title: "菇菇個性測驗" }} />);
    expect(screen.getByTestId("msh-title")).toHaveTextContent("菇菇個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<MushroomType {...defaultProps} config={{ prompt: "你是什麼菇？" }} />);
    expect(screen.getByTestId("msh-prompt")).toHaveTextContent("你是什麼菇？");
  });

  it("顯示已選人數", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-form")).toBeInTheDocument();
  });

  it("顯示所有菇類選項", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-mushroom-shiitake")).toBeInTheDocument();
    expect(screen.getByTestId("msh-mushroom-truffle")).toBeInTheDocument();
    expect(screen.getByTestId("msh-mushroom-enoki")).toBeInTheDocument();
    expect(screen.getByTestId("msh-mushroom-button")).toBeInTheDocument();
  });

  it("未選菇類時提交按鈕 disabled", () => {
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-submit-btn")).toBeDisabled();
  });

  it("選菇類但理由不足 5 字時提交按鈕 disabled", () => {
    render(<MushroomType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msh-mushroom-shiitake"));
    fireEvent.change(screen.getByTestId("msh-reason-input"), { target: { value: "香氣" } });
    expect(screen.getByTestId("msh-submit-btn")).toBeDisabled();
  });

  it("選菇類且理由足夠時可提交", () => {
    render(<MushroomType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msh-mushroom-truffle"));
    fireEvent.change(screen.getByTestId("msh-reason-input"), { target: { value: "稀有奢華難以尋覓" } });
    expect(screen.getByTestId("msh-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<MushroomType {...defaultProps} />);
    fireEvent.click(screen.getByTestId("msh-mushroom-enoki"));
    fireEvent.change(screen.getByTestId("msh-reason-input"), { target: { value: "細膩群聚抱團溫暖" } });
    fireEvent.click(screen.getByTestId("msh-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].mushroom).toBe("enoki");
    expect(call.entries[0].reason).toBe("細膩群聚抱團溫暖");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mushroom: "portobello", reason: "大方沉穩有份量感" }],
      revealed: false,
    };
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("msh-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MushroomType {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("msh-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MushroomType {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("msh-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mushroom: "oyster", reason: "柔嫩親和隨遇而安" }],
      revealed: true,
    };
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-result")).toBeInTheDocument();
    expect(screen.getByTestId("msh-mushroom-summary")).toBeInTheDocument();
    expect(screen.getByTestId("msh-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示菇類徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mushroom: "morel", reason: "稀奇獨特充滿故事" }],
      revealed: true,
    };
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-badge-morel")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-pqr", userId: "u1", userName: "Tester", mushroom: "porcini", reason: "厚實濃郁底蘊深厚" }],
      revealed: true,
    };
    render(<MushroomType {...defaultProps} />);
    expect(screen.getByTestId("msh-card-u1-pqr")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MushroomType {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("msh-reveal-btn")).not.toBeInTheDocument();
  });
});
