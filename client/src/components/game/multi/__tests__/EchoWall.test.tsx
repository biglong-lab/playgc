import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EchoWall } from "../EchoWall";

const mockUpdateState = vi.fn();
let mockState: Record<string, unknown> = { entries: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }),
}));

const defaultProps = { gameId: "g1", sessionId: "s1", pageId: "p1" };

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { entries: [], revealed: false };
});

describe("EchoWall", () => {
  it("顯示 loading 狀態", () => {
    vi.doMock("../../shared/hooks/useTeamPagePersistence", () => ({
      useTeamPagePersistence: () => ({ state: mockState, updateState: mockUpdateState, isLoaded: false }),
    }));
  });

  it("顯示預設標題", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-title").textContent).toBe("回音壁");
  });

  it("顯示自訂標題", () => {
    render(<EchoWall {...defaultProps} config={{ title: "迴響之牆" }} />);
    expect(screen.getByTestId("ecw-title").textContent).toBe("迴響之牆");
  });

  it("顯示預設 prompt", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-prompt").textContent).toContain("回音壁");
  });

  it("顯示自訂 prompt", () => {
    render(<EchoWall {...defaultProps} config={{ prompt: "讓聲音迴盪" }} />);
    expect(screen.getByTestId("ecw-prompt").textContent).toBe("讓聲音迴盪");
  });

  it("顯示已回響聲音數", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-count").textContent).toContain("0");
  });

  it("顯示表單（未提交且未揭示）", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-form")).toBeTruthy();
  });

  it("顯示五種回音類型選項", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-type-affirmation")).toBeTruthy();
    expect(screen.getByTestId("ecw-type-memory")).toBeTruthy();
    expect(screen.getByTestId("ecw-type-question")).toBeTruthy();
    expect(screen.getByTestId("ecw-type-hope")).toBeTruthy();
    expect(screen.getByTestId("ecw-type-lesson")).toBeTruthy();
  });

  it("顯示回音輸入框", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-echo-input")).toBeTruthy();
  });

  it("空白時提交按鈕 disabled", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-submit-btn")).toBeDisabled();
  });

  it("少於 5 字時提交按鈕 disabled", () => {
    render(<EchoWall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ecw-echo-input"), { target: { value: "短" } });
    expect(screen.getByTestId("ecw-submit-btn")).toBeDisabled();
  });

  it("5 字以上時提交按鈕啟用", () => {
    render(<EchoWall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ecw-echo-input"), { target: { value: "五個字以上的回音" } });
    expect(screen.getByTestId("ecw-submit-btn")).not.toBeDisabled();
  });

  it("切換回音類型選擇", () => {
    render(<EchoWall {...defaultProps} />);
    fireEvent.click(screen.getByTestId("ecw-type-hope"));
    expect(screen.getByTestId("ecw-type-hope").className).toContain("indigo");
  });

  it("提交呼叫 updateState", () => {
    render(<EchoWall {...defaultProps} />);
    fireEvent.change(screen.getByTestId("ecw-echo-input"), { target: { value: "我相信自己有無限可能" } });
    fireEvent.click(screen.getByTestId("ecw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledOnce();
    const updated = mockUpdateState.mock.calls[0][0] as { entries: unknown[] };
    expect(updated.entries).toHaveLength(1);
  });

  it("已提交後顯示 my-entry", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", echoType: "affirmation", echo: "我是獨一無二的存在" }], revealed: false };
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-my-entry")).toBeTruthy();
  });

  it("已提交後隱藏表單", () => {
    mockState = { entries: [{ entryId: "e1", userId: "u1", userName: "Alice", echoType: "affirmation", echo: "我是獨一無二的存在" }], revealed: false };
    render(<EchoWall {...defaultProps} />);
    expect(screen.queryByTestId("ecw-form")).toBeNull();
  });

  it("isTeamLead 顯示揭示按鈕", () => {
    render(<EchoWall {...defaultProps} isTeamLead />);
    expect(screen.getByTestId("ecw-reveal-btn")).toBeTruthy();
  });

  it("非隊長不顯示揭示按鈕", () => {
    render(<EchoWall {...defaultProps} />);
    expect(screen.queryByTestId("ecw-reveal-btn")).toBeNull();
  });

  it("揭示後無資料顯示空白提示", () => {
    mockState = { entries: [], revealed: true };
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-empty")).toBeTruthy();
  });

  it("揭示後有資料顯示結果卡片", () => {
    mockState = {
      entries: [{ entryId: "e99", userId: "u1", userName: "Alice", echoType: "lesson", echo: "我的回音壁故事" }],
      revealed: true,
    };
    render(<EchoWall {...defaultProps} />);
    expect(screen.getByTestId("ecw-result")).toBeTruthy();
    expect(screen.getByTestId("ecw-card-e99")).toBeTruthy();
  });
});
