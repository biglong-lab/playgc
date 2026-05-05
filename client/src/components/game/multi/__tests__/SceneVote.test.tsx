import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SceneVote, {
  SceneVoteConfig,
  SceneVoteState,
} from "../SceneVote";

const SCENES = [
  { sceneId: "s1", label: "早鳥型", emoji: "🌅", description: "清晨六點就起床" },
  { sceneId: "s2", label: "夜貓型", emoji: "🦉", description: "凌晨才入睡" },
  { sceneId: "s3", label: "午覺型", emoji: "😴", description: "中午一定要睡" },
];

const BASE_CONFIG: SceneVoteConfig = {
  title: "你是哪種人",
  question: "你的作息偏向？",
  scenes: SCENES,
};

const EMPTY_STATE: SceneVoteState = {
  votes: [],
  revealed: false,
};

const WITH_VOTES: SceneVoteState = {
  votes: [
    { voteId: "v1", userId: "u1", userName: "Alice", sceneId: "s1" },
    { voteId: "v2", userId: "u2", userName: "Bob", sceneId: "s2" },
    { voteId: "v3", userId: "u3", userName: "Carol", sceneId: "s1" },
  ],
  revealed: false,
};

const REVEALED_STATE: SceneVoteState = {
  ...WITH_VOTES,
  revealed: true,
};

function setup(
  state: SceneVoteState = EMPTY_STATE,
  config: SceneVoteConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onVote = vi.fn();
  const onReveal = vi.fn();
  render(
    <SceneVote
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={onVote}
      onReveal={onReveal}
    />
  );
  return { onVote, onReveal };
}

describe("SceneVote — 標題與問題", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("sv-title")).toHaveTextContent("你是哪種人");
  });

  it("顯示問題", () => {
    setup();
    expect(screen.getByTestId("sv-question")).toHaveTextContent("你的作息偏向？");
  });

  it("顯示所有場景", () => {
    setup();
    expect(screen.getByTestId("sv-scene-s1")).toBeInTheDocument();
    expect(screen.getByTestId("sv-scene-s2")).toBeInTheDocument();
    expect(screen.getByTestId("sv-scene-s3")).toBeInTheDocument();
  });

  it("顯示場景 emoji 和標籤", () => {
    setup();
    expect(screen.getByText("🌅")).toBeInTheDocument();
    expect(screen.getByText("早鳥型")).toBeInTheDocument();
  });

  it("空場景顯示空提示", () => {
    const emptyConfig: SceneVoteConfig = { ...BASE_CONFIG, scenes: [] };
    setup(EMPTY_STATE, emptyConfig);
    expect(screen.getByTestId("sv-empty")).toBeInTheDocument();
  });
});

describe("SceneVote — 投票", () => {
  it("點擊場景呼叫 onVote", () => {
    const { onVote } = setup();
    fireEvent.click(screen.getByTestId("sv-scene-s1"));
    expect(onVote).toHaveBeenCalledWith("s1");
  });

  it("顯示投票人數", () => {
    setup(WITH_VOTES);
    expect(screen.getByTestId("sv-total")).toHaveTextContent("3");
  });

  it("已投票後場景按鈕 disabled", () => {
    setup(WITH_VOTES);
    expect(screen.getByTestId("sv-scene-s1")).toBeDisabled();
    expect(screen.getByTestId("sv-scene-s2")).toBeDisabled();
  });

  it("已投票後不重複呼叫 onVote", () => {
    const { onVote } = setup(WITH_VOTES);
    fireEvent.click(screen.getByTestId("sv-scene-s1"));
    expect(onVote).not.toHaveBeenCalled();
  });

  it("我的選擇有（我）標記", () => {
    setup(WITH_VOTES);
    expect(screen.getByTestId("sv-scene-s1")).toHaveTextContent("（我）");
  });
});

describe("SceneVote — 公布按鈕", () => {
  it("未公布時顯示公布結果", () => {
    setup(WITH_VOTES);
    expect(screen.getByTestId("sv-reveal-btn")).toBeInTheDocument();
  });

  it("點擊公布呼叫 onReveal", () => {
    const { onReveal } = setup(WITH_VOTES);
    fireEvent.click(screen.getByTestId("sv-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("公布後不顯示公布按鈕", () => {
    setup(REVEALED_STATE);
    expect(screen.queryByTestId("sv-reveal-btn")).toBeNull();
  });
});

describe("SceneVote — 公布後結果", () => {
  it("顯示各場景票數", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("sv-count-s1")).toHaveTextContent("2");
    expect(screen.getByTestId("sv-count-s2")).toHaveTextContent("1");
    expect(screen.getByTestId("sv-count-s3")).toHaveTextContent("0");
  });

  it("顯示冠軍場景", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("sv-winner")).toHaveTextContent("早鳥型");
    expect(screen.getByTestId("sv-winner")).toHaveTextContent("2 票");
  });

  it("顯示長條比例背景", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("sv-bar-s1")).toBeInTheDocument();
  });
});
