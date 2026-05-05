import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimelineWall from "../TimelineWall";
import type { TimelineWallConfig, TimelineWallState, TimelineEntry } from "../TimelineWall";

const defaultConfig: TimelineWallConfig = {
  title: "📅 同學會時間軸",
  prompt: "寫下你的回憶",
  placeholder: "描述這年發生的事…",
  maxEntriesPerPerson: 2,
  maxTextLength: 60,
  showAuthor: true,
};

const emptyState: TimelineWallState = { entries: [] };

const entry1: TimelineEntry = {
  id: "e1",
  userId: "u1",
  userName: "Alice",
  yearLabel: "2015",
  text: "高中畢業典禮",
  emoji: "🎓",
  addedAt: 1000,
};

const entry2: TimelineEntry = {
  id: "e2",
  userId: "u2",
  userName: "Bob",
  yearLabel: "2018",
  text: "大學入學",
  emoji: "📚",
  addedAt: 2000,
};

describe("TimelineWall", () => {
  it("顯示標題", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("timeline-title")).toHaveTextContent("同學會時間軸");
  });

  it("顯示提示文字", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("timeline-prompt")).toHaveTextContent("寫下你的回憶");
  });

  it("無回憶時顯示空狀態", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("empty-timeline")).toBeInTheDocument();
  });

  it("顯示加入表單", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("add-entry-form")).toBeInTheDocument();
  });

  it("年份輸入呼叫 onYearChange", () => {
    const onYearChange = vi.fn();
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={onYearChange} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("year-input"), { target: { value: "2020" } });
    expect(onYearChange).toHaveBeenCalledWith("2020");
  });

  it("文字輸入呼叫 onTextChange", () => {
    const onTextChange = vi.fn();
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={onTextChange} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("text-input"), { target: { value: "一段回憶" } });
    expect(onTextChange).toHaveBeenCalledWith("一段回憶");
  });

  it("年份或文字空白時加入按鈕 disabled", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("add-entry-btn")).toBeDisabled();
  });

  it("年份與文字都有時加入按鈕啟用", () => {
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="2020" draftText="好年" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("add-entry-btn")).not.toBeDisabled();
  });

  it("點擊加入呼叫 onAdd", () => {
    const onAdd = vi.fn();
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="2020" draftText="好年" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={onAdd} />,
    );
    fireEvent.click(screen.getByTestId("add-entry-btn"));
    expect(onAdd).toHaveBeenCalled();
  });

  it("顯示已有的時間軸條目", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1, entry2] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("entry-e2")).toBeInTheDocument();
  });

  it("顯示條目年份", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-year-e1")).toHaveTextContent("2015");
  });

  it("顯示條目文字", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-text-e1")).toHaveTextContent("高中畢業典禮");
  });

  it("顯示條目 emoji", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-emoji-e1")).toHaveTextContent("🎓");
  });

  it("showAuthor=true 時顯示作者", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-author-e1")).toHaveTextContent("Alice");
  });

  it("到達上限後隱藏表單顯示 max-reached", () => {
    const maxEntry1 = { ...entry1, userId: "u1" };
    const maxEntry2 = { ...entry2, id: "e2b", userId: "u1" };
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [maxEntry1, maxEntry2] }} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.queryByTestId("add-entry-form")).not.toBeInTheDocument();
    expect(screen.getByTestId("max-reached")).toBeInTheDocument();
  });

  it("點擊 emoji 按鈕呼叫 onEmojiChange", () => {
    const onEmojiChange = vi.fn();
    render(
      <TimelineWall config={defaultConfig} state={emptyState} myUserId="u1" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={onEmojiChange} onAdd={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId("emoji-btn-🎓"));
    expect(onEmojiChange).toHaveBeenCalledWith("🎓");
  });

  it("顯示條目數量", () => {
    render(
      <TimelineWall config={defaultConfig} state={{ entries: [entry1, entry2] }} myUserId="u3" draftYear="" draftText="" draftEmoji="" onYearChange={vi.fn()} onTextChange={vi.fn()} onEmojiChange={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(screen.getByTestId("entry-count")).toHaveTextContent("2");
  });
});
