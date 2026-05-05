import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ValueRank, {
  type ValueRankConfig,
  type ValueRankState,
} from "../ValueRank";

const config: ValueRankConfig = {
  title: "價值排序",
  prompt: "請排列以下項目",
  items: ["A", "B", "C"],
  showAuthor: true,
};

const emptyState: ValueRankState = { rankings: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftOrder: ["A", "B", "C"],
  onOrderChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderVR(overrides = {}) {
  return render(<ValueRank {...baseProps} {...overrides} />);
}

describe("ValueRank — 基本渲染", () => {
  it("顯示標題", () => {
    renderVR();
    expect(screen.getByTestId("vr-title")).toHaveTextContent("價值排序");
  });

  it("顯示提示文字", () => {
    renderVR();
    expect(screen.getByTestId("vr-prompt")).toBeInTheDocument();
  });

  it("顯示三個排序項目", () => {
    renderVR();
    expect(screen.getByTestId("vr-item-0")).toBeInTheDocument();
    expect(screen.getByTestId("vr-item-1")).toBeInTheDocument();
    expect(screen.getByTestId("vr-item-2")).toBeInTheDocument();
  });

  it("第一個項目的 A 出現在 item-0 中", () => {
    renderVR();
    expect(screen.getByTestId("vr-item-0")).toHaveTextContent("A");
  });

  it("顯示已送出人數 0", () => {
    renderVR();
    expect(screen.getByTestId("vr-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderVR();
    expect(screen.getByTestId("vr-reveal-btn")).toBeInTheDocument();
  });
});

describe("ValueRank — 送出邏輯", () => {
  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderVR({ onSubmit });
    fireEvent.click(screen.getByTestId("vr-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("點上移觸發 onOrderChange（index 1 往上）", () => {
    const onOrderChange = vi.fn();
    renderVR({ onOrderChange });
    fireEvent.click(screen.getByTestId("vr-up-1"));
    expect(onOrderChange).toHaveBeenCalledWith(["B", "A", "C"]);
  });

  it("點下移觸發 onOrderChange（index 0 往下）", () => {
    const onOrderChange = vi.fn();
    renderVR({ onOrderChange });
    fireEvent.click(screen.getByTestId("vr-down-0"));
    expect(onOrderChange).toHaveBeenCalledWith(["B", "A", "C"]);
  });

  it("第一個項目的上移 disabled", () => {
    renderVR();
    expect(screen.getByTestId("vr-up-0")).toBeDisabled();
  });

  it("最後一個項目的下移 disabled", () => {
    renderVR();
    expect(screen.getByTestId("vr-down-2")).toBeDisabled();
  });
});

describe("ValueRank — 已送出狀態", () => {
  const stateWithMyEntry: ValueRankState = {
    rankings: [
      { entryId: "e1", userId: "u1", userName: "Alice", order: ["A", "B", "C"] },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderVR({ state: stateWithMyEntry });
    expect(screen.getByTestId("vr-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderVR({ state: stateWithMyEntry });
    expect(screen.queryByTestId("vr-submit-btn")).not.toBeInTheDocument();
  });

  it("已送出顯示我的排序內容", () => {
    renderVR({ state: stateWithMyEntry });
    expect(screen.getByTestId("vr-submitted-msg")).toHaveTextContent("A");
  });
});

describe("ValueRank — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderVR({ onReveal });
    fireEvent.click(screen.getByTestId("vr-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: ValueRankState = { rankings: [], revealed: true };

  it("揭曉空白顯示 vr-empty", () => {
    renderVR({ state: revealedEmpty });
    expect(screen.getByTestId("vr-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderVR({ state: revealedEmpty });
    expect(screen.queryByTestId("vr-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWith2: ValueRankState = {
    rankings: [
      { entryId: "e1", userId: "u1", userName: "Alice", order: ["A", "B", "C"] },
      { entryId: "e2", userId: "u2", userName: "Bob", order: ["A", "C", "B"] },
    ],
    revealed: true,
  };

  it("顯示 vr-result 容器", () => {
    renderVR({ state: revealedWith2 });
    expect(screen.getByTestId("vr-result")).toBeInTheDocument();
  });

  it("顯示三個排名項目", () => {
    renderVR({ state: revealedWith2 });
    expect(screen.getByTestId("vr-result-0")).toBeInTheDocument();
    expect(screen.getByTestId("vr-result-1")).toBeInTheDocument();
    expect(screen.getByTestId("vr-result-2")).toBeInTheDocument();
  });

  it("A 排第一（Borda count: A=4, B=2, C=2 → A 第一）", () => {
    renderVR({ state: revealedWith2 });
    expect(screen.getByTestId("vr-result-0")).toHaveTextContent("A");
  });

  it("顯示 A 的 Borda 分數 4", () => {
    renderVR({ state: revealedWith2 });
    expect(screen.getByTestId("vr-score-0")).toHaveTextContent("4");
  });

  it("顯示個人排序明細（showAuthor=true）", () => {
    renderVR({ state: revealedWith2 });
    expect(screen.getByTestId("vr-voter-e1")).toBeInTheDocument();
  });

  it("不顯示個人排序（showAuthor=false）", () => {
    renderVR({
      state: revealedWith2,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("vr-voter-e1")).not.toBeInTheDocument();
  });
});
