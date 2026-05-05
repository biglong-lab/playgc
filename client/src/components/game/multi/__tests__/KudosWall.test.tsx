import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KudosWall, {
  KudosWallConfig,
  KudosWallState,
  KudosCard,
} from "../KudosWall";

const baseConfig: KudosWallConfig = {
  title: "感謝牆測試",
  prompt: "向誰說謝謝？",
  maxLength: 80,
};

const emptyState: KudosWallState = { kudos: [], revealed: false };

const kudos: KudosCard[] = [
  { kudosId: "k1", fromUserId: "u1", fromUserName: "Alice", toName: "Bob", message: "謝謝你的幫助" },
  { kudosId: "k2", fromUserId: "u2", fromUserName: "Carol", toName: "Alice", message: "你的想法很棒" },
];

const revealedState: KudosWallState = { kudos, revealed: true };

function renderKw(overrides: Partial<Parameters<typeof KudosWall>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u3",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<KudosWall {...props} />), props };
}

describe("KudosWall — 基本渲染", () => {
  it("顯示標題", () => {
    renderKw();
    expect(screen.getByTestId("kw-title")).toHaveTextContent("感謝牆測試");
  });

  it("顯示 prompt", () => {
    renderKw();
    expect(screen.getByTestId("kw-prompt")).toHaveTextContent("向誰說謝謝？");
  });

  it("顯示對象輸入框", () => {
    renderKw();
    expect(screen.getByTestId("kw-to-input")).toBeInTheDocument();
  });

  it("顯示留言輸入框", () => {
    renderKw();
    expect(screen.getByTestId("kw-msg-input")).toBeInTheDocument();
  });

  it("顯示感謝卡計數 0", () => {
    renderKw();
    expect(screen.getByTestId("kw-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderKw();
    expect(screen.getByTestId("kw-reveal-btn")).toBeInTheDocument();
  });
});

describe("KudosWall — 互動", () => {
  it("對象空時送出鈕 disabled", () => {
    renderKw();
    fireEvent.change(screen.getByTestId("kw-msg-input"), {
      target: { value: "謝謝" },
    });
    expect(screen.getByTestId("kw-submit-btn")).toBeDisabled();
  });

  it("留言空時送出鈕 disabled", () => {
    renderKw();
    fireEvent.change(screen.getByTestId("kw-to-input"), {
      target: { value: "Bob" },
    });
    expect(screen.getByTestId("kw-submit-btn")).toBeDisabled();
  });

  it("兩者都有輸入後送出鈕可點", () => {
    renderKw();
    fireEvent.change(screen.getByTestId("kw-to-input"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByTestId("kw-msg-input"), {
      target: { value: "謝謝你" },
    });
    expect(screen.getByTestId("kw-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶對象和留言", () => {
    const onSubmit = vi.fn();
    renderKw({ onSubmit });
    fireEvent.change(screen.getByTestId("kw-to-input"), {
      target: { value: "Bob" },
    });
    fireEvent.change(screen.getByTestId("kw-msg-input"), {
      target: { value: "謝謝你的幫助" },
    });
    fireEvent.click(screen.getByTestId("kw-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("Bob", "謝謝你的幫助");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderKw({ onReveal });
    fireEvent.click(screen.getByTestId("kw-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已有 2 張顯示計數 2", () => {
    renderKw({ state: { kudos, revealed: false } });
    expect(screen.getByTestId("kw-count")).toHaveTextContent("2");
  });

  it("已送出顯示已送出計數", () => {
    const myKudos: KudosCard[] = [
      { kudosId: "k99", fromUserId: "u3", fromUserName: "David", toName: "Alice", message: "讚！" },
    ];
    renderKw({ state: { kudos: myKudos, revealed: false }, myUserId: "u3" });
    expect(screen.getByTestId("kw-my-count")).toBeInTheDocument();
  });
});

describe("KudosWall — 公布結果", () => {
  it("公布後顯示 kw-result", () => {
    renderKw({ state: revealedState });
    expect(screen.getByTestId("kw-result")).toBeInTheDocument();
  });

  it("顯示所有感謝卡", () => {
    renderKw({ state: revealedState });
    expect(screen.getByTestId("kw-card-k1")).toBeInTheDocument();
    expect(screen.getByTestId("kw-card-k2")).toBeInTheDocument();
  });

  it("卡片顯示感謝內容", () => {
    renderKw({ state: revealedState });
    expect(screen.getByTestId("kw-card-k1")).toHaveTextContent("謝謝你的幫助");
  });

  it("卡片顯示對象名字", () => {
    renderKw({ state: revealedState });
    expect(screen.getByTestId("kw-card-k1")).toHaveTextContent("Bob");
  });

  it("無感謝卡顯示 kw-empty", () => {
    renderKw({ state: { kudos: [], revealed: true } });
    expect(screen.getByTestId("kw-empty")).toBeInTheDocument();
  });
});
