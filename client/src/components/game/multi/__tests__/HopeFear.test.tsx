import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import HopeFear, {
  type HopeFearConfig,
  type HopeFearState,
} from "../HopeFear";

const config: HopeFearConfig = {
  title: "期待與擔憂",
  topic: "新專案",
  hopeLabel: "期待",
  hopePrompt: "我希望…",
  fearLabel: "擔憂",
  fearPrompt: "我擔心…",
  maxLength: 150,
  showAuthor: true,
};

const emptyState: HopeFearState = { entries: [], revealed: false };
const emptyDraft = { hope: "", fear: "" };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draft: emptyDraft,
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderHF(overrides = {}) {
  return render(<HopeFear {...baseProps} {...overrides} />);
}

describe("HopeFear — 基本渲染", () => {
  it("顯示標題", () => {
    renderHF();
    expect(screen.getByTestId("hf-title")).toHaveTextContent("期待與擔憂");
  });

  it("顯示主題", () => {
    renderHF();
    expect(screen.getByTestId("hf-topic")).toHaveTextContent("新專案");
  });

  it("顯示兩個輸入欄位", () => {
    renderHF();
    expect(screen.getByTestId("hf-input-hope")).toBeInTheDocument();
    expect(screen.getByTestId("hf-input-fear")).toBeInTheDocument();
  });

  it("顯示已送出人數 0", () => {
    renderHF();
    expect(screen.getByTestId("hf-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderHF();
    expect(screen.getByTestId("hf-reveal-btn")).toBeInTheDocument();
  });
});

describe("HopeFear — 送出邏輯", () => {
  it("兩欄都空時送出按鈕 disabled", () => {
    renderHF({ draft: emptyDraft });
    expect(screen.getByTestId("hf-submit-btn")).toBeDisabled();
  });

  it("只有 hope 有值時仍 disabled", () => {
    renderHF({ draft: { hope: "成功", fear: "" } });
    expect(screen.getByTestId("hf-submit-btn")).toBeDisabled();
  });

  it("兩欄都有值時可送出", () => {
    renderHF({ draft: { hope: "成功", fear: "失敗" } });
    expect(screen.getByTestId("hf-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderHF({ draft: { hope: "成功", fear: "失敗" }, onSubmit });
    fireEvent.click(screen.getByTestId("hf-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("hope 輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderHF({ onDraftChange });
    fireEvent.change(screen.getByTestId("hf-input-hope"), { target: { value: "達成目標" } });
    expect(onDraftChange).toHaveBeenCalledWith("hope", "達成目標");
  });

  it("fear 輸入觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderHF({ onDraftChange });
    fireEvent.change(screen.getByTestId("hf-input-fear"), { target: { value: "時間不夠" } });
    expect(onDraftChange).toHaveBeenCalledWith("fear", "時間不夠");
  });
});

describe("HopeFear — 已送出狀態", () => {
  const stateWithMyEntry: HopeFearState = {
    entries: [
      { entryId: "e1", userId: "u1", userName: "Alice", hope: "達成目標", fear: "時間不夠" },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderHF({ state: stateWithMyEntry });
    expect(screen.getByTestId("hf-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderHF({ state: stateWithMyEntry });
    expect(screen.queryByTestId("hf-input-hope")).not.toBeInTheDocument();
  });
});

describe("HopeFear — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderHF({ onReveal });
    fireEvent.click(screen.getByTestId("hf-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: HopeFearState = { entries: [], revealed: true };

  it("揭曉空白顯示 hf-empty", () => {
    renderHF({ state: revealedEmpty });
    expect(screen.getByTestId("hf-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderHF({ state: revealedEmpty });
    expect(screen.queryByTestId("hf-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithEntry: HopeFearState = {
    entries: [
      { entryId: "e1", userId: "u2", userName: "Bob", hope: "學到新技能", fear: "太難了" },
    ],
    revealed: true,
  };

  it("顯示 hf-result 容器", () => {
    renderHF({ state: revealedWithEntry });
    expect(screen.getByTestId("hf-result")).toBeInTheDocument();
  });

  it("顯示兩個區段", () => {
    renderHF({ state: revealedWithEntry });
    expect(screen.getByTestId("hf-section-hope")).toBeInTheDocument();
    expect(screen.getByTestId("hf-section-fear")).toBeInTheDocument();
  });

  it("顯示 hope 條目", () => {
    renderHF({ state: revealedWithEntry });
    expect(screen.getByTestId("hf-hope-e1")).toHaveTextContent("學到新技能");
  });

  it("顯示 fear 條目", () => {
    renderHF({ state: revealedWithEntry });
    expect(screen.getByTestId("hf-fear-e1")).toHaveTextContent("太難了");
  });

  it("顯示作者（showAuthor=true）", () => {
    renderHF({ state: revealedWithEntry });
    expect(screen.getByTestId("hf-author-hope-e1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderHF({
      state: revealedWithEntry,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("hf-author-hope-e1")).not.toBeInTheDocument();
  });
});
