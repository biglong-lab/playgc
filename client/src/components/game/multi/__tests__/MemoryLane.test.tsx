import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MemoryLane, {
  type MemoryLaneConfig,
  type MemoryLaneState,
} from "../MemoryLane";

const config: MemoryLaneConfig = {
  title: "記憶走廊",
  question: "你最難忘的瞬間是什麼？",
  maxLength: 100,
  showAuthor: true,
};

const emptyState: MemoryLaneState = { memories: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftText: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
  onHeart: vi.fn(),
};

function renderML(overrides: Partial<typeof baseProps> = {}) {
  return render(<MemoryLane {...baseProps} {...overrides} />);
}

describe("MemoryLane — 基本渲染", () => {
  it("顯示標題", () => {
    renderML();
    expect(screen.getByTestId("ml-title")).toHaveTextContent("記憶走廊");
  });

  it("顯示問題", () => {
    renderML();
    expect(screen.getByTestId("ml-question")).toHaveTextContent("你最難忘的瞬間");
  });

  it("顯示計數", () => {
    renderML();
    expect(screen.getByTestId("ml-count")).toBeInTheDocument();
  });

  it("顯示輸入區域", () => {
    renderML();
    expect(screen.getByTestId("ml-input")).toBeInTheDocument();
  });

  it("顯示分享按鈕", () => {
    renderML();
    expect(screen.getByTestId("ml-submit-btn")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderML();
    expect(screen.getByTestId("ml-reveal-btn")).toBeInTheDocument();
  });
});

describe("MemoryLane — 輸入與送出", () => {
  it("空白輸入送出按鈕 disabled", () => {
    renderML({ draftText: "" });
    expect(screen.getByTestId("ml-submit-btn")).toBeDisabled();
  });

  it("有效輸入送出按鈕 enabled", () => {
    renderML({ draftText: "那次旅行讓我很難忘" });
    expect(screen.getByTestId("ml-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderML({ draftText: "a".repeat(105) });
    expect(screen.getByTestId("ml-error")).toBeInTheDocument();
  });

  it("超過 maxLength 送出按鈕 disabled", () => {
    renderML({ draftText: "a".repeat(105) });
    expect(screen.getByTestId("ml-submit-btn")).toBeDisabled();
  });

  it("onChange 觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderML({ onDraftChange });
    fireEvent.change(screen.getByTestId("ml-input"), { target: { value: "美好的回憶" } });
    expect(onDraftChange).toHaveBeenCalledWith("美好的回憶");
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderML({ draftText: "美好的回憶", onSubmit });
    fireEvent.click(screen.getByTestId("ml-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("顯示字數計數", () => {
    renderML({ draftText: "美好的回憶" });
    expect(screen.getByTestId("ml-char-count")).toHaveTextContent("5 / 100");
  });
});

describe("MemoryLane — 已提交狀態", () => {
  const stateWithMem: MemoryLaneState = {
    memories: [{ memId: "m1", userId: "u1", userName: "Alice", text: "美好回憶", hearts: [] }],
    revealed: false,
  };

  it("已提交後顯示 ml-submitted-msg", () => {
    renderML({ state: stateWithMem });
    expect(screen.getByTestId("ml-submitted-msg")).toBeInTheDocument();
  });

  it("已提交後隱藏輸入框", () => {
    renderML({ state: stateWithMem });
    expect(screen.queryByTestId("ml-input")).not.toBeInTheDocument();
  });

  it("已提交後仍顯示揭曉按鈕", () => {
    renderML({ state: stateWithMem });
    expect(screen.getByTestId("ml-reveal-btn")).toBeInTheDocument();
  });
});

describe("MemoryLane — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderML({ onReveal });
    fireEvent.click(screen.getByTestId("ml-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("揭曉後顯示 ml-result", () => {
    const revealed: MemoryLaneState = { memories: [], revealed: true };
    renderML({ state: revealed });
    expect(screen.getByTestId("ml-result")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    const revealed: MemoryLaneState = { memories: [], revealed: true };
    renderML({ state: revealed });
    expect(screen.queryByTestId("ml-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉無人分享顯示 ml-empty", () => {
    const revealed: MemoryLaneState = { memories: [], revealed: true };
    renderML({ state: revealed });
    expect(screen.getByTestId("ml-empty")).toBeInTheDocument();
  });

  it("揭曉後顯示記憶卡片", () => {
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "那次日出", hearts: [] }],
      revealed: true,
    };
    renderML({ state });
    expect(screen.getByTestId("ml-card-m1")).toBeInTheDocument();
    expect(screen.getByTestId("ml-card-m1")).toHaveTextContent("那次日出");
  });

  it("showAuthor=true 顯示作者名字", () => {
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "那次日出", hearts: [] }],
      revealed: true,
    };
    renderML({ state });
    expect(screen.getByTestId("ml-card-m1")).toHaveTextContent("Bob");
  });

  it("showAuthor=false 不顯示名字", () => {
    const cfg: MemoryLaneConfig = { ...config, showAuthor: false };
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "那次日出", hearts: [] }],
      revealed: true,
    };
    renderML({ config: cfg, state });
    expect(screen.getByTestId("ml-card-m1")).not.toHaveTextContent("Bob");
  });
});

describe("MemoryLane — 愛心互動", () => {
  it("顯示愛心按鈕", () => {
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "回憶", hearts: [] }],
      revealed: true,
    };
    renderML({ state });
    expect(screen.getByTestId("ml-heart-m1")).toBeInTheDocument();
  });

  it("點愛心觸發 onHeart", () => {
    const onHeart = vi.fn();
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "回憶", hearts: [] }],
      revealed: true,
    };
    renderML({ state, onHeart });
    fireEvent.click(screen.getByTestId("ml-heart-m1"));
    expect(onHeart).toHaveBeenCalledWith("m1");
  });

  it("已按愛心顯示計數", () => {
    const state: MemoryLaneState = {
      memories: [{ memId: "m1", userId: "u2", userName: "Bob", text: "回憶", hearts: ["u1", "u3"] }],
      revealed: true,
    };
    renderML({ state });
    expect(screen.getByTestId("ml-heart-count-m1")).toHaveTextContent("2");
  });
});
