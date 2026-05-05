import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChallengeBoard from "../ChallengeBoard";
import type { ChallengeBoardConfig, ChallengeBoardState } from "../ChallengeBoard";

const defaultConfig: ChallengeBoardConfig = {
  title: "⚡ 挑戰公告欄",
  prompt: "發布挑戰，看誰敢接！",
  maxChallengesPerPerson: 2,
  maxChallengeLength: 50,
  rewardEmoji: "⚡",
};

const emptyState: ChallengeBoardState = { challenges: [] };

const c1 = {
  id: "c1",
  creatorId: "u2",
  creatorName: "Bob",
  text: "唱一首歌！",
  acceptors: ["u1"],
  completors: [],
  createdAt: 1000,
};

const c2 = {
  id: "c2",
  creatorId: "u1",
  creatorName: "Alice",
  text: "做 10 個伏地挺身",
  acceptors: [],
  completors: [],
  createdAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onPost: vi.fn(),
  onAccept: vi.fn(),
  onComplete: vi.fn(),
};

describe("ChallengeBoard", () => {
  it("顯示標題", () => {
    render(<ChallengeBoard {...mockProps} />);
    expect(screen.getByTestId("cb-title")).toHaveTextContent("挑戰公告欄");
  });

  it("顯示提示語", () => {
    render(<ChallengeBoard {...mockProps} />);
    expect(screen.getByTestId("cb-prompt")).toHaveTextContent("發布挑戰，看誰敢接！");
  });

  it("顯示發布表單", () => {
    render(<ChallengeBoard {...mockProps} />);
    expect(screen.getByTestId("cb-post-form")).toBeInTheDocument();
  });

  it("空白時發布按鈕 disabled", () => {
    render(<ChallengeBoard {...mockProps} />);
    expect(screen.getByTestId("cb-post-btn")).toBeDisabled();
  });

  it("有文字時發布按鈕啟用", () => {
    render(<ChallengeBoard {...mockProps} draftText="唱歌挑戰！" />);
    expect(screen.getByTestId("cb-post-btn")).not.toBeDisabled();
  });

  it("輸入文字呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<ChallengeBoard {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("cb-draft-input"), { target: { value: "新挑戰" } });
    expect(onDraftChange).toHaveBeenCalledWith("新挑戰");
  });

  it("點擊發布呼叫 onPost", () => {
    const onPost = vi.fn();
    render(<ChallengeBoard {...mockProps} draftText="新挑戰" onPost={onPost} />);
    fireEvent.click(screen.getByTestId("cb-post-btn"));
    expect(onPost).toHaveBeenCalled();
  });

  it("無挑戰時顯示空狀態", () => {
    render(<ChallengeBoard {...mockProps} />);
    expect(screen.getByTestId("cb-empty")).toBeInTheDocument();
  });

  it("有挑戰時顯示列表", () => {
    const state: ChallengeBoardState = { challenges: [c1, c2] };
    render(<ChallengeBoard {...mockProps} state={state} />);
    expect(screen.getByTestId("cb-challenge-c1")).toBeInTheDocument();
    expect(screen.getByTestId("cb-challenge-c2")).toBeInTheDocument();
  });

  it("顯示挑戰文字", () => {
    const state: ChallengeBoardState = { challenges: [c1] };
    render(<ChallengeBoard {...mockProps} state={state} />);
    expect(screen.getByTestId("cb-text-c1")).toHaveTextContent("唱一首歌！");
  });

  it("顯示接受人數", () => {
    const state: ChallengeBoardState = { challenges: [c1] };
    render(<ChallengeBoard {...mockProps} state={state} />);
    expect(screen.getByTestId("cb-acceptor-count-c1")).toHaveTextContent("1");
  });

  it("別人發布的挑戰顯示接受按鈕", () => {
    const state: ChallengeBoardState = { challenges: [{ ...c1, acceptors: [] }] };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("cb-accept-btn-c1")).toBeInTheDocument();
  });

  it("點擊接受呼叫 onAccept", () => {
    const onAccept = vi.fn();
    const state: ChallengeBoardState = { challenges: [{ ...c1, acceptors: [] }] };
    render(<ChallengeBoard {...mockProps} state={state} onAccept={onAccept} />);
    fireEvent.click(screen.getByTestId("cb-accept-btn-c1"));
    expect(onAccept).toHaveBeenCalledWith("c1");
  });

  it("已接受後顯示完成按鈕", () => {
    const state: ChallengeBoardState = { challenges: [c1] };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("cb-complete-btn-c1")).toBeInTheDocument();
  });

  it("點擊完成呼叫 onComplete", () => {
    const onComplete = vi.fn();
    const state: ChallengeBoardState = { challenges: [c1] };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} onComplete={onComplete} />);
    fireEvent.click(screen.getByTestId("cb-complete-btn-c1"));
    expect(onComplete).toHaveBeenCalledWith("c1");
  });

  it("已完成後顯示已完成標記", () => {
    const state: ChallengeBoardState = {
      challenges: [{ ...c1, acceptors: ["u1"], completors: ["u1"] }],
    };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("cb-done-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("cb-complete-btn-c1")).not.toBeInTheDocument();
  });

  it("自己發布的挑戰不顯示接受按鈕", () => {
    const state: ChallengeBoardState = { challenges: [c2] };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} />);
    expect(screen.queryByTestId("cb-accept-btn-c2")).not.toBeInTheDocument();
  });

  it("達到上限後顯示已達上限並隱藏表單", () => {
    const myC1 = { ...c2, id: "mc1" };
    const myC2 = { ...c2, id: "mc2" };
    const state: ChallengeBoardState = { challenges: [myC1, myC2] };
    render(<ChallengeBoard {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("cb-max-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("cb-post-form")).not.toBeInTheDocument();
  });
});
