import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GroupMood, {
  GroupMoodConfig,
  GroupMoodState,
  MoodRating,
} from "../GroupMood";

const baseConfig: GroupMoodConfig = {
  title: "團隊能量儀表",
  prompt: "現在你的能量如何？",
  minLabel: "很低落",
  maxLabel: "超亢奮",
};

const emptyState: GroupMoodState = { ratings: [], revealed: false };

const ratings: MoodRating[] = [
  { ratingId: "r1", userId: "u1", userName: "Alice", value: 8 },
  { ratingId: "r2", userId: "u2", userName: "Bob", value: 6 },
  { ratingId: "r3", userId: "u3", userName: "Carol", value: 8 },
];

const revealedState: GroupMoodState = { ratings, revealed: true };

function renderGm(overrides: Partial<Parameters<typeof GroupMood>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<GroupMood {...props} />), props };
}

describe("GroupMood — 基本渲染", () => {
  it("顯示標題", () => {
    renderGm();
    expect(screen.getByTestId("gm-title")).toHaveTextContent("團隊能量儀表");
  });

  it("顯示 prompt", () => {
    renderGm();
    expect(screen.getByTestId("gm-prompt")).toHaveTextContent("現在你的能量如何？");
  });

  it("顯示 1-10 按鈕", () => {
    renderGm();
    for (let v = 1; v <= 10; v++) {
      expect(screen.getByTestId(`gm-btn-${v}`)).toBeInTheDocument();
    }
  });

  it("顯示完成人數 0", () => {
    renderGm();
    expect(screen.getByTestId("gm-count")).toHaveTextContent("0");
  });

  it("顯示公布結果按鈕", () => {
    renderGm();
    expect(screen.getByTestId("gm-reveal-btn")).toBeInTheDocument();
  });
});

describe("GroupMood — 互動", () => {
  it("點按鈕 7 呼叫 onSubmit(7)", () => {
    const onSubmit = vi.fn();
    renderGm({ onSubmit });
    fireEvent.click(screen.getByTestId("gm-btn-7"));
    expect(onSubmit).toHaveBeenCalledWith(7);
  });

  it("點按鈕 1 呼叫 onSubmit(1)", () => {
    const onSubmit = vi.fn();
    renderGm({ onSubmit });
    fireEvent.click(screen.getByTestId("gm-btn-1"));
    expect(onSubmit).toHaveBeenCalledWith(1);
  });

  it("點按鈕 10 呼叫 onSubmit(10)", () => {
    const onSubmit = vi.fn();
    renderGm({ onSubmit });
    fireEvent.click(screen.getByTestId("gm-btn-10"));
    expect(onSubmit).toHaveBeenCalledWith(10);
  });

  it("點公布結果呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderGm({ onReveal });
    fireEvent.click(screen.getByTestId("gm-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已回答者顯示 gm-submitted", () => {
    const myRating: MoodRating = {
      ratingId: "r99",
      userId: "u4",
      userName: "David",
      value: 9,
    };
    renderGm({ state: { ratings: [myRating], revealed: false }, myUserId: "u4" });
    expect(screen.getByTestId("gm-submitted")).toHaveTextContent("9");
  });

  it("已回答者不顯示按鈕", () => {
    const myRating: MoodRating = {
      ratingId: "r99",
      userId: "u4",
      userName: "David",
      value: 5,
    };
    renderGm({ state: { ratings: [myRating], revealed: false }, myUserId: "u4" });
    expect(screen.queryByTestId("gm-btn-5")).not.toBeInTheDocument();
  });

  it("已有 3 人回答顯示人數 3", () => {
    renderGm({ state: { ratings, revealed: false } });
    expect(screen.getByTestId("gm-count")).toHaveTextContent("3");
  });
});

describe("GroupMood — 公布結果", () => {
  it("公布後顯示 gm-result", () => {
    renderGm({ state: revealedState });
    expect(screen.getByTestId("gm-result")).toBeInTheDocument();
  });

  it("公布後顯示平均值", () => {
    renderGm({ state: revealedState });
    expect(screen.getByTestId("gm-avg")).toBeInTheDocument();
  });

  it("平均值正確（8+6+8=22/3≈7.3）", () => {
    renderGm({ state: revealedState });
    expect(screen.getByTestId("gm-avg")).toHaveTextContent("7.3");
  });

  it("顯示 1-10 的長條圖", () => {
    renderGm({ state: revealedState });
    for (let v = 1; v <= 10; v++) {
      expect(screen.getByTestId(`gm-bar-${v}`)).toBeInTheDocument();
    }
  });

  it("無人回答顯示 gm-empty", () => {
    renderGm({ state: { ratings: [], revealed: true } });
    expect(screen.getByTestId("gm-empty")).toBeInTheDocument();
  });
});
