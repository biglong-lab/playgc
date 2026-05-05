import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OpenMic, { OpenMicConfig, OpenMicState } from "../OpenMic";

const baseConfig: OpenMicConfig = {
  title: "開放麥克風",
  prompt: "搶麥！說出你想分享的話",
  maxTopicLength: 50,
};

const emptyState: OpenMicState = { slots: [], currentSlotId: null };

const slotsState: OpenMicState = {
  slots: [
    {
      slotId: "s1",
      userId: "u2",
      userName: "Bob",
      topic: "分享旅遊經驗",
      status: "waiting",
    },
    {
      slotId: "s2",
      userId: "u3",
      userName: "Carol",
      topic: "新年計畫",
      status: "waiting",
    },
  ],
  currentSlotId: null,
};

const activeState: OpenMicState = {
  slots: [
    {
      slotId: "s1",
      userId: "u2",
      userName: "Bob",
      topic: "分享旅遊經驗",
      status: "active",
    },
    {
      slotId: "s2",
      userId: "u3",
      userName: "Carol",
      topic: "新年計畫",
      status: "waiting",
    },
  ],
  currentSlotId: "s1",
};

const mySlotState: OpenMicState = {
  slots: [
    {
      slotId: "s99",
      userId: "u1",
      userName: "Alice",
      topic: "我的小故事",
      status: "waiting",
    },
  ],
  currentSlotId: null,
};

function renderOm(
  overrides: Partial<Parameters<typeof OpenMic>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onRequest: vi.fn(),
    onNext: vi.fn(),
    onDone: vi.fn(),
    ...overrides,
  };
  return { ...render(<OpenMic {...props} />), props };
}

describe("OpenMic — 基本渲染", () => {
  it("顯示標題", () => {
    renderOm();
    expect(screen.getByTestId("om-title")).toHaveTextContent(
      "開放麥克風"
    );
  });

  it("顯示提示語", () => {
    renderOm();
    expect(screen.getByTestId("om-prompt")).toBeInTheDocument();
  });

  it("空列表時顯示 om-empty", () => {
    renderOm();
    expect(screen.getByTestId("om-empty")).toBeInTheDocument();
  });
});

describe("OpenMic — 登記搶麥", () => {
  it("顯示輸入框", () => {
    renderOm();
    expect(screen.getByTestId("om-request-input")).toBeInTheDocument();
  });

  it("空白時搶麥鈕 disabled", () => {
    renderOm();
    expect(screen.getByTestId("om-request-btn")).toBeDisabled();
  });

  it("有內容時搶麥鈕可點", () => {
    renderOm();
    fireEvent.change(screen.getByTestId("om-request-input"), {
      target: { value: "我的小故事" },
    });
    expect(
      screen.getByTestId("om-request-btn")
    ).not.toBeDisabled();
  });

  it("點搶麥呼叫 onRequest", () => {
    const onRequest = vi.fn();
    renderOm({ onRequest });
    fireEvent.change(screen.getByTestId("om-request-input"), {
      target: { value: "我的小故事" },
    });
    fireEvent.click(screen.getByTestId("om-request-btn"));
    expect(onRequest).toHaveBeenCalledWith("我的小故事");
  });

  it("已登記後顯示確認訊息", () => {
    renderOm({ state: mySlotState });
    expect(
      screen.getByTestId("om-submitted-msg")
    ).toBeInTheDocument();
  });

  it("已登記後不顯示輸入框", () => {
    renderOm({ state: mySlotState });
    expect(
      screen.queryByTestId("om-request-input")
    ).not.toBeInTheDocument();
  });
});

describe("OpenMic — 等待列表", () => {
  it("顯示等待中的槽位", () => {
    renderOm({ state: slotsState });
    expect(screen.getByTestId("om-slot-s1")).toBeInTheDocument();
    expect(screen.getByTestId("om-slot-s2")).toBeInTheDocument();
  });

  it("無人在台時顯示呼叫下一位按鈕", () => {
    renderOm({ state: slotsState });
    expect(screen.getByTestId("om-next-btn")).toBeInTheDocument();
  });

  it("點呼叫下一位呼叫 onNext", () => {
    const onNext = vi.fn();
    renderOm({ state: slotsState, onNext });
    fireEvent.click(screen.getByTestId("om-next-btn"));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe("OpenMic — 進行中", () => {
  it("顯示目前講話者", () => {
    renderOm({ state: activeState });
    expect(
      screen.getByTestId("om-current-s1")
    ).toBeInTheDocument();
  });

  it("顯示講完按鈕", () => {
    renderOm({ state: activeState });
    expect(screen.getByTestId("om-done-btn")).toBeInTheDocument();
  });

  it("點講完呼叫 onDone", () => {
    const onDone = vi.fn();
    renderOm({ state: activeState, onDone });
    fireEvent.click(screen.getByTestId("om-done-btn"));
    expect(onDone).toHaveBeenCalledWith("s1");
  });

  it("有人在台時不顯示呼叫下一位按鈕", () => {
    renderOm({ state: activeState });
    expect(
      screen.queryByTestId("om-next-btn")
    ).not.toBeInTheDocument();
  });
});

describe("OpenMic — 已完成", () => {
  it("完成後顯示已完成數量", () => {
    renderOm({
      state: {
        slots: [
          {
            slotId: "s1",
            userId: "u2",
            userName: "Bob",
            topic: "故事",
            status: "done",
          },
        ],
        currentSlotId: null,
      },
    });
    expect(screen.getByTestId("om-done-count")).toBeInTheDocument();
  });
});
