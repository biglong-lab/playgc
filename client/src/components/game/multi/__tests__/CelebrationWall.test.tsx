import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CelebrationWall, { CelebrationWallConfig, CelebrationWallState, Celebration } from "../CelebrationWall";

const baseConfig: CelebrationWallConfig = {
  title: "勝利分享牆",
  prompt: "分享你想慶祝的事！",
  maxLength: 50,
  showAuthor: true,
};

const emptyState: CelebrationWallState = { celebrations: [], revealed: false };

const celebrations: Celebration[] = [
  { celId: "c1", userId: "u1", userName: "Alice", text: "完成了馬拉松！", hearts: [] },
  { celId: "c2", userId: "u2", userName: "Bob", text: "拿到新工作了", hearts: ["u1"] },
];

const revealedState: CelebrationWallState = { celebrations, revealed: true };

function renderCw(overrides: Partial<Parameters<typeof CelebrationWall>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<CelebrationWall {...props} />), props };
}

describe("CelebrationWall — 基本渲染", () => {
  it("顯示標題", () => {
    renderCw();
    expect(screen.getByTestId("cw-title")).toHaveTextContent("勝利分享牆");
  });

  it("顯示提示語", () => {
    renderCw();
    expect(screen.getByTestId("cw-prompt")).toHaveTextContent("分享你想慶祝的事！");
  });

  it("顯示分享數量", () => {
    renderCw();
    expect(screen.getByTestId("cw-count")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderCw();
    expect(screen.getByTestId("cw-input")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderCw();
    expect(screen.getByTestId("cw-reveal-btn")).toBeInTheDocument();
  });
});

describe("CelebrationWall — 輸入驗證", () => {
  it("空白內容時送出鈕 disabled", () => {
    renderCw();
    expect(screen.getByTestId("cw-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderCw();
    fireEvent.change(screen.getByTestId("cw-input"), {
      target: { value: "通過了考試！" },
    });
    expect(screen.getByTestId("cw-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderCw({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("cw-input"), {
      target: { value: "超過五個字的內容啦！" },
    });
    expect(screen.getByTestId("cw-char-error")).toBeInTheDocument();
  });

  it("超過 maxLength 時送出鈕 disabled", () => {
    renderCw({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("cw-input"), {
      target: { value: "超過五個字的內容啦！" },
    });
    expect(screen.getByTestId("cw-submit-btn")).toBeDisabled();
  });

  it("顯示字數計數", () => {
    renderCw();
    fireEvent.change(screen.getByTestId("cw-input"), {
      target: { value: "測試" },
    });
    expect(screen.getByTestId("cw-char-count")).toHaveTextContent("2 / 50");
  });
});

describe("CelebrationWall — 送出", () => {
  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderCw({ onSubmit });
    fireEvent.change(screen.getByTestId("cw-input"), {
      target: { value: "完成了目標！" },
    });
    fireEvent.click(screen.getByTestId("cw-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("完成了目標！");
  });

  it("送出後顯示 cw-submitted-msg", () => {
    renderCw({
      state: {
        celebrations: [celebrations[0]],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("cw-submitted-msg")).toBeInTheDocument();
  });

  it("已送出時隱藏輸入區", () => {
    renderCw({
      state: {
        celebrations: [celebrations[0]],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("cw-submit-btn")).not.toBeInTheDocument();
  });
});

describe("CelebrationWall — 揭曉", () => {
  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderCw({ onReveal });
    fireEvent.click(screen.getByTestId("cw-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示 cw-result", () => {
    renderCw({ state: revealedState });
    expect(screen.getByTestId("cw-result")).toBeInTheDocument();
  });

  it("無分享時顯示 cw-empty", () => {
    renderCw({ state: { celebrations: [], revealed: true } });
    expect(screen.getByTestId("cw-empty")).toBeInTheDocument();
  });

  it("顯示所有慶祝卡片", () => {
    renderCw({ state: revealedState });
    expect(screen.getByTestId("cw-cel-c1")).toBeInTheDocument();
    expect(screen.getByTestId("cw-cel-c2")).toBeInTheDocument();
  });

  it("顯示慶祝內容", () => {
    renderCw({ state: revealedState });
    expect(screen.getByTestId("cw-cel-text-c1")).toHaveTextContent("完成了馬拉松！");
  });

  it("顯示作者（showAuthor=true）", () => {
    renderCw({ state: revealedState });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderCw({ config: { ...baseConfig, showAuthor: false }, state: revealedState });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("revealed=true 沒有揭曉按鈕", () => {
    renderCw({ state: revealedState });
    expect(screen.queryByTestId("cw-reveal-btn")).not.toBeInTheDocument();
  });
});

describe("CelebrationWall — 愛心", () => {
  it("按愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderCw({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("cw-heart-c1"));
    expect(onHeart).toHaveBeenCalledWith("c1");
  });

  it("顯示愛心數量", () => {
    renderCw({ state: revealedState });
    expect(screen.getByTestId("cw-heart-count-c2")).toHaveTextContent("1");
  });

  it("自己已愛心顯示紅心", () => {
    renderCw({ state: revealedState, myUserId: "u1" });
    expect(screen.getByTestId("cw-heart-c2")).toHaveTextContent("❤️");
  });
});
