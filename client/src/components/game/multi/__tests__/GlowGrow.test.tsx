import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GlowGrow, {
  type GlowGrowConfig,
  type GlowGrowState,
} from "../GlowGrow";

const config: GlowGrowConfig = {
  title: "閃光點成長點",
  prompt: "個人反思",
  glowLabel: "閃光點",
  glowPrompt: "做得好的是…",
  growLabel: "成長點",
  growPrompt: "想改善的是…",
  maxLength: 150,
  showAuthor: true,
};

const emptyState: GlowGrowState = { entries: [], revealed: false };
const emptyDraft = { glow: "", grow: "" };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draft: emptyDraft,
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderGG(overrides = {}) {
  return render(<GlowGrow {...baseProps} {...overrides} />);
}

describe("GlowGrow — 基本渲染", () => {
  it("顯示標題", () => {
    renderGG();
    expect(screen.getByTestId("gg-title")).toHaveTextContent("閃光點成長點");
  });

  it("顯示提示文字", () => {
    renderGG();
    expect(screen.getByTestId("gg-prompt")).toBeInTheDocument();
  });

  it("顯示兩個輸入欄位", () => {
    renderGG();
    expect(screen.getByTestId("gg-input-glow")).toBeInTheDocument();
    expect(screen.getByTestId("gg-input-grow")).toBeInTheDocument();
  });

  it("顯示已送出人數 0", () => {
    renderGG();
    expect(screen.getByTestId("gg-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderGG();
    expect(screen.getByTestId("gg-reveal-btn")).toBeInTheDocument();
  });
});

describe("GlowGrow — 送出邏輯", () => {
  it("兩欄都空時送出按鈕 disabled", () => {
    renderGG({ draft: emptyDraft });
    expect(screen.getByTestId("gg-submit-btn")).toBeDisabled();
  });

  it("只有 glow 有值時仍 disabled", () => {
    renderGG({ draft: { glow: "很好", grow: "" } });
    expect(screen.getByTestId("gg-submit-btn")).toBeDisabled();
  });

  it("兩欄都有值時可送出", () => {
    renderGG({ draft: { glow: "很好", grow: "再好點" } });
    expect(screen.getByTestId("gg-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderGG({ draft: { glow: "很好", grow: "再好點" }, onSubmit });
    fireEvent.click(screen.getByTestId("gg-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("glow 輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderGG({ onDraftChange });
    fireEvent.change(screen.getByTestId("gg-input-glow"), { target: { value: "協作好" } });
    expect(onDraftChange).toHaveBeenCalledWith("glow", "協作好");
  });

  it("grow 輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderGG({ onDraftChange });
    fireEvent.change(screen.getByTestId("gg-input-grow"), { target: { value: "溝通力" } });
    expect(onDraftChange).toHaveBeenCalledWith("grow", "溝通力");
  });
});

describe("GlowGrow — 已送出狀態", () => {
  const stateWithMyEntry: GlowGrowState = {
    entries: [
      { entryId: "e1", userId: "u1", userName: "Alice", glow: "協作很棒", grow: "溝通可更直接" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderGG({ state: stateWithMyEntry });
    expect(screen.getByTestId("gg-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderGG({ state: stateWithMyEntry });
    expect(screen.queryByTestId("gg-input-glow")).not.toBeInTheDocument();
  });
});

describe("GlowGrow — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderGG({ onReveal });
    fireEvent.click(screen.getByTestId("gg-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: GlowGrowState = { entries: [], revealed: true };

  it("揭曉空白顯示 gg-empty", () => {
    renderGG({ state: revealedEmpty });
    expect(screen.getByTestId("gg-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderGG({ state: revealedEmpty });
    expect(screen.queryByTestId("gg-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithEntry: GlowGrowState = {
    entries: [
      { entryId: "e1", userId: "u2", userName: "Bob", glow: "積極參與", grow: "時間管理" },
    ],
    revealed: true,
  };

  it("顯示 gg-result 容器", () => {
    renderGG({ state: revealedWithEntry });
    expect(screen.getByTestId("gg-result")).toBeInTheDocument();
  });

  it("顯示兩個區段", () => {
    renderGG({ state: revealedWithEntry });
    expect(screen.getByTestId("gg-section-glow")).toBeInTheDocument();
    expect(screen.getByTestId("gg-section-grow")).toBeInTheDocument();
  });

  it("顯示 glow 條目", () => {
    renderGG({ state: revealedWithEntry });
    expect(screen.getByTestId("gg-glow-e1")).toHaveTextContent("積極參與");
  });

  it("顯示 grow 條目", () => {
    renderGG({ state: revealedWithEntry });
    expect(screen.getByTestId("gg-grow-e1")).toHaveTextContent("時間管理");
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderGG({ state: revealedWithEntry });
    expect(screen.getByTestId("gg-author-glow-e1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderGG({
      state: revealedWithEntry,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("gg-author-glow-e1")).not.toBeInTheDocument();
  });
});
