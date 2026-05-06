import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MythicalCreature } from "../MythicalCreature";

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

describe("MythicalCreature", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-title")).toHaveTextContent("我是哪種神話生物");
  });

  it("顯示自訂標題", () => {
    render(<MythicalCreature {...defaultProps} config={{ title: "神話個性測驗" }} />);
    expect(screen.getByTestId("mth-title")).toHaveTextContent("神話個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<MythicalCreature {...defaultProps} config={{ prompt: "你是什麼神話生物？" }} />);
    expect(screen.getByTestId("mth-prompt")).toHaveTextContent("你是什麼神話生物？");
  });

  it("顯示已選人數", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-form")).toBeInTheDocument();
  });

  it("顯示所有神話生物選項", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-creature-dragon")).toBeInTheDocument();
    expect(screen.getByTestId("mth-creature-phoenix")).toBeInTheDocument();
    expect(screen.getByTestId("mth-creature-unicorn")).toBeInTheDocument();
    expect(screen.getByTestId("mth-creature-mermaid")).toBeInTheDocument();
  });

  it("未選神話生物時提交按鈕 disabled", () => {
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-submit-btn")).toBeDisabled();
  });

  it("選神話生物但理由不足 5 字時提交按鈕 disabled", () => {
    render(<MythicalCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mth-creature-dragon"));
    fireEvent.change(screen.getByTestId("mth-reason-input"), { target: { value: "威嚴" } });
    expect(screen.getByTestId("mth-submit-btn")).toBeDisabled();
  });

  it("選神話生物且理由足夠時可提交", () => {
    render(<MythicalCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mth-creature-phoenix"));
    fireEvent.change(screen.getByTestId("mth-reason-input"), { target: { value: "浴火重生永不消亡" } });
    expect(screen.getByTestId("mth-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<MythicalCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("mth-creature-unicorn"));
    fireEvent.change(screen.getByTestId("mth-reason-input"), { target: { value: "純真神聖帶來奇蹟" } });
    fireEvent.click(screen.getByTestId("mth-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].mythical).toBe("unicorn");
    expect(call.entries[0].reason).toBe("純真神聖帶來奇蹟");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mythical: "sphinx", reason: "謎題智慧靜觀萬變" }],
      revealed: false,
    };
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("mth-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<MythicalCreature {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("mth-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<MythicalCreature {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("mth-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mythical: "griffin", reason: "勇猛守護雙重力量" }],
      revealed: true,
    };
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-result")).toBeInTheDocument();
    expect(screen.getByTestId("mth-creature-summary")).toBeInTheDocument();
    expect(screen.getByTestId("mth-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示神話生物徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", mythical: "werewolf", reason: "雙面個性本能直覺" }],
      revealed: true,
    };
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-badge-werewolf")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-def", userId: "u1", userName: "Tester", mythical: "kraken", reason: "深邃龐大無法忽視" }],
      revealed: true,
    };
    render(<MythicalCreature {...defaultProps} />);
    expect(screen.getByTestId("mth-card-u1-def")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<MythicalCreature {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("mth-reveal-btn")).not.toBeInTheDocument();
  });
});
