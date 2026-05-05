import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiBattle from "../EmojiBattle";
import type { EmojiBattleConfig, EmojiBattleState } from "../EmojiBattle";

const defaultConfig: EmojiBattleConfig = {
  title: "🎭 Emoji 表情大戰",
  question: "現在你的心情是？",
  emojis: [
    { emoji: "😄", label: "超開心" },
    { emoji: "😎", label: "很酷" },
    { emoji: "🤔", label: "在想" },
  ],
  allowMultiSelect: false,
  showResults: true,
};

const emptyState: EmojiBattleState = { votes: [] };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onSelect: vi.fn(),
};

describe("EmojiBattle", () => {
  it("顯示標題", () => {
    render(<EmojiBattle {...mockProps} />);
    expect(screen.getByTestId("eb-title")).toHaveTextContent("Emoji 表情大戰");
  });

  it("顯示問題", () => {
    render(<EmojiBattle {...mockProps} />);
    expect(screen.getByTestId("eb-question")).toHaveTextContent("現在你的心情是？");
  });

  it("顯示所有 emoji 按鈕", () => {
    render(<EmojiBattle {...mockProps} />);
    expect(screen.getByTestId("eb-emoji-btn-😄")).toBeInTheDocument();
    expect(screen.getByTestId("eb-emoji-btn-😎")).toBeInTheDocument();
    expect(screen.getByTestId("eb-emoji-btn-🤔")).toBeInTheDocument();
  });

  it("點擊 emoji 呼叫 onSelect", () => {
    const onSelect = vi.fn();
    render(<EmojiBattle {...mockProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("eb-emoji-btn-😄"));
    expect(onSelect).toHaveBeenCalledWith("😄");
  });

  it("未選擇時顯示提示", () => {
    render(<EmojiBattle {...mockProps} />);
    expect(screen.getByTestId("eb-no-selection")).toBeInTheDocument();
  });

  it("已選擇時顯示我的選擇", () => {
    const state: EmojiBattleState = {
      votes: [{ userId: "u1", userName: "Alice", emojis: ["😄"], votedAt: 1000 }],
    };
    render(<EmojiBattle {...mockProps} state={state} />);
    expect(screen.getByTestId("eb-my-selection")).toHaveTextContent("😄");
  });

  it("顯示投票人數", () => {
    const state: EmojiBattleState = {
      votes: [
        { userId: "u1", userName: "Alice", emojis: ["😄"], votedAt: 1000 },
        { userId: "u2", userName: "Bob", emojis: ["😎"], votedAt: 2000 },
      ],
    };
    render(<EmojiBattle {...mockProps} state={state} />);
    expect(screen.getByTestId("eb-voter-count")).toHaveTextContent("2");
  });

  it("showResults=true 顯示計票", () => {
    const state: EmojiBattleState = {
      votes: [
        { userId: "u1", userName: "Alice", emojis: ["😄"], votedAt: 1000 },
        { userId: "u2", userName: "Bob", emojis: ["😄"], votedAt: 2000 },
      ],
    };
    render(<EmojiBattle {...mockProps} state={state} />);
    expect(screen.getByTestId("eb-count-😄")).toHaveTextContent("2");
  });

  it("顯示最多人選的 emoji", () => {
    const state: EmojiBattleState = {
      votes: [
        { userId: "u1", userName: "Alice", emojis: ["😄"], votedAt: 1000 },
        { userId: "u2", userName: "Bob", emojis: ["😄"], votedAt: 2000 },
        { userId: "u3", userName: "Carol", emojis: ["😎"], votedAt: 3000 },
      ],
    };
    render(<EmojiBattle {...mockProps} state={state} />);
    expect(screen.getByTestId("eb-top-result")).toBeInTheDocument();
  });

  it("showResults=false 不顯示計票", () => {
    const config = { ...defaultConfig, showResults: false };
    const state: EmojiBattleState = {
      votes: [{ userId: "u1", userName: "Alice", emojis: ["😄"], votedAt: 1000 }],
    };
    render(<EmojiBattle {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("eb-count-😄")).not.toBeInTheDocument();
  });

  it("allowMultiSelect=true 顯示可多選提示", () => {
    const config = { ...defaultConfig, allowMultiSelect: true };
    const state: EmojiBattleState = {
      votes: [{ userId: "u1", userName: "Alice", emojis: ["😄", "😎"], votedAt: 1000 }],
    };
    render(<EmojiBattle {...mockProps} config={config} state={state} myUserId="u1" />);
    expect(screen.getByTestId("eb-my-selection")).toHaveTextContent("（可多選）");
  });
});
