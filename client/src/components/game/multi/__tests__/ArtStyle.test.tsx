import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArtStyle } from "../ArtStyle";

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

describe("ArtStyle", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-title")).toHaveTextContent("我是哪種藝術風格");
  });

  it("顯示自訂標題", () => {
    render(<ArtStyle {...defaultProps} config={{ title: "藝術個性測驗" }} />);
    expect(screen.getByTestId("art-title")).toHaveTextContent("藝術個性測驗");
  });

  it("顯示預設 prompt", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<ArtStyle {...defaultProps} config={{ prompt: "你是什麼藝術風格？" }} />);
    expect(screen.getByTestId("art-prompt")).toHaveTextContent("你是什麼藝術風格？");
  });

  it("顯示已選人數", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-form")).toBeInTheDocument();
  });

  it("顯示所有藝術風格選項", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-style-impressionism")).toBeInTheDocument();
    expect(screen.getByTestId("art-style-abstract")).toBeInTheDocument();
    expect(screen.getByTestId("art-style-minimalism")).toBeInTheDocument();
    expect(screen.getByTestId("art-style-photography")).toBeInTheDocument();
  });

  it("未選風格時提交按鈕 disabled", () => {
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-submit-btn")).toBeDisabled();
  });

  it("選風格但理由不足 5 字時提交按鈕 disabled", () => {
    render(<ArtStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("art-style-abstract"));
    fireEvent.change(screen.getByTestId("art-reason-input"), { target: { value: "自由" } });
    expect(screen.getByTestId("art-submit-btn")).toBeDisabled();
  });

  it("選風格且理由足夠時可提交", () => {
    render(<ArtStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("art-style-minimalism"));
    fireEvent.change(screen.getByTestId("art-reason-input"), { target: { value: "少即是多簡約精準" } });
    expect(screen.getByTestId("art-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<ArtStyle {...defaultProps} />);
    fireEvent.click(screen.getByTestId("art-style-watercolor"));
    fireEvent.change(screen.getByTestId("art-reason-input"), { target: { value: "細膩流動透明溫柔" } });
    fireEvent.click(screen.getByTestId("art-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].style).toBe("watercolor");
    expect(call.entries[0].reason).toBe("細膩流動透明溫柔");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", style: "surrealism", reason: "夢境與現實交融共存" }],
      revealed: false,
    };
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("art-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<ArtStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("art-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<ArtStyle {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("art-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", style: "street_art", reason: "自由叛逆打破規則" }],
      revealed: true,
    };
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-result")).toBeInTheDocument();
    expect(screen.getByTestId("art-style-summary")).toBeInTheDocument();
    expect(screen.getByTestId("art-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示藝術風格徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", style: "pop_art", reason: "大眾流行勇於表達" }],
      revealed: true,
    };
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-badge-pop_art")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-yz1", userId: "u1", userName: "Tester", style: "realism", reason: "忠實呈現真實世界" }],
      revealed: true,
    };
    render(<ArtStyle {...defaultProps} />);
    expect(screen.getByTestId("art-card-u1-yz1")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<ArtStyle {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("art-reveal-btn")).not.toBeInTheDocument();
  });
});
