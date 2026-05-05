import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CollectivePoem, {
  type CollectivePoemConfig,
  type CollectivePoemState,
} from "../CollectivePoem";

const config: CollectivePoemConfig = {
  title: "集體詩",
  prompt: "每人加入一行",
  starter: "在那地方，",
  maxLength: 50,
  showAuthor: true,
  maxLinesPerUser: 1,
};

const emptyState: CollectivePoemState = { lines: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftLine: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderCP(overrides = {}) {
  return render(<CollectivePoem {...baseProps} {...overrides} />);
}

describe("CollectivePoem — 基本渲染", () => {
  it("顯示標題", () => {
    renderCP();
    expect(screen.getByTestId("cp-title")).toHaveTextContent("集體詩");
  });

  it("顯示提示文字", () => {
    renderCP();
    expect(screen.getByTestId("cp-prompt")).toBeInTheDocument();
  });

  it("顯示開篇句", () => {
    renderCP();
    expect(screen.getByTestId("cp-starter")).toHaveTextContent("在那地方，");
  });

  it("顯示輸入框", () => {
    renderCP();
    expect(screen.getByTestId("cp-input")).toBeInTheDocument();
  });

  it("顯示已加入行數 0", () => {
    renderCP();
    expect(screen.getByTestId("cp-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderCP();
    expect(screen.getByTestId("cp-reveal-btn")).toBeInTheDocument();
  });
});

describe("CollectivePoem — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderCP({ draftLine: "" });
    expect(screen.getByTestId("cp-submit-btn")).toBeDisabled();
  });

  it("有內容時可以送出", () => {
    renderCP({ draftLine: "青山綠水間" });
    expect(screen.getByTestId("cp-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderCP({ draftLine: "青山綠水間", onSubmit });
    fireEvent.click(screen.getByTestId("cp-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderCP({ onDraftChange });
    fireEvent.change(screen.getByTestId("cp-input"), { target: { value: "白雲悠悠" } });
    expect(onDraftChange).toHaveBeenCalledWith("白雲悠悠");
  });
});

describe("CollectivePoem — 已達上限", () => {
  const stateWithMyLine: CollectivePoemState = {
    lines: [
      { lineId: "l1", userId: "u1", userName: "Alice", text: "青山綠水間" },
    ],
    revealed: false,
  };

  it("已達上限顯示提示訊息", () => {
    renderCP({ state: stateWithMyLine });
    expect(screen.getByTestId("cp-limit-msg")).toBeInTheDocument();
  });

  it("已達上限隱藏輸入框", () => {
    renderCP({ state: stateWithMyLine });
    expect(screen.queryByTestId("cp-input")).not.toBeInTheDocument();
  });
});

describe("CollectivePoem — 預覽（未揭曉）", () => {
  const stateWith1: CollectivePoemState = {
    lines: [
      { lineId: "l1", userId: "u2", userName: "Bob", text: "日落西山紅" },
    ],
    revealed: false,
  };

  it("未揭曉時顯示已有詩句預覽", () => {
    renderCP({ state: stateWith1 });
    expect(screen.getByTestId("cp-preview")).toBeInTheDocument();
  });

  it("預覽顯示詩行", () => {
    renderCP({ state: stateWith1 });
    expect(screen.getByTestId("cp-preview-line-l1")).toHaveTextContent("日落西山紅");
  });
});

describe("CollectivePoem — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderCP({ onReveal });
    fireEvent.click(screen.getByTestId("cp-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: CollectivePoemState = { lines: [], revealed: true };

  it("揭曉空白顯示 cp-empty", () => {
    renderCP({ state: revealedEmpty });
    expect(screen.getByTestId("cp-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderCP({ state: revealedEmpty });
    expect(screen.queryByTestId("cp-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWith2: CollectivePoemState = {
    lines: [
      { lineId: "l1", userId: "u1", userName: "Alice", text: "青山綠水間" },
      { lineId: "l2", userId: "u2", userName: "Bob", text: "白雲悠悠來" },
    ],
    revealed: true,
  };

  it("顯示 cp-result 容器", () => {
    renderCP({ state: revealedWith2 });
    expect(screen.getByTestId("cp-result")).toBeInTheDocument();
  });

  it("顯示第一行詩句", () => {
    renderCP({ state: revealedWith2 });
    expect(screen.getByTestId("cp-line-l1")).toHaveTextContent("青山綠水間");
  });

  it("顯示第二行詩句", () => {
    renderCP({ state: revealedWith2 });
    expect(screen.getByTestId("cp-line-l2")).toHaveTextContent("白雲悠悠來");
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderCP({ state: revealedWith2 });
    expect(screen.getByTestId("cp-author-l1")).toHaveTextContent("Alice");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderCP({
      state: revealedWith2,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("cp-author-l1")).not.toBeInTheDocument();
  });

  it("揭曉後顯示開篇句", () => {
    renderCP({ state: revealedWith2 });
    expect(screen.getByTestId("cp-result")).toHaveTextContent("在那地方，");
  });

  it("不顯示開篇句（無 starter）", () => {
    renderCP({
      state: revealedWith2,
      config: { ...config, starter: undefined },
    });
    expect(screen.queryByTestId("cp-starter")).not.toBeInTheDocument();
  });
});
