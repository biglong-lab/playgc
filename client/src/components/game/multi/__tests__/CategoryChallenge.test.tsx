import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryChallenge, {
  type CategoryChallengeConfig,
  type CategoryChallengeState,
} from "../CategoryChallenge";

const config: CategoryChallengeConfig = {
  title: "大家來找共同點",
  category: "台灣美食",
  prompt: "你最愛的台灣美食有哪些？",
  maxItemsPerPerson: 5,
  maxItemLength: 15,
  showCommon: true,
};

const emptyState: CategoryChallengeState = { submissions: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderCC(overrides: Partial<typeof baseProps> = {}) {
  return render(<CategoryChallenge {...baseProps} {...overrides} />);
}

describe("CategoryChallenge — 基本渲染", () => {
  it("顯示標題", () => {
    renderCC();
    expect(screen.getByTestId("cc-title")).toHaveTextContent("大家來找共同點");
  });

  it("顯示分類", () => {
    renderCC();
    expect(screen.getByTestId("cc-category")).toHaveTextContent("台灣美食");
  });

  it("顯示提示語", () => {
    renderCC();
    expect(screen.getByTestId("cc-prompt")).toHaveTextContent("你最愛的台灣美食");
  });

  it("顯示計數", () => {
    renderCC();
    expect(screen.getByTestId("cc-count")).toBeInTheDocument();
  });

  it("顯示輸入框", () => {
    renderCC();
    expect(screen.getByTestId("cc-item-input")).toBeInTheDocument();
  });

  it("顯示加入按鈕", () => {
    renderCC();
    expect(screen.getByTestId("cc-add-btn")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderCC();
    expect(screen.getByTestId("cc-reveal-btn")).toBeInTheDocument();
  });

  it("初始送出按鈕 disabled", () => {
    renderCC();
    expect(screen.getByTestId("cc-submit-btn")).toBeDisabled();
  });
});

describe("CategoryChallenge — 加入與本地清單", () => {
  it("輸入空白加入按鈕 disabled", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "" } });
    expect(screen.getByTestId("cc-add-btn")).toBeDisabled();
  });

  it("輸入有效文字加入按鈕 enabled", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "滷肉飯" } });
    expect(screen.getByTestId("cc-add-btn")).not.toBeDisabled();
  });

  it("點加入後顯示本地清單", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "滷肉飯" } });
    fireEvent.click(screen.getByTestId("cc-add-btn"));
    expect(screen.getByTestId("cc-local-list")).toBeInTheDocument();
    expect(screen.getByTestId("cc-local-item-0")).toHaveTextContent("滷肉飯");
  });

  it("加入後輸入框清空", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "滷肉飯" } });
    fireEvent.click(screen.getByTestId("cc-add-btn"));
    expect((screen.getByTestId("cc-item-input") as HTMLInputElement).value).toBe("");
  });

  it("加入後送出按鈕 enabled", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "滷肉飯" } });
    fireEvent.click(screen.getByTestId("cc-add-btn"));
    expect(screen.getByTestId("cc-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxItemLength 顯示錯誤", () => {
    renderCC();
    const longText = "a".repeat(20);
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: longText } });
    expect(screen.getByTestId("cc-error")).toBeInTheDocument();
  });

  it("超過 maxItemLength 加入按鈕 disabled", () => {
    renderCC();
    const longText = "a".repeat(20);
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: longText } });
    expect(screen.getByTestId("cc-add-btn")).toBeDisabled();
  });

  it("Enter 鍵加入有效項目", () => {
    renderCC();
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: "珍珠奶茶" } });
    fireEvent.keyDown(screen.getByTestId("cc-item-input"), { key: "Enter" });
    expect(screen.getByTestId("cc-local-item-0")).toHaveTextContent("珍珠奶茶");
  });
});

describe("CategoryChallenge — 送出", () => {
  function addItem(text: string) {
    fireEvent.change(screen.getByTestId("cc-item-input"), { target: { value: text } });
    fireEvent.click(screen.getByTestId("cc-add-btn"));
  }

  it("送出觸發 onSubmit 並帶 items", () => {
    const onSubmit = vi.fn();
    renderCC({ onSubmit });
    addItem("滷肉飯");
    addItem("珍珠奶茶");
    fireEvent.click(screen.getByTestId("cc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["滷肉飯", "珍珠奶茶"]);
  });

  it("已送出後顯示 cc-submitted-msg", () => {
    const state: CategoryChallengeState = {
      submissions: [{ entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯"] }],
      revealed: false,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-submitted-msg")).toBeInTheDocument();
  });

  it("已送出後隱藏輸入框", () => {
    const state: CategoryChallengeState = {
      submissions: [{ entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯"] }],
      revealed: false,
    };
    renderCC({ state });
    expect(screen.queryByTestId("cc-item-input")).not.toBeInTheDocument();
  });
});

describe("CategoryChallenge — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderCC({ onReveal });
    fireEvent.click(screen.getByTestId("cc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("揭曉後顯示 cc-result", () => {
    const revealed: CategoryChallengeState = { submissions: [], revealed: true };
    renderCC({ state: revealed });
    expect(screen.getByTestId("cc-result")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    const revealed: CategoryChallengeState = { submissions: [], revealed: true };
    renderCC({ state: revealed });
    expect(screen.queryByTestId("cc-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉無人提交顯示 cc-empty", () => {
    const revealed: CategoryChallengeState = { submissions: [], revealed: true };
    renderCC({ state: revealed });
    expect(screen.getByTestId("cc-empty")).toBeInTheDocument();
  });

  it("揭曉後顯示 submission", () => {
    const state: CategoryChallengeState = {
      submissions: [{ entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯"] }],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-submission-s1")).toBeInTheDocument();
  });

  it("揭曉後顯示 item", () => {
    const state: CategoryChallengeState = {
      submissions: [{ entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯", "珍珠奶茶"] }],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-item-s1-0")).toHaveTextContent("滷肉飯");
    expect(screen.getByTestId("cc-item-s1-1")).toHaveTextContent("珍珠奶茶");
  });
});

describe("CategoryChallenge — 共同項目", () => {
  it("2 人有同樣項目 → 顯示 cc-common-section", () => {
    const state: CategoryChallengeState = {
      submissions: [
        { entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯", "珍珠奶茶"] },
        { entryId: "s2", userId: "u2", userName: "Bob", items: ["滷肉飯", "臭豆腐"] },
      ],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-common-section")).toBeInTheDocument();
  });

  it("共同項目顯示在 cc-common-{item}", () => {
    const state: CategoryChallengeState = {
      submissions: [
        { entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯"] },
        { entryId: "s2", userId: "u2", userName: "Bob", items: ["滷肉飯"] },
      ],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-common-滷肉飯")).toBeInTheDocument();
  });

  it("showCommon=false 不顯示共同項目區塊", () => {
    const cfg: CategoryChallengeConfig = { ...config, showCommon: false };
    const state: CategoryChallengeState = {
      submissions: [
        { entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯"] },
        { entryId: "s2", userId: "u2", userName: "Bob", items: ["滷肉飯"] },
      ],
      revealed: true,
    };
    renderCC({ config: cfg, state });
    expect(screen.queryByTestId("cc-common-section")).not.toBeInTheDocument();
  });

  it("大小寫不影響共同判斷（lowercase normalize）", () => {
    const state: CategoryChallengeState = {
      submissions: [
        { entryId: "s1", userId: "u1", userName: "A", items: ["Pizza"] },
        { entryId: "s2", userId: "u2", userName: "B", items: ["pizza"] },
      ],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.getByTestId("cc-common-section")).toBeInTheDocument();
  });

  it("只有 1 人的項目不顯示為共同", () => {
    const state: CategoryChallengeState = {
      submissions: [
        { entryId: "s1", userId: "u1", userName: "Alice", items: ["滷肉飯", "珍珠奶茶"] },
        { entryId: "s2", userId: "u2", userName: "Bob", items: ["臭豆腐"] },
      ],
      revealed: true,
    };
    renderCC({ state });
    expect(screen.queryByTestId("cc-common-section")).not.toBeInTheDocument();
  });
});
