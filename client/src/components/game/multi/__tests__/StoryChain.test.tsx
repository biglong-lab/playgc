import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StoryChain from "../StoryChain";
import type { StoryChainConfig, StoryChainState, StoryEntry } from "../StoryChain";

const defaultConfig: StoryChainConfig = {
  title: "📖 婚禮接龍",
  opening: "從前從前，有一對相愛的人…",
  maxWordsPerContribution: 20,
  maxContributions: 4,
  finishText: "感謝大家的祝福！",
};

const emptyState: StoryChainState = { entries: [], finished: false };

const makeEntry = (id: string, authorId: string, text: string): StoryEntry => ({
  id,
  authorId,
  authorName: authorId === "u1" ? "Alice" : "Bob",
  text,
  addedAt: Date.now(),
});

const mockAdd = vi.fn(() => Promise.resolve());
const mockFinish = vi.fn(() => Promise.resolve());

describe("StoryChain", () => {
  it("顯示標題", () => {
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("story-title")).toHaveTextContent("婚禮接龍");
  });

  it("顯示開場白", () => {
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("story-content")).toHaveTextContent("從前從前，有一對相愛的人");
  });

  it("顯示進度", () => {
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("story-progress")).toHaveTextContent("0 / 4 人接龍");
  });

  it("顯示輸入欄", () => {
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("story-input")).toBeInTheDocument();
  });

  it("有內容時可以加入", async () => {
    const onAdd = vi.fn(() => Promise.resolve());
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={onAdd} onFinish={mockFinish} />);
    fireEvent.change(screen.getByTestId("story-input"), { target: { value: "他們相遇在一個美麗的秋天" } });
    fireEvent.click(screen.getByTestId("add-story-btn"));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
  });

  it("已接龍後顯示等待訊息", () => {
    const state: StoryChainState = { entries: [makeEntry("e1", "u1", "他們相遇了")], finished: false };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("already-added")).toBeInTheDocument();
  });

  it("顯示已加入的條目", () => {
    const state: StoryChainState = { entries: [makeEntry("e1", "u2", "故事繼續了")], finished: false };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("entry-0")).toHaveTextContent("故事繼續了");
  });

  it("顯示作者 badge", () => {
    const state: StoryChainState = { entries: [makeEntry("e1", "u2", "故事繼續了")], finished: false };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("author-badge-u2")).toBeInTheDocument();
  });

  it("故事滿員時顯示完成按鈕", () => {
    const state: StoryChainState = {
      entries: [
        makeEntry("e1", "u2", "A"),
        makeEntry("e2", "u3", "B"),
        makeEntry("e3", "u4", "C"),
        makeEntry("e4", "u5", "D"),
      ],
      finished: false,
    };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("finish-story-btn")).toBeInTheDocument();
  });

  it("點擊完成呼叫 onFinish", async () => {
    const onFinish = vi.fn(() => Promise.resolve());
    const state: StoryChainState = {
      entries: [
        makeEntry("e1", "u2", "A"),
        makeEntry("e2", "u3", "B"),
        makeEntry("e3", "u4", "C"),
        makeEntry("e4", "u5", "D"),
      ],
      finished: false,
    };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={onFinish} />);
    fireEvent.click(screen.getByTestId("finish-story-btn"));
    await waitFor(() => expect(onFinish).toHaveBeenCalled());
  });

  it("finished 顯示完整故事", () => {
    const state: StoryChainState = {
      entries: [makeEntry("e1", "u2", "他們相遇了")],
      finished: true,
    };
    render(<StoryChain config={defaultConfig} state={state} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    expect(screen.getByTestId("story-finished")).toBeInTheDocument();
    expect(screen.getByTestId("full-story")).toHaveTextContent("他們相遇了");
  });

  it("超字數時送出停用", () => {
    render(<StoryChain config={defaultConfig} state={emptyState} myUserId="u1" onAdd={mockAdd} onFinish={mockFinish} />);
    const longText = Array(25).fill("字").join(" ");
    fireEvent.change(screen.getByTestId("story-input"), { target: { value: longText } });
    expect(screen.getByTestId("add-story-btn")).toBeDisabled();
  });
});
