import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoryWall } from "../StoryWall";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "u1", firstName: "測試員", email: "test@example.com" },
  }),
}));

const mockUpdateState = vi.fn();
let mockState = { stories: [], revealed: false };

vi.mock("../../shared/hooks/useTeamPagePersistence", () => ({
  useTeamPagePersistence: () => ({
    state: mockState,
    updateState: mockUpdateState,
    isLoaded: true,
  }),
}));

const baseProps = {
  gameId: "g1",
  sessionId: "s1",
  pageId: "p1",
  isTeamLead: true,
};

beforeEach(() => {
  mockUpdateState.mockClear();
  mockState = { stories: [], revealed: false };
});

describe("StoryWall", () => {
  it("顯示標題", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-title")).toBeInTheDocument();
  });

  it("顯示提示文字", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-prompt")).toBeInTheDocument();
  });

  it("顯示故事數量", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-count")).toHaveTextContent("0");
  });

  it("顯示標題和內容輸入框", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-title-input")).toBeInTheDocument();
    expect(screen.getByTestId("stw-text-input")).toBeInTheDocument();
  });

  it("空白時 submit 按鈕 disabled", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-submit-btn")).toBeDisabled();
  });

  it("只填標題時仍 disabled", () => {
    render(<StoryWall {...baseProps} />);
    fireEvent.change(screen.getByTestId("stw-title-input"), { target: { value: "我的故事" } });
    expect(screen.getByTestId("stw-submit-btn")).toBeDisabled();
  });

  it("填寫標題和內容後可提交", () => {
    render(<StoryWall {...baseProps} />);
    fireEvent.change(screen.getByTestId("stw-title-input"), { target: { value: "第一次體驗" } });
    fireEvent.change(screen.getByTestId("stw-text-input"), { target: { value: "那是一個很特別的下午..." } });
    expect(screen.getByTestId("stw-submit-btn")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("stw-submit-btn"));
    expect(mockUpdateState).toHaveBeenCalledTimes(1);
    const call = mockUpdateState.mock.calls[0][0];
    expect(call.stories).toHaveLength(1);
    expect(call.stories[0].title).toBe("第一次體驗");
    expect(call.stories[0].text).toBe("那是一個很特別的下午...");
  });

  it("已提交後顯示 my-story", () => {
    mockState = {
      stories: [{ storyId: "u1-1", userId: "u1", userName: "測試員", title: "故事", text: "內容" }],
      revealed: false,
    };
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-my-story")).toBeInTheDocument();
  });

  it("已提交後不再顯示輸入框", () => {
    mockState = {
      stories: [{ storyId: "u1-1", userId: "u1", userName: "測試員", title: "故事", text: "內容" }],
      revealed: false,
    };
    render(<StoryWall {...baseProps} />);
    expect(screen.queryByTestId("stw-submit-btn")).not.toBeInTheDocument();
  });

  it("team lead 顯示揭曉按鈕", () => {
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示所有故事", () => {
    mockState = {
      stories: [{ storyId: "u2-1", userId: "u2", userName: "玩家2", title: "故事", text: "內容" }],
      revealed: true,
    };
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-result")).toBeInTheDocument();
    expect(screen.getByTestId("stw-story-u2-1")).toBeInTheDocument();
  });

  it("揭曉後無故事顯示 empty", () => {
    mockState = { stories: [], revealed: true };
    render(<StoryWall {...baseProps} />);
    expect(screen.getByTestId("stw-empty")).toBeInTheDocument();
  });

  it("非 team lead 不顯示揭曉按鈕", () => {
    render(<StoryWall {...baseProps} isTeamLead={false} />);
    expect(screen.queryByTestId("stw-reveal-btn")).not.toBeInTheDocument();
  });
});
