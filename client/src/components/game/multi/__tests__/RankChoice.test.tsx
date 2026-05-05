import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RankChoice, {
  RankChoiceConfig,
  RankChoiceState,
  PlayerRanking,
} from "../RankChoice";

const ITEMS = [
  { itemId: "i1", label: "工作生活平衡" },
  { itemId: "i2", label: "薪資福利" },
  { itemId: "i3", label: "發展機會" },
];

const BASE_CONFIG: RankChoiceConfig = {
  title: "優先排序測試",
  question: "你最重視哪些工作因素？",
  items: ITEMS,
};

const EMPTY_STATE: RankChoiceState = {
  rankings: [],
  revealed: false,
};

function makeRanking(userId: string, userName: string, order: string[]): PlayerRanking {
  return { rankingId: `${userId}-1`, userId, userName, order };
}

const WITH_RANKINGS: RankChoiceState = {
  rankings: [
    makeRanking("u1", "Alice", ["i1", "i2", "i3"]),
    makeRanking("u2", "Bob", ["i2", "i1", "i3"]),
    makeRanking("u3", "Carol", ["i1", "i3", "i2"]),
  ],
  revealed: false,
};

const REVEALED_STATE: RankChoiceState = {
  ...WITH_RANKINGS,
  revealed: true,
};

function setup(
  state: RankChoiceState = EMPTY_STATE,
  config: RankChoiceConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onSubmit = vi.fn();
  const onReveal = vi.fn();
  render(
    <RankChoice
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={onSubmit}
      onReveal={onReveal}
    />
  );
  return { onSubmit, onReveal };
}

describe("RankChoice — 標題與問題", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("rc-title")).toHaveTextContent("優先排序測試");
  });

  it("顯示問題", () => {
    setup();
    expect(screen.getByTestId("rc-question")).toHaveTextContent("你最重視哪些工作因素？");
  });

  it("顯示所有排序項目", () => {
    setup();
    expect(screen.getByTestId("rc-item-i1")).toBeInTheDocument();
    expect(screen.getByTestId("rc-item-i2")).toBeInTheDocument();
    expect(screen.getByTestId("rc-item-i3")).toBeInTheDocument();
  });

  it("空項目顯示空提示", () => {
    const emptyConfig: RankChoiceConfig = { ...BASE_CONFIG, items: [] };
    setup(EMPTY_STATE, emptyConfig);
    expect(screen.getByTestId("rc-empty")).toBeInTheDocument();
  });
});

describe("RankChoice — 排序操作", () => {
  it("第一個項目上移按鈕 disabled", () => {
    setup();
    expect(screen.getByTestId("rc-up-i1")).toBeDisabled();
  });

  it("最後一個項目下移按鈕 disabled", () => {
    setup();
    expect(screen.getByTestId("rc-down-i3")).toBeDisabled();
  });

  it("點擊上移第二個項目移動位置", () => {
    setup();
    fireEvent.click(screen.getByTestId("rc-up-i2"));
    // After moving i2 up, order should be i2, i1, i3
    const items = screen.getAllByTestId(/^rc-item-/);
    expect(items[0]).toHaveAttribute("data-testid", "rc-item-i2");
    expect(items[1]).toHaveAttribute("data-testid", "rc-item-i1");
  });

  it("點擊下移第一個項目移動位置", () => {
    setup();
    fireEvent.click(screen.getByTestId("rc-down-i1"));
    // After moving i1 down, order should be i2, i1, i3
    const items = screen.getAllByTestId(/^rc-item-/);
    expect(items[0]).toHaveAttribute("data-testid", "rc-item-i2");
    expect(items[1]).toHaveAttribute("data-testid", "rc-item-i1");
  });

  it("點擊提交呼叫 onSubmit", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByTestId("rc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("提交帶正確順序陣列", () => {
    const { onSubmit } = setup();
    fireEvent.click(screen.getByTestId("rc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(["i1", "i2", "i3"]);
  });
});

describe("RankChoice — 已提交狀態", () => {
  it("顯示已提交訊息", () => {
    setup(WITH_RANKINGS);
    expect(screen.getByTestId("rc-submitted")).toBeInTheDocument();
  });

  it("顯示提交人數", () => {
    setup(WITH_RANKINGS);
    expect(screen.getByTestId("rc-count")).toHaveTextContent("3");
  });
});

describe("RankChoice — 公布結果", () => {
  it("顯示公布按鈕", () => {
    setup(WITH_RANKINGS);
    expect(screen.getByTestId("rc-reveal-btn")).toBeInTheDocument();
  });

  it("點擊公布呼叫 onReveal", () => {
    const { onReveal } = setup(WITH_RANKINGS);
    fireEvent.click(screen.getByTestId("rc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("公布後顯示冠軍", () => {
    setup(REVEALED_STATE);
    // i1 gets borda: 2+1+2=5 points; i2 gets 1+2+0=3; i3 gets 0+0+1=1
    expect(screen.getByTestId("rc-winner")).toHaveTextContent("工作生活平衡");
  });

  it("公布後顯示各項目分數", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("rc-result-i1")).toBeInTheDocument();
    expect(screen.getByTestId("rc-score-i1")).toHaveTextContent("5 分");
  });

  it("無人提交時顯示空狀態", () => {
    const emptyRevealed: RankChoiceState = { rankings: [], revealed: true };
    setup(emptyRevealed);
    expect(screen.getByTestId("rc-result-empty")).toBeInTheDocument();
  });
});
