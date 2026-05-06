import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { OceanCreature } from "../OceanCreature";

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

describe("OceanCreature", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-title")).toHaveTextContent("我是哪種海洋生物");
  });

  it("顯示自訂標題", () => {
    render(<OceanCreature {...defaultProps} config={{ title: "海洋個性測驗" }} />);
    expect(screen.getByTestId("oc-title")).toHaveTextContent("海洋個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<OceanCreature {...defaultProps} config={{ prompt: "你是什麼海洋生物？" }} />);
    expect(screen.getByTestId("oc-prompt")).toHaveTextContent("你是什麼海洋生物？");
  });

  it("顯示已選人數", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-form")).toBeInTheDocument();
  });

  it("顯示所有海洋生物選項", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-creature-dolphin")).toBeInTheDocument();
    expect(screen.getByTestId("oc-creature-shark")).toBeInTheDocument();
    expect(screen.getByTestId("oc-creature-whale")).toBeInTheDocument();
    expect(screen.getByTestId("oc-creature-turtle")).toBeInTheDocument();
  });

  it("未選生物時提交按鈕 disabled", () => {
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-submit-btn")).toBeDisabled();
  });

  it("選生物但理由不足 5 字時提交按鈕 disabled", () => {
    render(<OceanCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("oc-creature-dolphin"));
    fireEvent.change(screen.getByTestId("oc-reason-input"), { target: { value: "快" } });
    expect(screen.getByTestId("oc-submit-btn")).toBeDisabled();
  });

  it("選生物且理由足夠時可提交", () => {
    render(<OceanCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("oc-creature-whale"));
    fireEvent.change(screen.getByTestId("oc-reason-input"), { target: { value: "寬廣深邃包容萬物" } });
    expect(screen.getByTestId("oc-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<OceanCreature {...defaultProps} />);
    fireEvent.click(screen.getByTestId("oc-creature-octopus"));
    fireEvent.change(screen.getByTestId("oc-reason-input"), { target: { value: "多才多藝靈活應變" } });
    fireEvent.click(screen.getByTestId("oc-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].creature).toBe("octopus");
    expect(call.entries[0].reason).toBe("多才多藝靈活應變");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", creature: "turtle", reason: "穩健長遠耐力十足" }],
      revealed: false,
    };
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("oc-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<OceanCreature {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("oc-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<OceanCreature {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("oc-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", creature: "jellyfish", reason: "透明純粹順勢飄流" }],
      revealed: true,
    };
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-result")).toBeInTheDocument();
    expect(screen.getByTestId("oc-creature-summary")).toBeInTheDocument();
    expect(screen.getByTestId("oc-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示海洋生物徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", creature: "starfish", reason: "再生重生永不放棄" }],
      revealed: true,
    };
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-badge-starfish")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-jkl", userId: "u1", userName: "Tester", creature: "seahorse", reason: "獨特優雅隨波而行" }],
      revealed: true,
    };
    render(<OceanCreature {...defaultProps} />);
    expect(screen.getByTestId("oc-card-u1-jkl")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<OceanCreature {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("oc-reveal-btn")).not.toBeInTheDocument();
  });
});
