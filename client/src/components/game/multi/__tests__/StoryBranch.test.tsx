import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StoryBranch, {
  StoryBranchConfig,
  StoryBranchState,
} from "../StoryBranch";

const SEGMENTS = [
  {
    segmentId: "seg1",
    text: "你走到一個岔路，左邊是森林，右邊是山路。",
    choices: [
      { choiceId: "c1a", label: "走進森林", nextSegmentId: "seg2" },
      { choiceId: "c1b", label: "走山路", nextSegmentId: "seg3" },
    ],
  },
  {
    segmentId: "seg2",
    text: "森林裡有神秘小屋。",
    choices: [
      { choiceId: "c2a", label: "進入小屋", nextSegmentId: null },
    ],
  },
  {
    segmentId: "seg3",
    text: "山路上有老人。",
    choices: [
      { choiceId: "c3a", label: "向老人求助", nextSegmentId: null },
    ],
  },
];

const BASE_CONFIG: StoryBranchConfig = {
  title: "冒險故事測試",
  segments: SEGMENTS,
};

const NOT_STARTED: StoryBranchState = {
  currentSegmentId: null,
  votes: [],
  history: [],
  phase: "voting",
};

const VOTING_STATE: StoryBranchState = {
  currentSegmentId: "seg1",
  votes: [
    { voteId: "v1", userId: "u1", userName: "Alice", choiceId: "c1a", segmentId: "seg1" },
    { voteId: "v2", userId: "u2", userName: "Bob", choiceId: "c1a", segmentId: "seg1" },
    { voteId: "v3", userId: "u3", userName: "Carol", choiceId: "c1b", segmentId: "seg1" },
  ],
  history: [],
  phase: "voting",
};

const RESULT_STATE: StoryBranchState = {
  ...VOTING_STATE,
  phase: "result",
};

const DONE_STATE: StoryBranchState = {
  currentSegmentId: "seg2",
  votes: [],
  history: ["seg1"],
  phase: "done",
};

function setup(
  state: StoryBranchState = NOT_STARTED,
  config: StoryBranchConfig = BASE_CONFIG,
  myUserId = "u99"
) {
  const onVote = vi.fn();
  const onAdvance = vi.fn();
  const onStart = vi.fn();
  render(
    <StoryBranch
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={onVote}
      onAdvance={onAdvance}
      onStart={onStart}
    />
  );
  return { onVote, onAdvance, onStart };
}

describe("StoryBranch — 標題與基本", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("sb-title")).toHaveTextContent("冒險故事測試");
  });

  it("空段落顯示空提示", () => {
    const emptyConfig: StoryBranchConfig = { ...BASE_CONFIG, segments: [] };
    setup(NOT_STARTED, emptyConfig);
    expect(screen.getByTestId("sb-empty")).toBeInTheDocument();
  });

  it("未開始顯示開始按鈕", () => {
    setup();
    expect(screen.getByTestId("sb-start-btn")).toBeInTheDocument();
  });

  it("點擊開始呼叫 onStart", () => {
    const { onStart } = setup();
    fireEvent.click(screen.getByTestId("sb-start-btn"));
    expect(onStart).toHaveBeenCalledOnce();
  });
});

describe("StoryBranch — 投票階段", () => {
  it("顯示當前段落文字", () => {
    setup(VOTING_STATE);
    expect(screen.getByTestId("sb-segment-text")).toHaveTextContent("岔路");
  });

  it("顯示所有選項", () => {
    setup(VOTING_STATE);
    expect(screen.getByTestId("sb-choice-c1a")).toBeInTheDocument();
    expect(screen.getByTestId("sb-choice-c1b")).toBeInTheDocument();
  });

  it("點擊選項呼叫 onVote", () => {
    const { onVote } = setup(VOTING_STATE);
    fireEvent.click(screen.getByTestId("sb-choice-c1a"));
    expect(onVote).toHaveBeenCalledWith("c1a");
  });

  it("顯示各選項票數", () => {
    setup(VOTING_STATE);
    expect(screen.getByTestId("sb-vote-count-c1a")).toHaveTextContent("2");
    expect(screen.getByTestId("sb-vote-count-c1b")).toHaveTextContent("1");
  });

  it("顯示總投票數", () => {
    setup(VOTING_STATE);
    expect(screen.getByTestId("sb-total-votes")).toHaveTextContent("3");
  });

  it("已投票後選項 disabled", () => {
    setup(VOTING_STATE, BASE_CONFIG, "u1");
    expect(screen.getByTestId("sb-choice-c1a")).toBeDisabled();
  });

  it("顯示揭曉按鈕", () => {
    setup(VOTING_STATE);
    expect(screen.getByTestId("sb-reveal-btn")).toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onAdvance", () => {
    const { onAdvance } = setup(VOTING_STATE);
    fireEvent.click(screen.getByTestId("sb-reveal-btn"));
    expect(onAdvance).toHaveBeenCalledOnce();
  });
});

describe("StoryBranch — 結果階段", () => {
  it("顯示勝出選項", () => {
    setup(RESULT_STATE);
    expect(screen.getByTestId("sb-winner-choice")).toHaveTextContent("走進森林");
  });

  it("顯示繼續按鈕", () => {
    setup(RESULT_STATE);
    expect(screen.getByTestId("sb-next-btn")).toBeInTheDocument();
  });

  it("繼續按鈕文字正確", () => {
    setup(RESULT_STATE);
    expect(screen.getByTestId("sb-next-btn")).toHaveTextContent("繼續故事");
  });

  it("顯示各選項結果列", () => {
    setup(RESULT_STATE);
    expect(screen.getByTestId("sb-result-c1a")).toBeInTheDocument();
    expect(screen.getByTestId("sb-result-c1b")).toBeInTheDocument();
  });
});

describe("StoryBranch — 完結", () => {
  it("顯示故事完結訊息", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("sb-done")).toBeInTheDocument();
  });

  it("顯示 done phase", () => {
    setup(DONE_STATE);
    expect(screen.getByTestId("sb-phase")).toHaveTextContent("故事結束");
  });
});
