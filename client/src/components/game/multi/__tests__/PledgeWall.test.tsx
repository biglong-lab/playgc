import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PledgeWall from "../PledgeWall";
import type { PledgeWallConfig, PledgeWallState, PledgeCard } from "../PledgeWall";

const defaultConfig: PledgeWallConfig = {
  title: "🤝 環保承諾牆",
  prompt: "許下你對環境的承諾",
  placeholder: "我承諾…",
  maxLength: 80,
  showSupport: true,
  emojiOptions: ["🌱", "♻️", "🤝"],
};

const emptyState: PledgeWallState = { pledges: [] };

const pledge1: PledgeCard = {
  userId: "u1",
  userName: "Alice",
  pledge: "每週少用一次一次性餐具",
  emoji: "🌱",
  supportCount: 2,
  supporters: ["u2", "u3"],
  addedAt: 1000,
};

const pledge2: PledgeCard = {
  userId: "u2",
  userName: "Bob",
  pledge: "每月種一棵樹",
  emoji: "♻️",
  supportCount: 0,
  supporters: [],
  addedAt: 2000,
};

describe("PledgeWall", () => {
  it("顯示標題", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-title")).toHaveTextContent("環保承諾牆");
  });

  it("顯示提示語", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-prompt")).toHaveTextContent("許下你對環境的承諾");
  });

  it("未提交時顯示表單", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-form")).toBeInTheDocument();
  });

  it("空白時提交按鈕 disabled", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-pledge-btn")).toBeDisabled();
  });

  it("有文字和 emoji 時提交按鈕啟用", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="我承諾少吃肉" draftEmoji="🌱" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("submit-pledge-btn")).not.toBeDisabled();
  });

  it("文字輸入呼叫 onTextChange", () => {
    const onTextChange = vi.fn();
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={onTextChange} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("pledge-text-input"), { target: { value: "我承諾" } });
    expect(onTextChange).toHaveBeenCalledWith("我承諾");
  });

  it("點擊 emoji 呼叫 onEmojiChange", () => {
    const onEmojiChange = vi.fn();
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={onEmojiChange} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("pledge-emoji-🌱"));
    expect(onEmojiChange).toHaveBeenCalledWith("🌱");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="我承諾" draftEmoji="🌱" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={onSubmit} onSupport={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("submit-pledge-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("已提交後顯示自己的承諾卡", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("my-pledge-card")).toBeInTheDocument();
  });

  it("已提交後隱藏表單", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.queryByTestId("pledge-form")).not.toBeInTheDocument();
  });

  it("顯示承諾牆中的卡片", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1, pledge2] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-u1")).toBeInTheDocument();
    expect(screen.getByTestId("pledge-u2")).toBeInTheDocument();
  });

  it("顯示承諾文字與作者", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-text-display-u1")).toHaveTextContent("每週少用一次一次性餐具");
    expect(screen.getByTestId("pledge-author-u1")).toHaveTextContent("Alice");
  });

  it("非自己的承諾顯示支持按鈕", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("support-btn-u1")).toBeInTheDocument();
  });

  it("點擊支持按鈕呼叫 onSupport", () => {
    const onSupport = vi.fn();
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={onSupport} />,
    );
    fireEvent.click(screen.getByTestId("support-btn-u1"));
    expect(onSupport).toHaveBeenCalledWith("u1");
  });

  it("顯示支持數", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("support-count-u1")).toHaveTextContent("2");
  });

  it("無承諾時顯示空狀態", () => {
    render(
      <PledgeWall config={defaultConfig} state={emptyState} myUserId="u1" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("empty-pledges")).toBeInTheDocument();
  });

  it("顯示承諾總數", () => {
    render(
      <PledgeWall config={defaultConfig} state={{ pledges: [pledge1, pledge2] }} myUserId="u3" draftText="" draftEmoji="" onTextChange={vi.fn()} onEmojiChange={vi.fn()} onSubmit={vi.fn()} onSupport={vi.fn()} />,
    );
    expect(screen.getByTestId("pledge-count")).toHaveTextContent("2");
  });
});
