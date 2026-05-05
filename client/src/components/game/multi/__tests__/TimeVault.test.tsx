import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TimeVault, {
  TimeVaultConfig,
  TimeVaultState,
  VaultEntry,
} from "../TimeVault";

const baseConfig: TimeVaultConfig = {
  title: "時光膠囊",
  prompt: "寫下你想在未來看到的話",
  revealLabel: "2027 年同學會開封",
  maxLength: 100,
  showAuthor: true,
};

const submitState: TimeVaultState = {
  entries: [],
  phase: "submit",
};

const entries: VaultEntry[] = [
  {
    entryId: "v1",
    userId: "u2",
    userName: "Bob",
    text: "希望五年後大家都過得很好！",
    hearts: ["u1"],
  },
  {
    entryId: "v2",
    userId: "u3",
    userName: "Carol",
    text: "記得要保持聯絡唷！",
    hearts: [],
  },
];

const sealedState: TimeVaultState = {
  entries,
  phase: "sealed",
};

const revealedState: TimeVaultState = {
  entries,
  phase: "revealed",
};

function renderTv(
  overrides: Partial<Parameters<typeof TimeVault>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: submitState,
    myUserId: "u1",
    onSubmitEntry: vi.fn(),
    onAdvancePhase: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<TimeVault {...props} />), props };
}

describe("TimeVault — 基本渲染", () => {
  it("顯示標題", () => {
    renderTv();
    expect(screen.getByTestId("tv-title")).toHaveTextContent(
      "時光膠囊"
    );
  });

  it("顯示提示語", () => {
    renderTv();
    expect(screen.getByTestId("tv-prompt")).toHaveTextContent(
      "寫下你想在未來看到的話"
    );
  });

  it("顯示開封說明", () => {
    renderTv();
    expect(
      screen.getByTestId("tv-reveal-label")
    ).toHaveTextContent("2027 年同學會開封");
  });

  it("顯示已放入數量", () => {
    renderTv();
    expect(screen.getByTestId("tv-count")).toBeInTheDocument();
  });

  it("顯示封存中階段標籤", () => {
    renderTv();
    expect(screen.getByTestId("tv-phase")).toHaveTextContent(
      "封存中"
    );
  });
});

describe("TimeVault — 送出訊息", () => {
  it("顯示輸入框", () => {
    renderTv();
    expect(screen.getByTestId("tv-input")).toBeInTheDocument();
  });

  it("空白時送出鈕 disabled", () => {
    renderTv();
    expect(screen.getByTestId("tv-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderTv();
    fireEvent.change(screen.getByTestId("tv-input"), {
      target: { value: "未來的你好！" },
    });
    expect(
      screen.getByTestId("tv-submit-btn")
    ).not.toBeDisabled();
  });

  it("超過 maxLength 顯示錯誤", () => {
    renderTv({ config: { ...baseConfig, maxLength: 5 } });
    fireEvent.change(screen.getByTestId("tv-input"), {
      target: { value: "超過五個字的訊息哈哈哈哈" },
    });
    expect(
      screen.getByTestId("tv-char-error")
    ).toBeInTheDocument();
  });

  it("點送出呼叫 onSubmitEntry", () => {
    const onSubmitEntry = vi.fn();
    renderTv({ onSubmitEntry });
    fireEvent.change(screen.getByTestId("tv-input"), {
      target: { value: "未來的你好！" },
    });
    fireEvent.click(screen.getByTestId("tv-submit-btn"));
    expect(onSubmitEntry).toHaveBeenCalledWith("未來的你好！");
  });

  it("已送出後顯示確認訊息", () => {
    renderTv({
      state: {
        entries: [
          {
            entryId: "v99",
            userId: "u1",
            userName: "Alice",
            text: "我的訊息",
            hearts: [],
          },
        ],
        phase: "submit",
      },
    });
    expect(
      screen.getByTestId("tv-submitted-msg")
    ).toBeInTheDocument();
  });

  it("顯示封存膠囊按鈕", () => {
    renderTv();
    expect(
      screen.getByTestId("tv-advance-btn")
    ).toBeInTheDocument();
  });

  it("點封存膠囊呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderTv({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("tv-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("TimeVault — 封存階段", () => {
  it("顯示已封存階段標籤", () => {
    renderTv({ state: sealedState });
    expect(screen.getByTestId("tv-phase")).toHaveTextContent(
      "已封存"
    );
  });

  it("顯示封存提示訊息", () => {
    renderTv({ state: sealedState });
    expect(
      screen.getByTestId("tv-sealed-msg")
    ).toBeInTheDocument();
  });

  it("顯示開封按鈕", () => {
    renderTv({ state: sealedState });
    expect(
      screen.getByTestId("tv-advance-btn")
    ).toBeInTheDocument();
  });

  it("點開封呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderTv({ state: sealedState, onAdvancePhase });
    fireEvent.click(screen.getByTestId("tv-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });

  it("封存中不顯示輸入框", () => {
    renderTv({ state: sealedState });
    expect(
      screen.queryByTestId("tv-input")
    ).not.toBeInTheDocument();
  });
});

describe("TimeVault — 開封階段", () => {
  it("顯示開封階段標籤", () => {
    renderTv({ state: revealedState });
    expect(screen.getByTestId("tv-phase")).toHaveTextContent(
      "開封"
    );
  });

  it("顯示所有訊息", () => {
    renderTv({ state: revealedState });
    expect(screen.getByTestId("tv-entry-v1")).toBeInTheDocument();
    expect(screen.getByTestId("tv-entry-v2")).toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderTv({ state: revealedState });
    expect(screen.getByTestId("tv-author-v1")).toHaveTextContent(
      "Bob"
    );
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderTv({
      config: { ...baseConfig, showAuthor: false },
      state: revealedState,
    });
    expect(
      screen.queryByTestId("tv-author-v1")
    ).not.toBeInTheDocument();
  });

  it("顯示愛心按鈕", () => {
    renderTv({ state: revealedState });
    expect(
      screen.getByTestId("tv-heart-v1")
    ).toBeInTheDocument();
  });

  it("點愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderTv({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("tv-heart-v2"));
    expect(onHeart).toHaveBeenCalledWith("v2");
  });

  it("空膠囊顯示 tv-empty", () => {
    renderTv({
      state: { entries: [], phase: "revealed" },
    });
    expect(screen.getByTestId("tv-empty")).toBeInTheDocument();
  });
});
