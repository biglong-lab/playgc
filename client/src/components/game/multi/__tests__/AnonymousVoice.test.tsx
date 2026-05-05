import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AnonymousVoice, { AnonymousVoiceConfig, AnonymousVoiceState, AnonEntry } from "../AnonymousVoice";

const baseConfig: AnonymousVoiceConfig = {
  title: "匿名心聲",
  prompt: "有什麼話想說？",
  maxLength: 50,
};

const emptyState: AnonymousVoiceState = {
  entries: [],
  submitterIds: [],
  revealed: false,
};

const entries: AnonEntry[] = [
  { entryId: "e1", text: "希望會議時間縮短", hearts: [] },
  { entryId: "e2", text: "團隊氣氛很好！", hearts: ["u1"] },
];

const revealedState: AnonymousVoiceState = {
  entries,
  submitterIds: ["u1", "u2"],
  revealed: true,
};

function renderAv(overrides: Partial<Parameters<typeof AnonymousVoice>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<AnonymousVoice {...props} />), props };
}

describe("AnonymousVoice — 基本渲染", () => {
  it("顯示標題", () => {
    renderAv();
    expect(screen.getByTestId("av-title")).toHaveTextContent("匿名心聲");
  });

  it("顯示提示語", () => {
    renderAv();
    expect(screen.getByTestId("av-prompt")).toHaveTextContent("有什麼話想說？");
  });

  it("顯示則數統計", () => {
    renderAv();
    expect(screen.getByTestId("av-count")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderAv();
    expect(screen.getByTestId("av-reveal-btn")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderAv();
    expect(screen.getByTestId("av-input")).toBeInTheDocument();
  });
});

describe("AnonymousVoice — 輸入驗證", () => {
  it("空白時送出鈕 disabled", () => {
    renderAv();
    expect(screen.getByTestId("av-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderAv();
    fireEvent.change(screen.getByTestId("av-input"), {
      target: { value: "我有話說" },
    });
    expect(screen.getByTestId("av-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderAv({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("av-input"), {
      target: { value: "超過五個字的內容！" },
    });
    expect(screen.getByTestId("av-error")).toBeInTheDocument();
  });

  it("超長時送出鈕 disabled", () => {
    renderAv({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("av-input"), {
      target: { value: "超過五個字的內容！" },
    });
    expect(screen.getByTestId("av-submit-btn")).toBeDisabled();
  });
});

describe("AnonymousVoice — 送出", () => {
  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderAv({ onSubmit });
    fireEvent.change(screen.getByTestId("av-input"), {
      target: { value: "這是我的心聲" },
    });
    fireEvent.click(screen.getByTestId("av-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("這是我的心聲");
  });

  it("已送出顯示 av-submitted-msg", () => {
    renderAv({
      state: {
        entries: [entries[0]],
        submitterIds: ["u1"],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("av-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderAv({
      state: {
        entries: [entries[0]],
        submitterIds: ["u1"],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("av-submit-btn")).not.toBeInTheDocument();
  });
});

describe("AnonymousVoice — 揭曉", () => {
  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderAv({ onReveal });
    fireEvent.click(screen.getByTestId("av-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示 av-result", () => {
    renderAv({ state: revealedState });
    expect(screen.getByTestId("av-result")).toBeInTheDocument();
  });

  it("無 entry 時顯示 av-empty", () => {
    renderAv({ state: { entries: [], submitterIds: [], revealed: true } });
    expect(screen.getByTestId("av-empty")).toBeInTheDocument();
  });

  it("顯示所有 entry", () => {
    renderAv({ state: revealedState });
    expect(screen.getByTestId("av-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("av-entry-e2")).toBeInTheDocument();
  });

  it("顯示 entry 文字", () => {
    renderAv({ state: revealedState });
    expect(screen.getByTestId("av-entry-text-e1")).toHaveTextContent("希望會議時間縮短");
  });

  it("不顯示作者名字（完全匿名）", () => {
    renderAv({ state: revealedState });
    expect(screen.queryByText("u1")).not.toBeInTheDocument();
    expect(screen.queryByText("u2")).not.toBeInTheDocument();
  });
});

describe("AnonymousVoice — 愛心", () => {
  it("按愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderAv({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("av-heart-e1"));
    expect(onHeart).toHaveBeenCalledWith("e1");
  });

  it("顯示愛心數量", () => {
    renderAv({ state: revealedState });
    expect(screen.getByTestId("av-heart-count-e2")).toHaveTextContent("1");
  });

  it("自己已愛心顯示紅心", () => {
    renderAv({ state: revealedState, myUserId: "u1" });
    expect(screen.getByTestId("av-heart-e2")).toHaveTextContent("❤️");
  });
});
