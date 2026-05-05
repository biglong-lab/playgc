import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GalleryVote, GalleryVoteConfig, GalleryVoteState } from "../GalleryVote";

const baseConfig: GalleryVoteConfig = {
  title: "作品票選測試",
  prompt: "提交並投票",
  galleryLabel: "作品內容",
  placeholder: "輸入作品...",
  maxLength: 100,
};

const emptyState: GalleryVoteState = { submissions: [], votes: [], revealed: false };

function makeSub(id: string, userId: string, content: string) {
  return { subId: id, userId, userName: `U${userId}`, content };
}
function makeVote(id: string, userId: string, targetId: string) {
  return { voteId: id, userId, userName: `U${userId}`, targetId };
}

describe("GalleryVote", () => {
  it("顯示標題和提示", () => {
    render(
      <GalleryVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-title")).toHaveTextContent("作品票選測試");
    expect(screen.getByTestId("gv-prompt")).toHaveTextContent("提交並投票");
  });

  it("未提交時顯示輸入框", () => {
    render(
      <GalleryVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-input")).toBeInTheDocument();
    expect(screen.getByTestId("gv-submit-btn")).toBeInTheDocument();
  });

  it("無作品時顯示 gv-empty", () => {
    render(
      <GalleryVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-empty")).toBeInTheDocument();
  });

  it("輸入內容後點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(
      <GalleryVote
        config={baseConfig}
        state={emptyState}
        userId="u1"
        onSubmit={onSubmit}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("gv-input"), { target: { value: "我的作品" } });
    fireEvent.click(screen.getByTestId("gv-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("我的作品");
  });

  it("已提交顯示 gv-my-sub", () => {
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u1", "我的作品")],
      votes: [],
      revealed: false,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-my-sub")).toBeInTheDocument();
    expect(screen.queryByTestId("gv-input")).not.toBeInTheDocument();
  });

  it("有其他人作品時顯示投票按鈕", () => {
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u1", "我的"), makeSub("s2", "u2", "他的")],
      votes: [],
      revealed: false,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-vote-btn-s2")).toBeInTheDocument();
  });

  it("點擊投票按鈕呼叫 onVote", () => {
    const onVote = vi.fn();
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u1", "我的"), makeSub("s2", "u2", "他的")],
      votes: [],
      revealed: false,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={onVote}
        onReveal={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId("gv-vote-btn-s2"));
    expect(onVote).toHaveBeenCalledWith("s2");
  });

  it("isTeamLead 且有作品時顯示揭曉按鈕", () => {
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u2", "作品")],
      votes: [],
      revealed: false,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u1"
        isTeamLead
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-reveal-btn")).toBeInTheDocument();
  });

  it("揭曉後顯示 gv-result 和各作品", () => {
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u1", "作品A"), makeSub("s2", "u2", "作品B")],
      votes: [makeVote("v1", "u3", "s1"), makeVote("v2", "u4", "s1")],
      revealed: true,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u5"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-result")).toBeInTheDocument();
    expect(screen.getByTestId("gv-result-s1")).toBeInTheDocument();
    expect(screen.getByTestId("gv-result-s2")).toBeInTheDocument();
  });

  it("揭曉後無作品顯示 gv-empty", () => {
    const state: GalleryVoteState = { submissions: [], votes: [], revealed: true };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u1"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-empty")).toBeInTheDocument();
  });

  it("gv-sub-count 和 gv-vote-count 顯示正確", () => {
    const state: GalleryVoteState = {
      submissions: [makeSub("s1", "u1", "A"), makeSub("s2", "u2", "B")],
      votes: [makeVote("v1", "u3", "s1")],
      revealed: false,
    };
    render(
      <GalleryVote
        config={baseConfig}
        state={state}
        userId="u4"
        onSubmit={vi.fn()}
        onVote={vi.fn()}
        onReveal={vi.fn()}
      />,
    );
    expect(screen.getByTestId("gv-sub-count")).toHaveTextContent("2 件作品");
    expect(screen.getByTestId("gv-vote-count")).toHaveTextContent("1 票");
  });
});
