import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiWall, EmojiWallConfig, EmojiWallState } from "../EmojiWall";

const baseConfig: EmojiWallConfig = {
  title: "表情牆測試",
  prompt: "選擇你的表情",
  emojis: ["😊", "😎", "🤔"],
  reasonLabel: "說明原因",
  askReason: true,
};

const emptyState: EmojiWallState = { entries: [], revealed: false };

function makeEntry(id: string, userId: string, emoji: string, reason = "") {
  return { entryId: id, userId, userName: `U${id}`, emoji, reason };
}

describe("EmojiWall", () => {
  it("顯示標題和提示", () => {
    render(
      <EmojiWall
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-title")).toHaveTextContent("表情牆測試");
    expect(screen.getByTestId("ew-prompt")).toHaveTextContent("選擇你的表情");
  });

  it("未投票時顯示表情格", () => {
    render(
      <EmojiWall
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-emoji-grid")).toBeInTheDocument();
    expect(screen.getByTestId("ew-emoji-😊")).toBeInTheDocument();
  });

  it("無人回應時顯示 ew-empty", () => {
    render(
      <EmojiWall
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-empty")).toBeInTheDocument();
  });

  it("選擇表情後按提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <EmojiWall
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("ew-emoji-😎"));
    fireEvent.click(screen.getByTestId("ew-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("😎", "");
  });

  it("已提交時顯示 ew-my-entry", () => {
    const stateWithEntry: EmojiWallState = {
      entries: [makeEntry("e1", "u1", "😊", "開心")],
      revealed: false,
    };
    render(
      <EmojiWall
        config={baseConfig}
        state={stateWithEntry}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-my-entry")).toBeInTheDocument();
    expect(screen.queryByTestId("ew-emoji-grid")).not.toBeInTheDocument();
  });

  it("isTeamLead 且有回應時顯示揭曉按鈕", () => {
    const stateWithEntry: EmojiWallState = {
      entries: [makeEntry("e1", "u2", "🤔")],
      revealed: false,
    };
    render(
      <EmojiWall
        config={baseConfig}
        state={stateWithEntry}
        userId="u1"
        isTeamLead
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示 ew-result 和分組", () => {
    const state: EmojiWallState = {
      entries: [
        makeEntry("e1", "u1", "😊"),
        makeEntry("e2", "u2", "😊"),
        makeEntry("e3", "u3", "🤔"),
      ],
      revealed: true,
    };
    render(
      <EmojiWall
        config={baseConfig}
        state={state}
        userId="u4"
        isTeamLead
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-result")).toBeInTheDocument();
    expect(screen.getByTestId("ew-group-😊")).toBeInTheDocument();
    expect(screen.getByTestId("ew-group-🤔")).toBeInTheDocument();
  });

  it("揭曉後無資料顯示 ew-empty", () => {
    const state: EmojiWallState = { entries: [], revealed: true };
    render(
      <EmojiWall
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-empty")).toBeInTheDocument();
  });

  it("ew-count 顯示正確人數", () => {
    const state: EmojiWallState = {
      entries: [makeEntry("e1", "u1", "😊"), makeEntry("e2", "u2", "😎")],
      revealed: false,
    };
    render(
      <EmojiWall
        config={baseConfig}
        state={state}
        userId="u3"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-count")).toHaveTextContent("2 人已回應");
  });

  it("揭曉後顯示個別 entry", () => {
    const state: EmojiWallState = {
      entries: [makeEntry("abc123", "u1", "😊", "很開心")],
      revealed: true,
    };
    render(
      <EmojiWall
        config={baseConfig}
        state={state}
        userId="u2"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("ew-entry-abc123")).toBeInTheDocument();
  });

  it("askReason=false 時不顯示原因輸入框", () => {
    const configNoReason: EmojiWallConfig = { ...baseConfig, askReason: false };
    render(
      <EmojiWall
        config={configNoReason}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("ew-emoji-😊"));
    expect(screen.queryByTestId("ew-reason-input")).not.toBeInTheDocument();
  });
});
