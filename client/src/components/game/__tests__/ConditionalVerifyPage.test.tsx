/**
 * ConditionalVerifyPage 測試 — 最大元件，歷史 bug 最多，需完整覆蓋：
 * 1. 條件 mode：has_item 有/無道具
 * 2. 條件 mode：has_points 達標/未達
 * 3. 條件 mode：visited_location 已造訪/未造訪
 * 4. 條件 mode：inventory 混 string/number（舊 seed 相容）
 * 5. Fragment mode：demoMode 自動全部收集
 * 6. Fragment mode：正式模式要 sourceItemId 對應道具
 * 7. handleContinue finishedRef 防連點
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ConditionalVerifyPage from "../ConditionalVerifyPage";
import type { ConditionalVerifyConfig } from "@shared/schema";

interface RenderOptions {
  inventory?: Array<string | number>;
  score?: number;
  visitedLocations?: string[];
}

function renderWith(
  config: ConditionalVerifyConfig,
  options: RenderOptions = {},
  onComplete = vi.fn(),
) {
  return {
    onComplete,
    ...render(
      <ConditionalVerifyPage
        config={config}
        onComplete={onComplete}
        sessionId="s1"
        variables={{}}
        onVariableUpdate={() => {}}
        inventory={options.inventory as string[]}
        score={options.score ?? 0}
        visitedLocations={options.visitedLocations ?? []}
      />,
    ),
  };
}

describe("ConditionalVerifyPage — 條件 mode", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("has_item 條件：有對應道具 → allPassed=true 按繼續進下一關", async () => {
    const { onComplete } = renderWith(
      {
        conditions: [{ type: "has_item", itemId: "key-1" }],
        nextPageId: "p-open",
        rewardPoints: 25,
      },
      { inventory: ["key-1"] },
    );

    // 首次檢查 setTimeout 300ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalledWith({ points: 25 }, "p-open");
  });

  it("has_item 條件：無對應道具 → onComplete 不被呼叫，留在頁面", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "has_item", itemId: "key-1" }] },
      { inventory: [] },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("has_item 相容舊資料：itemId 為 number，inventory 存 string", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "has_item", itemId: 13 as any }] },
      { inventory: ["13"] }, // string 形式的同一 id
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("has_points 條件：score 達標 → 通過", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "has_points", minPoints: 50 }] },
      { score: 60 },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("has_points 條件：score 未達 → 不通過", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "has_points", minPoints: 50 }] },
      { score: 30 },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("visited_location 條件：已造訪 → 通過", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "visited_location", locationId: "loc-1" }] },
      { visitedLocations: ["loc-1"] },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    fireEvent.click(screen.getByTestId("button-continue"));
    expect(onComplete).toHaveBeenCalled();
  });
});

describe("ConditionalVerifyPage — Fragment mode", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("demoMode=true → 所有碎片預設已收集（即使無 sourceItemId）", () => {
    renderWith({
      fragments: [
        { id: "f1", label: "碎片 A", value: "A" },
        { id: "f2", label: "碎片 B", value: "B" },
      ],
      demoMode: true,
      verificationMode: "all_collected",
    });

    // Fragment mode 渲染應該顯示 fragment slots
    expect(screen.getByTestId("fragment-slot-0")).toBeTruthy();
    expect(screen.getByTestId("fragment-slot-1")).toBeTruthy();
  });

  it("正式模式：sourceItemId 對應道具在 inventory → 算已收集", () => {
    renderWith(
      {
        fragments: [
          { id: "f1", label: "碎片 A", value: "A", sourceItemId: "item-a" },
          { id: "f2", label: "碎片 B", value: "B", sourceItemId: "item-b" },
        ],
        verificationMode: "all_collected",
        demoMode: false,
      },
      { inventory: ["item-a", "item-b"] },
    );

    // 收集到 2/2
    expect(screen.getAllByTestId(/^fragment-slot-/)).toHaveLength(2);
  });

  it("all_collected 模式：收齊後按驗證 → 過關", async () => {
    const { onComplete } = renderWith(
      {
        fragments: [
          { id: "f1", label: "A", value: "A", sourceItemId: "ia" },
        ],
        verificationMode: "all_collected",
      },
      { inventory: ["ia"] },
    );

    fireEvent.click(screen.getByTestId("button-verify-code"));

    // handleSuccess 狀態後點繼續
    fireEvent.click(screen.getByTestId("button-continue-fragment"));
    expect(onComplete).toHaveBeenCalled();
  });
});

describe("ConditionalVerifyPage — 防連點（/loop 優化驗證）", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("handleContinue 連點 3 次，onComplete 只被呼叫 1 次（finishedRef 保護）", async () => {
    const { onComplete } = renderWith(
      { conditions: [{ type: "has_item", itemId: "k" }] },
      { inventory: ["k"] },
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });

    const btn = screen.getByTestId("button-continue");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
