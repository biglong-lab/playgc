import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ReactionWall, {
  type ReactionWallConfig,
  type ReactionWallState,
} from "../ReactionWall";

const config: ReactionWallConfig = {
  title: "今天的感覺",
  content: "用 emoji 表達心情！",
  emojis: ["😊", "🤔", "😴"],
  showNames: false,
};

const emptyState: ReactionWallState = { reactions: [] };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  onReact: vi.fn(),
};

function renderRW(overrides = {}) {
  return render(<ReactionWall {...baseProps} {...overrides} />);
}

describe("ReactionWall — 基本渲染", () => {
  it("顯示標題", () => {
    renderRW();
    expect(screen.getByTestId("rw-title")).toHaveTextContent("今天的感覺");
  });

  it("顯示內容", () => {
    renderRW();
    expect(screen.getByTestId("rw-content")).toHaveTextContent("用 emoji 表達心情！");
  });

  it("顯示全部 emoji 按鈕", () => {
    renderRW();
    expect(screen.getByTestId("rw-emoji-btn-0")).toBeInTheDocument();
    expect(screen.getByTestId("rw-emoji-btn-1")).toBeInTheDocument();
    expect(screen.getByTestId("rw-emoji-btn-2")).toBeInTheDocument();
  });

  it("初始回應數為 0", () => {
    renderRW();
    expect(screen.getByTestId("rw-total-count")).toHaveTextContent("0");
  });

  it("初始每個 emoji 計數為 0", () => {
    renderRW();
    expect(screen.getByTestId("rw-count-0")).toHaveTextContent("0");
    expect(screen.getByTestId("rw-count-1")).toHaveTextContent("0");
  });
});

describe("ReactionWall — 點擊反應", () => {
  it("點 emoji 觸發 onReact", () => {
    const onReact = vi.fn();
    renderRW({ onReact });
    fireEvent.click(screen.getByTestId("rw-emoji-btn-0"));
    expect(onReact).toHaveBeenCalledWith("😊");
  });

  it("點第二個 emoji 觸發對應值", () => {
    const onReact = vi.fn();
    renderRW({ onReact });
    fireEvent.click(screen.getByTestId("rw-emoji-btn-1"));
    expect(onReact).toHaveBeenCalledWith("🤔");
  });

  it("有人反應後計數更新", () => {
    const state: ReactionWallState = {
      reactions: [
        { entryId: "r1", userId: "u2", userName: "Bob", emoji: "😊" },
        { entryId: "r2", userId: "u3", userName: "Carol", emoji: "😊" },
      ],
    };
    renderRW({ state });
    expect(screen.getByTestId("rw-count-0")).toHaveTextContent("2");
  });

  it("總計數正確", () => {
    const state: ReactionWallState = {
      reactions: [
        { entryId: "r1", userId: "u2", userName: "Bob", emoji: "😊" },
        { entryId: "r2", userId: "u3", userName: "Carol", emoji: "🤔" },
      ],
    };
    renderRW({ state });
    expect(screen.getByTestId("rw-total-count")).toHaveTextContent("2");
  });
});

describe("ReactionWall — 我的反應", () => {
  it("已反應顯示 rw-my-reaction", () => {
    const state: ReactionWallState = {
      reactions: [{ entryId: "r1", userId: "u1", userName: "Alice", emoji: "😊" }],
    };
    renderRW({ state });
    expect(screen.getByTestId("rw-my-reaction")).toBeInTheDocument();
  });

  it("rw-my-reaction 顯示選擇的 emoji", () => {
    const state: ReactionWallState = {
      reactions: [{ entryId: "r1", userId: "u1", userName: "Alice", emoji: "😴" }],
    };
    renderRW({ state });
    expect(screen.getByTestId("rw-my-reaction")).toHaveTextContent("😴");
  });

  it("未反應不顯示 rw-my-reaction", () => {
    renderRW();
    expect(screen.queryByTestId("rw-my-reaction")).not.toBeInTheDocument();
  });
});

describe("ReactionWall — showNames", () => {
  it("showNames=true 有人反應後顯示名字", () => {
    const cfg: ReactionWallConfig = { ...config, showNames: true };
    const state: ReactionWallState = {
      reactions: [{ entryId: "r1", userId: "u2", userName: "Bob", emoji: "😊" }],
    };
    renderRW({ config: cfg, state });
    expect(screen.getByTestId("rw-names-0")).toHaveTextContent("Bob");
  });

  it("showNames=false 不顯示名字列表", () => {
    const state: ReactionWallState = {
      reactions: [{ entryId: "r1", userId: "u2", userName: "Bob", emoji: "😊" }],
    };
    renderRW({ state });
    expect(screen.queryByTestId("rw-names-0")).not.toBeInTheDocument();
  });

  it("showNames=true 空反應不顯示 emoji 行", () => {
    const cfg: ReactionWallConfig = { ...config, showNames: true };
    renderRW({ config: cfg });
    expect(screen.queryByTestId("rw-names-0")).not.toBeInTheDocument();
  });

  it("showNames=true 不同 emoji 分別顯示", () => {
    const cfg: ReactionWallConfig = { ...config, showNames: true };
    const state: ReactionWallState = {
      reactions: [
        { entryId: "r1", userId: "u2", userName: "Bob", emoji: "😊" },
        { entryId: "r2", userId: "u3", userName: "Carol", emoji: "🤔" },
      ],
    };
    renderRW({ config: cfg, state });
    expect(screen.getByTestId("rw-names-0")).toHaveTextContent("Bob");
    expect(screen.getByTestId("rw-names-1")).toHaveTextContent("Carol");
  });
});
