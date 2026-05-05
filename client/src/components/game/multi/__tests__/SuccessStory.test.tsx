import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SuccessStory, SuccessStoryConfig, SuccessStoryState } from "../SuccessStory";

const defaultConfig: SuccessStoryConfig = {
  title: "成功故事分享",
  prompt: "分享一個讓你感到驕傲的成就",
  achievementLabel: "成就是什麼",
  detailLabel: "細節描述",
  maxLength: 150,
};

const emptyState: SuccessStoryState = { stories: [], revealed: false };

describe("SuccessStory", () => {
  it("renders title and prompt", () => {
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-title")).toHaveTextContent("成功故事分享");
    expect(screen.getByTestId("ss-prompt")).toHaveTextContent("分享一個讓你感到驕傲的成就");
  });

  it("renders achievement and detail inputs", () => {
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-achievement-input")).toBeInTheDocument();
    expect(screen.getByTestId("ss-detail-input")).toBeInTheDocument();
  });

  it("shows empty state message", () => {
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-empty")).toBeInTheDocument();
  });

  it("shows count correctly", () => {
    const state: SuccessStoryState = {
      stories: [
        { storyId: "s1", userId: "u2", userName: "Alice", achievement: "完成了馬拉松", detail: "三個月準備" },
      ],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-count")).toHaveTextContent("1");
  });

  it("shows submit button when user has not submitted", () => {
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-submit-btn")).toBeInTheDocument();
  });

  it("calls onSubmit with achievement and detail", () => {
    const onSubmit = vi.fn();
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("ss-achievement-input"), { target: { value: "登上玉山" } });
    fireEvent.change(screen.getByTestId("ss-detail-input"), { target: { value: "花了三天" } });
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("登上玉山", "花了三天");
  });

  it("does not submit when achievement is empty", () => {
    const onSubmit = vi.fn();
    render(
      <SuccessStory
        config={defaultConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("ss-submit-btn"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows my-story when user has submitted", () => {
    const state: SuccessStoryState = {
      stories: [
        { storyId: "s1", userId: "u1", userName: "Me", achievement: "升職了", detail: "努力兩年" },
      ],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-my-story")).toBeInTheDocument();
  });

  it("shows reveal button for team lead", () => {
    const state: SuccessStoryState = {
      stories: [{ storyId: "s1", userId: "u1", userName: "Me", achievement: "成就", detail: "" }],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
        isTeamLead
      />,
    );
    expect(screen.getByTestId("ss-reveal-btn")).toBeInTheDocument();
  });

  it("calls onReveal when reveal button clicked", () => {
    const onReveal = vi.fn();
    const state: SuccessStoryState = {
      stories: [{ storyId: "s1", userId: "u1", userName: "Me", achievement: "成就", detail: "" }],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={onReveal}
        isTeamLead
      />,
    );
    fireEvent.click(screen.getByTestId("ss-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("shows results when revealed", () => {
    const state: SuccessStoryState = {
      stories: [{ storyId: "s1", userId: "u2", userName: "Alice", achievement: "登山", detail: "很累" }],
      revealed: true,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-result")).toBeInTheDocument();
    expect(screen.getByTestId("ss-story-s1")).toBeInTheDocument();
  });

  it("does not show reveal button when not team lead", () => {
    const state: SuccessStoryState = {
      stories: [{ storyId: "s1", userId: "u1", userName: "Me", achievement: "成就", detail: "" }],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("ss-reveal-btn")).toBeNull();
  });

  it("does not show submit after user has submitted", () => {
    const state: SuccessStoryState = {
      stories: [{ storyId: "s1", userId: "u1", userName: "Me", achievement: "升職", detail: "" }],
      revealed: false,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("ss-submit-btn")).toBeNull();
  });

  it("shows multiple stories when revealed", () => {
    const state: SuccessStoryState = {
      stories: [
        { storyId: "s1", userId: "u2", userName: "Alice", achievement: "升職", detail: "" },
        { storyId: "s2", userId: "u3", userName: "Bob", achievement: "出書", detail: "" },
      ],
      revealed: true,
    };
    render(
      <SuccessStory
        config={defaultConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ss-story-s1")).toBeInTheDocument();
    expect(screen.getByTestId("ss-story-s2")).toBeInTheDocument();
  });
});
