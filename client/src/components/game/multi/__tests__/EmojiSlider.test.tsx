import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiSlider, {
  EmojiSliderConfig,
  EmojiSliderState,
} from "../EmojiSlider";

const BASE_CONFIG: EmojiSliderConfig = {
  title: "情緒滑桿測試",
  question: "你今天心情如何？",
  leftEmoji: "😞",
  rightEmoji: "😄",
  leftLabel: "很糟",
  rightLabel: "很棒",
};

const EMPTY_STATE: EmojiSliderState = {
  responses: [],
  revealed: false,
};

const WITH_RESPONSES: EmojiSliderState = {
  responses: [
    { responseId: "r1", userId: "u1", userName: "Alice", value: 70 },
    { responseId: "r2", userId: "u2", userName: "Bob", value: 30 },
    { responseId: "r3", userId: "u3", userName: "Carol", value: 80 },
  ],
  revealed: false,
};

const REVEALED_STATE: EmojiSliderState = {
  ...WITH_RESPONSES,
  revealed: true,
};

function setup(
  state: EmojiSliderState = EMPTY_STATE,
  config: EmojiSliderConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onSubmit = vi.fn();
  const onReveal = vi.fn();
  render(
    <EmojiSlider
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={onSubmit}
      onReveal={onReveal}
    />
  );
  return { onSubmit, onReveal };
}

describe("EmojiSlider — 標題與問題", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("es-title")).toHaveTextContent("情緒滑桿測試");
  });

  it("顯示問題", () => {
    setup();
    expect(screen.getByTestId("es-question")).toHaveTextContent("你今天心情如何？");
  });

  it("顯示左右 emoji", () => {
    setup();
    expect(screen.getByText("😞")).toBeInTheDocument();
    expect(screen.getByText("😄")).toBeInTheDocument();
  });

  it("顯示左右標籤", () => {
    setup();
    expect(screen.getByText("很糟")).toBeInTheDocument();
    expect(screen.getByText("很棒")).toBeInTheDocument();
  });
});

describe("EmojiSlider — 未提交狀態", () => {
  it("顯示滑桿輸入", () => {
    setup();
    expect(screen.getByTestId("es-slider")).toBeInTheDocument();
  });

  it("顯示提交按鈕", () => {
    setup();
    expect(screen.getByTestId("es-submit-btn")).toBeInTheDocument();
  });

  it("滑桿預設值 50", () => {
    setup();
    expect(screen.getByTestId("es-preview-value")).toHaveTextContent("50");
  });

  it("調整滑桿更新預覽值", () => {
    setup();
    fireEvent.change(screen.getByTestId("es-slider"), { target: { value: "80" } });
    expect(screen.getByTestId("es-preview-value")).toHaveTextContent("80");
  });

  it("點擊提交呼叫 onSubmit 帶值", () => {
    const { onSubmit } = setup();
    fireEvent.change(screen.getByTestId("es-slider"), { target: { value: "65" } });
    fireEvent.click(screen.getByTestId("es-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(65);
  });

  it("顯示已提交人數", () => {
    setup(WITH_RESPONSES);
    expect(screen.getByTestId("es-count")).toHaveTextContent("3");
  });
});

describe("EmojiSlider — 已提交狀態", () => {
  it("顯示我的回應", () => {
    setup(WITH_RESPONSES);
    expect(screen.getByTestId("es-my-response")).toHaveTextContent("70");
  });

  it("已提交後不顯示滑桿", () => {
    setup(WITH_RESPONSES);
    expect(screen.queryByTestId("es-slider")).toBeNull();
  });

  it("已提交後不顯示提交按鈕", () => {
    setup(WITH_RESPONSES);
    expect(screen.queryByTestId("es-submit-btn")).toBeNull();
  });
});

describe("EmojiSlider — 公布按鈕", () => {
  it("未公布時顯示公布結果", () => {
    setup(WITH_RESPONSES);
    expect(screen.getByTestId("es-reveal-btn")).toBeInTheDocument();
  });

  it("點擊公布呼叫 onReveal", () => {
    const { onReveal } = setup(WITH_RESPONSES);
    fireEvent.click(screen.getByTestId("es-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("公布後不顯示公布按鈕", () => {
    setup(REVEALED_STATE);
    expect(screen.queryByTestId("es-reveal-btn")).toBeNull();
  });
});

describe("EmojiSlider — 公布後結果", () => {
  it("顯示分佈長條圖", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("es-bars")).toBeInTheDocument();
  });

  it("顯示平均值", () => {
    // avg = (70+30+80)/3 = 60
    setup(REVEALED_STATE);
    expect(screen.getByTestId("es-avg")).toHaveTextContent("60");
  });

  it("空回應時顯示空狀態", () => {
    const emptyRevealed: EmojiSliderState = { responses: [], revealed: true };
    setup(emptyRevealed);
    expect(screen.getByTestId("es-empty")).toBeInTheDocument();
  });
});
