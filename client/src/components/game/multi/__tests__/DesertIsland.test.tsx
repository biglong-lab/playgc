import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DesertIsland, {
  type DesertIslandConfig,
  type DesertIslandState,
} from "../DesertIsland";

const config: DesertIslandConfig = {
  title: "荒島求生",
  scenario: "如果你被困在荒島，你會帶哪 3 樣東西？",
  numItems: 3,
  maxItemLength: 20,
  showAuthor: true,
};

const emptyState: DesertIslandState = { entries: [], revealed: false };
const draftItems = ["", "", ""];

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftItems,
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderDI(overrides: Partial<typeof baseProps> = {}) {
  return render(<DesertIsland {...baseProps} {...overrides} />);
}

describe("DesertIsland — 基本渲染", () => {
  it("顯示標題", () => {
    renderDI();
    expect(screen.getByTestId("di-title")).toHaveTextContent("荒島求生");
  });

  it("顯示情境描述", () => {
    renderDI();
    expect(screen.getByTestId("di-scenario")).toHaveTextContent("如果你被困在荒島");
  });

  it("顯示計數", () => {
    renderDI();
    expect(screen.getByTestId("di-count")).toBeInTheDocument();
  });

  it("顯示 numItems 個輸入框", () => {
    renderDI();
    expect(screen.getByTestId("di-item-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("di-item-input-1")).toBeInTheDocument();
    expect(screen.getByTestId("di-item-input-2")).toBeInTheDocument();
  });

  it("顯示送出按鈕", () => {
    renderDI();
    expect(screen.getByTestId("di-submit-btn")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderDI();
    expect(screen.getByTestId("di-reveal-btn")).toBeInTheDocument();
  });
});

describe("DesertIsland — 送出驗證", () => {
  it("空白 draftItems 時送出按鈕 disabled", () => {
    renderDI({ draftItems: ["", "", ""] });
    expect(screen.getByTestId("di-submit-btn")).toBeDisabled();
  });

  it("部分填寫時送出按鈕 disabled", () => {
    renderDI({ draftItems: ["水", "", ""] });
    expect(screen.getByTestId("di-submit-btn")).toBeDisabled();
  });

  it("全部填寫時送出按鈕 enabled", () => {
    renderDI({ draftItems: ["水", "刀", "打火機"] });
    expect(screen.getByTestId("di-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxItemLength 時顯示錯誤", () => {
    const longItem = "a".repeat(25);
    renderDI({ draftItems: [longItem, "b", "c"] });
    expect(screen.getByTestId("di-error")).toBeInTheDocument();
  });

  it("超過 maxItemLength 時送出按鈕 disabled", () => {
    const longItem = "a".repeat(25);
    renderDI({ draftItems: [longItem, "b", "c"] });
    expect(screen.getByTestId("di-submit-btn")).toBeDisabled();
  });

  it("輸入框 onChange 觸發 onDraftChange", () => {
    const onDraftChange = vi.fn();
    renderDI({ onDraftChange });
    fireEvent.change(screen.getByTestId("di-item-input-0"), { target: { value: "水" } });
    expect(onDraftChange).toHaveBeenCalledWith(0, "水");
  });

  it("全部填寫按送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderDI({ draftItems: ["水", "刀", "打火機"], onSubmit });
    fireEvent.click(screen.getByTestId("di-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});

describe("DesertIsland — 已送出狀態", () => {
  const myEntry = {
    entryId: "e1",
    userId: "u1",
    userName: "Alice",
    items: ["水", "刀", "打火機"],
  };
  const stateWithEntry: DesertIslandState = {
    entries: [myEntry],
    revealed: false,
  };

  it("已送出後顯示 di-submitted-msg", () => {
    renderDI({ state: stateWithEntry });
    expect(screen.getByTestId("di-submitted-msg")).toBeInTheDocument();
  });

  it("已送出後隱藏輸入框", () => {
    renderDI({ state: stateWithEntry });
    expect(screen.queryByTestId("di-item-input-0")).not.toBeInTheDocument();
  });

  it("已送出後仍顯示揭曉按鈕", () => {
    renderDI({ state: stateWithEntry });
    expect(screen.getByTestId("di-reveal-btn")).toBeInTheDocument();
  });
});

describe("DesertIsland — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderDI({ onReveal });
    fireEvent.click(screen.getByTestId("di-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("揭曉後顯示 di-result", () => {
    const revealed: DesertIslandState = { entries: [], revealed: true };
    renderDI({ state: revealed });
    expect(screen.getByTestId("di-result")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    const revealed: DesertIslandState = { entries: [], revealed: true };
    renderDI({ state: revealed });
    expect(screen.queryByTestId("di-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉無人作答顯示 di-empty", () => {
    const revealed: DesertIslandState = { entries: [], revealed: true };
    renderDI({ state: revealed });
    expect(screen.getByTestId("di-empty")).toBeInTheDocument();
  });

  it("揭曉後顯示 entry", () => {
    const state: DesertIslandState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", items: ["水", "刀", "打火機"] }],
      revealed: true,
    };
    renderDI({ state });
    expect(screen.getByTestId("di-entry-e1")).toBeInTheDocument();
  });

  it("揭曉後顯示 entry 的每個 item", () => {
    const state: DesertIslandState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", items: ["水", "刀", "打火機"] }],
      revealed: true,
    };
    renderDI({ state });
    expect(screen.getByTestId("di-entry-item-e1-0")).toHaveTextContent("水");
    expect(screen.getByTestId("di-entry-item-e1-1")).toHaveTextContent("刀");
    expect(screen.getByTestId("di-entry-item-e1-2")).toHaveTextContent("打火機");
  });

  it("showAuthor=true 顯示作者名字", () => {
    const state: DesertIslandState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", items: ["水"] }],
      revealed: true,
    };
    renderDI({ state });
    expect(screen.getByTestId("di-entry-e1")).toHaveTextContent("Alice");
  });

  it("showAuthor=false 不顯示名字", () => {
    const cfg: DesertIslandConfig = { ...config, showAuthor: false };
    const state: DesertIslandState = {
      entries: [{ entryId: "e1", userId: "u1", userName: "Alice", items: ["水"] }],
      revealed: true,
    };
    renderDI({ config: cfg, state });
    expect(screen.getByTestId("di-entry-e1")).not.toHaveTextContent("Alice");
  });

  it("計數反映真實人數", () => {
    const state: DesertIslandState = {
      entries: [
        { entryId: "e1", userId: "u1", userName: "Alice", items: ["水"] },
        { entryId: "e2", userId: "u2", userName: "Bob", items: ["火"] },
      ],
      revealed: false,
    };
    renderDI({ state });
    expect(screen.getByTestId("di-count")).toHaveTextContent("2");
  });
});
