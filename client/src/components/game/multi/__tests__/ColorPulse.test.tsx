import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ColorPulse, { ColorPulseConfig, ColorPulseState, ColorResponse } from "../ColorPulse";

const baseConfig: ColorPulseConfig = {
  title: "色彩心情",
  prompt: "選一個代表你心情的顏色",
  colors: [],
  maxNoteLength: 20,
  showAuthor: true,
};

const emptyState: ColorPulseState = { responses: [], revealed: false };

const responses: ColorResponse[] = [
  {
    responseId: "r1",
    userId: "u1",
    userName: "Alice",
    colorId: "red",
    colorHex: "#ef4444",
    colorLabel: "熱情紅",
    note: "超有精神",
    hearts: [],
  },
  {
    responseId: "r2",
    userId: "u2",
    userName: "Bob",
    colorId: "blue",
    colorHex: "#3b82f6",
    colorLabel: "深邃藍",
    note: "",
    hearts: ["u1"],
  },
];

const revealedState: ColorPulseState = { responses, revealed: true };

function renderCp(overrides: Partial<Parameters<typeof ColorPulse>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<ColorPulse {...props} />), props };
}

describe("ColorPulse — 基本渲染", () => {
  it("顯示標題", () => {
    renderCp();
    expect(screen.getByTestId("cp-title")).toHaveTextContent("色彩心情");
  });

  it("顯示提示語", () => {
    renderCp();
    expect(screen.getByTestId("cp-prompt")).toHaveTextContent("選一個代表你心情的顏色");
  });

  it("顯示已選色人數", () => {
    renderCp();
    expect(screen.getByTestId("cp-count")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderCp();
    expect(screen.getByTestId("cp-reveal-btn")).toBeInTheDocument();
  });

  it("預設顯示 DEFAULT_COLORS（10 個按鈕）", () => {
    renderCp();
    expect(screen.getByTestId("cp-color-red")).toBeInTheDocument();
    expect(screen.getByTestId("cp-color-blue")).toBeInTheDocument();
    expect(screen.getByTestId("cp-color-purple")).toBeInTheDocument();
  });

  it("使用自訂顏色", () => {
    renderCp({
      config: {
        ...baseConfig,
        colors: [{ id: "custom1", label: "自訂色", hex: "#123456" }],
      },
    });
    expect(screen.getByTestId("cp-color-custom1")).toBeInTheDocument();
    expect(screen.queryByTestId("cp-color-red")).not.toBeInTheDocument();
  });
});

describe("ColorPulse — 顏色選取", () => {
  it("未選顏色時送出鈕 disabled", () => {
    renderCp();
    expect(screen.getByTestId("cp-submit-btn")).toBeDisabled();
  });

  it("點選顏色後顯示已選顏色", () => {
    renderCp();
    fireEvent.click(screen.getByTestId("cp-color-red"));
    expect(screen.getByTestId("cp-selected-color")).toBeInTheDocument();
    expect(screen.getByTestId("cp-selected-color")).toHaveTextContent("熱情紅");
  });

  it("選顏色後送出鈕可點", () => {
    renderCp();
    fireEvent.click(screen.getByTestId("cp-color-red"));
    expect(screen.getByTestId("cp-submit-btn")).not.toBeDisabled();
  });
});

describe("ColorPulse — 備註驗證", () => {
  it("備註超過上限顯示錯誤", () => {
    renderCp({ config: { ...baseConfig, maxNoteLength: 5 } });
    fireEvent.click(screen.getByTestId("cp-color-red"));
    fireEvent.change(screen.getByTestId("cp-note-input"), {
      target: { value: "這段文字超過五個字符的限制" },
    });
    expect(screen.getByTestId("cp-note-error")).toBeInTheDocument();
  });

  it("備註超長時送出鈕 disabled", () => {
    renderCp({ config: { ...baseConfig, maxNoteLength: 5 } });
    fireEvent.click(screen.getByTestId("cp-color-red"));
    fireEvent.change(screen.getByTestId("cp-note-input"), {
      target: { value: "這段文字超過五個字符的限制" },
    });
    expect(screen.getByTestId("cp-submit-btn")).toBeDisabled();
  });
});

describe("ColorPulse — 送出", () => {
  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderCp({ onSubmit });
    fireEvent.click(screen.getByTestId("cp-color-red"));
    fireEvent.click(screen.getByTestId("cp-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("red", "#ef4444", "熱情紅", "");
  });

  it("帶備註送出", () => {
    const onSubmit = vi.fn();
    renderCp({ onSubmit });
    fireEvent.click(screen.getByTestId("cp-color-blue"));
    fireEvent.change(screen.getByTestId("cp-note-input"), {
      target: { value: "心情平靜" },
    });
    fireEvent.click(screen.getByTestId("cp-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("blue", "#3b82f6", "深邃藍", "心情平靜");
  });

  it("已送出顯示 cp-submitted-msg", () => {
    renderCp({
      state: {
        responses: [responses[0]],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("cp-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入區", () => {
    renderCp({
      state: {
        responses: [responses[0]],
        revealed: false,
      },
      myUserId: "u1",
    });
    expect(screen.queryByTestId("cp-submit-btn")).not.toBeInTheDocument();
  });
});

describe("ColorPulse — 揭曉", () => {
  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderCp({ onReveal });
    fireEvent.click(screen.getByTestId("cp-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("revealed=true 顯示 cp-result", () => {
    renderCp({ state: revealedState });
    expect(screen.getByTestId("cp-result")).toBeInTheDocument();
  });

  it("無回應時顯示 cp-empty", () => {
    renderCp({ state: { responses: [], revealed: true } });
    expect(screen.getByTestId("cp-empty")).toBeInTheDocument();
  });

  it("顯示每個回應的色點", () => {
    renderCp({ state: revealedState });
    expect(screen.getByTestId("cp-dot-r1")).toBeInTheDocument();
    expect(screen.getByTestId("cp-dot-r2")).toBeInTheDocument();
  });

  it("顯示色彩分佈 bar", () => {
    renderCp({ state: revealedState });
    expect(screen.getByTestId("cp-bar-red")).toBeInTheDocument();
    expect(screen.getByTestId("cp-bar-blue")).toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderCp({ state: revealedState });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderCp({ config: { ...baseConfig, showAuthor: false }, state: revealedState });
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });

  it("顯示備註", () => {
    renderCp({ state: revealedState });
    expect(screen.getByTestId("cp-card-note-r1")).toHaveTextContent("超有精神");
  });
});

describe("ColorPulse — 愛心", () => {
  it("按愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderCp({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("cp-heart-r1"));
    expect(onHeart).toHaveBeenCalledWith("r1");
  });

  it("顯示愛心數", () => {
    renderCp({ state: revealedState });
    expect(screen.getByTestId("cp-heart-count-r2")).toHaveTextContent("1");
  });

  it("自己已愛心顯示紅心", () => {
    renderCp({ state: revealedState, myUserId: "u1" });
    expect(screen.getByTestId("cp-heart-r2")).toHaveTextContent("❤️");
  });
});
