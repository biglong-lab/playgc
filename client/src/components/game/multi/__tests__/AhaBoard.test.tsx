import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AhaBoard, { AhaBoardConfig, AhaBoardState, AhaMoment } from "../AhaBoard";

const baseConfig: AhaBoardConfig = {
  title: "頓悟牆測試",
  prompt: "你今天最大的啊哈是什麼？",
  maxLength: 100,
};

const emptyState: AhaBoardState = { moments: [], revealed: false };

const moments: AhaMoment[] = [
  { ahaId: "a1", userId: "u1", userName: "Alice", text: "原來溝通比技術重要" },
  { ahaId: "a2", userId: "u2", userName: "Bob", text: "先做再想勝於想太多" },
  { ahaId: "a3", userId: "u3", userName: "Carol", text: "傾聽是最好的說話技巧" },
];

const revealedState: AhaBoardState = { moments, revealed: true };

function renderAb(overrides: Partial<Parameters<typeof AhaBoard>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<AhaBoard {...props} />), props };
}

describe("AhaBoard — 基本渲染", () => {
  it("顯示標題", () => {
    renderAb();
    expect(screen.getByTestId("ab-title")).toHaveTextContent("頓悟牆測試");
  });

  it("顯示 prompt", () => {
    renderAb();
    expect(screen.getByTestId("ab-prompt")).toHaveTextContent("你今天最大的啊哈是什麼？");
  });

  it("顯示輸入框", () => {
    renderAb();
    expect(screen.getByTestId("ab-input")).toBeInTheDocument();
  });

  it("顯示分享人數 0", () => {
    renderAb();
    expect(screen.getByTestId("ab-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderAb();
    expect(screen.getByTestId("ab-reveal-btn")).toBeInTheDocument();
  });
});

describe("AhaBoard — 互動", () => {
  it("空輸入時送出鈕 disabled", () => {
    renderAb();
    expect(screen.getByTestId("ab-submit-btn")).toBeDisabled();
  });

  it("有輸入後送出鈕可點", () => {
    renderAb();
    fireEvent.change(screen.getByTestId("ab-input"), {
      target: { value: "原來如此" },
    });
    expect(screen.getByTestId("ab-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶文字", () => {
    const onSubmit = vi.fn();
    renderAb({ onSubmit });
    fireEvent.change(screen.getByTestId("ab-input"), {
      target: { value: "頓悟了！" },
    });
    fireEvent.click(screen.getByTestId("ab-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("頓悟了！");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderAb({ onReveal });
    fireEvent.click(screen.getByTestId("ab-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 ab-my-moment", () => {
    const myMoment: AhaMoment = {
      ahaId: "a99",
      userId: "u4",
      userName: "David",
      text: "我的頓悟",
    };
    renderAb({
      state: { moments: [myMoment], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("ab-my-moment")).toHaveTextContent("我的頓悟");
  });

  it("已提交者不顯示輸入框", () => {
    const myMoment: AhaMoment = {
      ahaId: "a99",
      userId: "u4",
      userName: "David",
      text: "已分享",
    };
    renderAb({
      state: { moments: [myMoment], revealed: false },
      myUserId: "u4",
    });
    expect(screen.queryByTestId("ab-input")).not.toBeInTheDocument();
  });

  it("已有 3 人分享顯示人數 3", () => {
    renderAb({ state: { moments, revealed: false } });
    expect(screen.getByTestId("ab-count")).toHaveTextContent("3");
  });
});

describe("AhaBoard — 公布結果", () => {
  it("公布後顯示 ab-result", () => {
    renderAb({ state: revealedState });
    expect(screen.getByTestId("ab-result")).toBeInTheDocument();
  });

  it("顯示所有頓悟卡片", () => {
    renderAb({ state: revealedState });
    expect(screen.getByTestId("ab-card-a1")).toBeInTheDocument();
    expect(screen.getByTestId("ab-card-a2")).toBeInTheDocument();
    expect(screen.getByTestId("ab-card-a3")).toBeInTheDocument();
  });

  it("卡片顯示頓悟文字", () => {
    renderAb({ state: revealedState });
    expect(screen.getByTestId("ab-card-a1")).toHaveTextContent("原來溝通比技術重要");
  });

  it("卡片顯示使用者名字", () => {
    renderAb({ state: revealedState });
    expect(screen.getByTestId("ab-card-a1")).toHaveTextContent("Alice");
  });

  it("無人分享顯示 ab-empty", () => {
    renderAb({ state: { moments: [], revealed: true } });
    expect(screen.getByTestId("ab-empty")).toBeInTheDocument();
  });
});
