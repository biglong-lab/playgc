import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BookGenre } from "../BookGenre";

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

describe("BookGenre", () => {
  it("顯示 loading 狀態", () => {
    mockIsLoaded = false;
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-loading")).toBeInTheDocument();
  });

  it("顯示預設標題", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-title")).toHaveTextContent("我是哪種書");
  });

  it("顯示自訂標題", () => {
    render(<BookGenre {...defaultProps} config={{ title: "書本性格測驗" }} />);
    expect(screen.getByTestId("bk-title")).toHaveTextContent("書本性格測驗");
  });

  it("顯示預設 prompt", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-prompt")).toBeInTheDocument();
  });

  it("顯示自訂 prompt", () => {
    render(<BookGenre {...defaultProps} config={{ prompt: "你是什麼書？" }} />);
    expect(screen.getByTestId("bk-prompt")).toHaveTextContent("你是什麼書？");
  });

  it("顯示已選人數", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-count")).toHaveTextContent("已選擇 0 人");
  });

  it("無回答時顯示表單", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-form")).toBeInTheDocument();
  });

  it("顯示所有書籍類型按鈕", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-genre-fantasy")).toBeInTheDocument();
    expect(screen.getByTestId("bk-genre-scifi")).toBeInTheDocument();
    expect(screen.getByTestId("bk-genre-romance")).toBeInTheDocument();
    expect(screen.getByTestId("bk-genre-mystery")).toBeInTheDocument();
  });

  it("未選類型時提交按鈕 disabled", () => {
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-submit-btn")).toBeDisabled();
  });

  it("選類型但理由不足 5 字時提交按鈕 disabled", () => {
    render(<BookGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bk-genre-fantasy"));
    fireEvent.change(screen.getByTestId("bk-reason-input"), { target: { value: "短" } });
    expect(screen.getByTestId("bk-submit-btn")).toBeDisabled();
  });

  it("選類型且理由足夠時可提交", () => {
    render(<BookGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bk-genre-scifi"));
    fireEvent.change(screen.getByTestId("bk-reason-input"), { target: { value: "我喜歡思考未來科技" } });
    expect(screen.getByTestId("bk-submit-btn")).not.toBeDisabled();
  });

  it("提交後呼叫 updateState", () => {
    render(<BookGenre {...defaultProps} />);
    fireEvent.click(screen.getByTestId("bk-genre-mystery"));
    fireEvent.change(screen.getByTestId("bk-reason-input"), { target: { value: "喜歡邏輯推理解謎" } });
    fireEvent.click(screen.getByTestId("bk-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.entries[0].genre).toBe("mystery");
    expect(call.entries[0].reason).toBe("喜歡邏輯推理解謎");
  });

  it("已提交時顯示我的選擇", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", genre: "fantasy", reason: "天馬行空很有趣" }],
      revealed: false,
    };
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("bk-form")).not.toBeInTheDocument();
  });

  it("隊長看到揭曉按鈕", () => {
    render(<BookGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.getByTestId("bk-reveal-btn")).toBeInTheDocument();
  });

  it("非隊長看不到揭曉按鈕", () => {
    render(<BookGenre {...defaultProps} isTeamLead={false} />);
    expect(screen.queryByTestId("bk-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後無條目時顯示空狀態", () => {
    mockState = { entries: [], revealed: true };
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-empty")).toBeInTheDocument();
  });

  it("揭曉後有條目時顯示結果", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", genre: "romance", reason: "愛看感情故事連結" }],
      revealed: true,
    };
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-result")).toBeInTheDocument();
    expect(screen.getByTestId("bk-genre-summary")).toBeInTheDocument();
    expect(screen.getByTestId("bk-card-list")).toBeInTheDocument();
  });

  it("揭曉後顯示書籍類型徽章", () => {
    mockState = {
      entries: [{ entryId: "u1-1", userId: "u1", userName: "Tester", genre: "selfhelp", reason: "積極向上很重要啊" }],
      revealed: true,
    };
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-badge-selfhelp")).toBeInTheDocument();
  });

  it("揭曉後顯示每張卡片", () => {
    mockState = {
      entries: [{ entryId: "u1-abc", userId: "u1", userName: "Tester", genre: "poetry", reason: "文字細膩靈魂深處" }],
      revealed: true,
    };
    render(<BookGenre {...defaultProps} />);
    expect(screen.getByTestId("bk-card-u1-abc")).toBeInTheDocument();
  });

  it("揭曉後隊長不再看到揭曉按鈕", () => {
    mockState = { entries: [], revealed: true };
    render(<BookGenre {...defaultProps} isTeamLead={true} />);
    expect(screen.queryByTestId("bk-reveal-btn")).not.toBeInTheDocument();
  });
});
