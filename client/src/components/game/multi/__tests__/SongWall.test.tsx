import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SongWall, { SongWallConfig, SongWallState, SongEntry } from "../SongWall";

const baseConfig: SongWallConfig = {
  title: "歌曲牆測試",
  prompt: "選一首代表心情的歌",
  maxLength: 50,
  songPlaceholder: "歌曲名稱",
  artistPlaceholder: "歌手",
};

const emptyState: SongWallState = { entries: [], revealed: false };

const entries: SongEntry[] = [
  { entryId: "e1", userId: "u1", userName: "Alice", songTitle: "Bohemian Rhapsody", artist: "Queen", note: "經典！" },
  { entryId: "e2", userId: "u2", userName: "Bob", songTitle: "Shape of You", artist: "Ed Sheeran", note: "" },
];

const revealedState: SongWallState = { entries, revealed: true };

function renderSw(overrides: Partial<Parameters<typeof SongWall>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<SongWall {...props} />), props };
}

describe("SongWall — 基本渲染", () => {
  it("顯示標題", () => {
    renderSw();
    expect(screen.getByTestId("sw-title")).toHaveTextContent("歌曲牆測試");
  });

  it("顯示 prompt", () => {
    renderSw();
    expect(screen.getByTestId("sw-prompt")).toHaveTextContent("選一首代表心情的歌");
  });

  it("顯示歌名輸入框", () => {
    renderSw();
    expect(screen.getByTestId("sw-song-input")).toBeInTheDocument();
  });

  it("顯示歌手輸入框", () => {
    renderSw();
    expect(screen.getByTestId("sw-artist-input")).toBeInTheDocument();
  });

  it("顯示備注輸入框", () => {
    renderSw();
    expect(screen.getByTestId("sw-note-input")).toBeInTheDocument();
  });

  it("未填歌名時送出鈕 disabled", () => {
    renderSw();
    expect(screen.getByTestId("sw-submit-btn")).toBeDisabled();
  });

  it("顯示已分享人數 0", () => {
    renderSw();
    expect(screen.getByTestId("sw-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderSw();
    expect(screen.getByTestId("sw-reveal-btn")).toBeInTheDocument();
  });
});

describe("SongWall — 互動", () => {
  it("填歌名後送出鈕可點", () => {
    renderSw();
    fireEvent.change(screen.getByTestId("sw-song-input"), { target: { value: "My Way" } });
    expect(screen.getByTestId("sw-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶歌名/歌手/備注", () => {
    const onSubmit = vi.fn();
    renderSw({ onSubmit });
    fireEvent.change(screen.getByTestId("sw-song-input"), { target: { value: "Imagine" } });
    fireEvent.change(screen.getByTestId("sw-artist-input"), { target: { value: "John Lennon" } });
    fireEvent.change(screen.getByTestId("sw-note-input"), { target: { value: "peace!" } });
    fireEvent.click(screen.getByTestId("sw-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("Imagine", "John Lennon", "peace!");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderSw({ onReveal });
    fireEvent.click(screen.getByTestId("sw-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已分享者顯示 sw-my-entry", () => {
    const myEntry: SongEntry = { entryId: "e99", userId: "u4", userName: "David", songTitle: "Hotel California", artist: "Eagles", note: "" };
    renderSw({ state: { ...emptyState, entries: [myEntry] } });
    expect(screen.getByTestId("sw-my-entry")).toBeInTheDocument();
  });

  it("已分享者不顯示輸入框", () => {
    const myEntry: SongEntry = { entryId: "e99", userId: "u4", userName: "David", songTitle: "Hotel California", artist: "Eagles", note: "" };
    renderSw({ state: { ...emptyState, entries: [myEntry] } });
    expect(screen.queryByTestId("sw-song-input")).not.toBeInTheDocument();
  });

  it("顯示已分享人數 2", () => {
    renderSw({ state: { ...emptyState, entries } });
    expect(screen.getByTestId("sw-count")).toHaveTextContent("2");
  });
});

describe("SongWall — 公布結果", () => {
  it("公布後顯示 sw-result", () => {
    renderSw({ state: revealedState });
    expect(screen.getByTestId("sw-result")).toBeInTheDocument();
  });

  it("顯示所有歌曲卡片", () => {
    renderSw({ state: revealedState });
    expect(screen.getByTestId("sw-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("sw-entry-e2")).toBeInTheDocument();
  });

  it("卡片顯示歌名和用戶名", () => {
    renderSw({ state: revealedState });
    expect(screen.getByTestId("sw-entry-e1")).toHaveTextContent("Bohemian Rhapsody");
    expect(screen.getByTestId("sw-entry-e1")).toHaveTextContent("Alice");
  });

  it("無人分享顯示 sw-empty", () => {
    renderSw({ state: { entries: [], revealed: true } });
    expect(screen.getByTestId("sw-empty")).toBeInTheDocument();
  });
});
