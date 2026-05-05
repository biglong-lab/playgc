import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TastingNotes, {
  TastingNotesConfig,
  TastingNotesState,
  TastingEntry,
} from "../TastingNotes";

const baseConfig: TastingNotesConfig = {
  title: "品鑑筆記",
  prompt: "寫下你的品鑑感受",
  itemLabel: "品項名稱",
  showItemName: true,
  maxNotesLength: 50,
  showAuthor: true,
};

const emptyState: TastingNotesState = {
  entries: [],
  revealed: false,
};

const entries: TastingEntry[] = [
  {
    entryId: "e1",
    userId: "u2",
    userName: "Bob",
    itemName: "金門高粱",
    rating: 5,
    notes: "香氣濃郁，入喉順滑，回甘持久",
    hearts: ["u1"],
  },
  {
    entryId: "e2",
    userId: "u3",
    userName: "Carol",
    itemName: "馬祖老酒",
    rating: 3,
    notes: "口感偏甜，略帶藥香",
    hearts: [],
  },
];

const revealedState: TastingNotesState = {
  entries,
  revealed: true,
};

function renderTn(
  overrides: Partial<Parameters<typeof TastingNotes>[0]> = {}
) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u1",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    onHeart: vi.fn(),
    ...overrides,
  };
  return { ...render(<TastingNotes {...props} />), props };
}

describe("TastingNotes — 基本渲染", () => {
  it("顯示標題", () => {
    renderTn();
    expect(screen.getByTestId("tn-title")).toHaveTextContent(
      "品鑑筆記"
    );
  });

  it("顯示提示語", () => {
    renderTn();
    expect(screen.getByTestId("tn-prompt")).toHaveTextContent(
      "寫下你的品鑑感受"
    );
  });

  it("顯示送出份數", () => {
    renderTn();
    expect(screen.getByTestId("tn-count")).toBeInTheDocument();
  });
});

describe("TastingNotes — 送出品鑑", () => {
  it("顯示品項名稱輸入框（showItemName=true）", () => {
    renderTn();
    expect(screen.getByTestId("tn-item-input")).toBeInTheDocument();
  });

  it("不顯示品項名稱輸入框（showItemName=false）", () => {
    renderTn({
      config: { ...baseConfig, showItemName: false },
    });
    expect(
      screen.queryByTestId("tn-item-input")
    ).not.toBeInTheDocument();
  });

  it("顯示 5 顆星評分按鈕", () => {
    renderTn();
    expect(screen.getByTestId("tn-star-1")).toBeInTheDocument();
    expect(screen.getByTestId("tn-star-5")).toBeInTheDocument();
  });

  it("顯示品鑑筆記輸入區", () => {
    renderTn();
    expect(
      screen.getByTestId("tn-notes-input")
    ).toBeInTheDocument();
  });

  it("未評分時送出鈕 disabled", () => {
    renderTn();
    fireEvent.change(screen.getByTestId("tn-notes-input"), {
      target: { value: "很好喝" },
    });
    expect(screen.getByTestId("tn-submit-btn")).toBeDisabled();
  });

  it("有評分有筆記時送出鈕可點", () => {
    renderTn({
      config: { ...baseConfig, showItemName: false },
    });
    fireEvent.click(screen.getByTestId("tn-star-4"));
    fireEvent.change(screen.getByTestId("tn-notes-input"), {
      target: { value: "很好喝" },
    });
    expect(
      screen.getByTestId("tn-submit-btn")
    ).not.toBeDisabled();
  });

  it("超過 maxNotesLength 顯示錯誤", () => {
    renderTn({ config: { ...baseConfig, maxNotesLength: 5 } });
    fireEvent.change(screen.getByTestId("tn-notes-input"), {
      target: { value: "超過五個字的品鑑筆記啦啦啦" },
    });
    expect(
      screen.getByTestId("tn-char-error")
    ).toBeInTheDocument();
  });

  it("點送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    renderTn({
      config: { ...baseConfig, showItemName: false },
      onSubmit,
    });
    fireEvent.click(screen.getByTestId("tn-star-5"));
    fireEvent.change(screen.getByTestId("tn-notes-input"), {
      target: { value: "非常棒" },
    });
    fireEvent.click(screen.getByTestId("tn-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith({
      itemName: "",
      rating: 5,
      notes: "非常棒",
    });
  });

  it("已送出後顯示確認訊息", () => {
    renderTn({
      state: {
        entries: [
          {
            entryId: "e99",
            userId: "u1",
            userName: "Alice",
            itemName: "",
            rating: 4,
            notes: "不錯",
            hearts: [],
          },
        ],
        revealed: false,
      },
    });
    expect(
      screen.getByTestId("tn-submitted-msg")
    ).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderTn();
    expect(
      screen.getByTestId("tn-reveal-btn")
    ).toBeInTheDocument();
  });

  it("點揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderTn({ onReveal });
    fireEvent.click(screen.getByTestId("tn-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });
});

describe("TastingNotes — 揭曉結果", () => {
  it("顯示所有品鑑記錄", () => {
    renderTn({ state: revealedState });
    expect(screen.getByTestId("tn-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("tn-entry-e2")).toBeInTheDocument();
  });

  it("顯示評分星星", () => {
    renderTn({ state: revealedState });
    expect(
      screen.getByTestId("tn-entry-rating-e1")
    ).toBeInTheDocument();
  });

  it("顯示作者（showAuthor=true）", () => {
    renderTn({ state: revealedState });
    expect(screen.getByTestId("tn-author-e1")).toHaveTextContent(
      "Bob"
    );
  });

  it("隱藏作者（showAuthor=false）", () => {
    renderTn({
      config: { ...baseConfig, showAuthor: false },
      state: revealedState,
    });
    expect(
      screen.queryByTestId("tn-author-e1")
    ).not.toBeInTheDocument();
  });

  it("顯示愛心按鈕", () => {
    renderTn({ state: revealedState });
    expect(
      screen.getByTestId("tn-heart-e1")
    ).toBeInTheDocument();
  });

  it("點愛心呼叫 onHeart", () => {
    const onHeart = vi.fn();
    renderTn({ state: revealedState, onHeart });
    fireEvent.click(screen.getByTestId("tn-heart-e2"));
    expect(onHeart).toHaveBeenCalledWith("e2");
  });

  it("無記錄時顯示 tn-empty", () => {
    renderTn({ state: { entries: [], revealed: true } });
    expect(screen.getByTestId("tn-empty")).toBeInTheDocument();
  });
});
