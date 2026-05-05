import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PointsAuction, {
  PointsAuctionConfig,
  PointsAuctionState,
  BidRecord,
  AuctionItem,
} from "../PointsAuction";

const items: AuctionItem[] = [
  { itemId: "i1", label: "創意獎", description: "最具創意的團隊獎" },
  { itemId: "i2", label: "協作獎", description: "最佳協作表現" },
  { itemId: "i3", label: "活力獎", description: "最有活力的成員" },
];

const baseConfig: PointsAuctionConfig = {
  title: "虛擬競標測試",
  items,
  startingCoins: 100,
};

const biddingState: PointsAuctionState = {
  bids: [],
  currentItemIndex: 0,
  phase: "bidding",
};

const bids: BidRecord[] = [
  { bidId: "b1", userId: "u1", userName: "Alice", itemId: "i1", amount: 40 },
  { bidId: "b2", userId: "u2", userName: "Bob", itemId: "i1", amount: 30 },
  { bidId: "b3", userId: "u1", userName: "Alice", itemId: "i2", amount: 20 },
];

const resultState: PointsAuctionState = {
  bids,
  currentItemIndex: 2,
  phase: "result",
};

function renderPa(overrides: Partial<Parameters<typeof PointsAuction>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: biddingState,
    myUserId: "u3",
    onBid: vi.fn(),
    onAdvance: vi.fn(),
    ...overrides,
  };
  return { ...render(<PointsAuction {...props} />), props };
}

describe("PointsAuction — 基本渲染", () => {
  it("顯示標題", () => {
    renderPa();
    expect(screen.getByTestId("pa-title")).toHaveTextContent("虛擬競標測試");
  });

  it("顯示剩餘代幣", () => {
    renderPa();
    expect(screen.getByTestId("pa-remaining")).toHaveTextContent("100");
  });

  it("顯示當前標的", () => {
    renderPa();
    expect(screen.getByTestId("pa-current-item")).toHaveTextContent("創意獎");
  });

  it("顯示進度（標的 1/3）", () => {
    renderPa();
    expect(screen.getByTestId("pa-phase")).toHaveTextContent("1 / 3");
  });

  it("顯示已出價人數", () => {
    renderPa();
    expect(screen.getByTestId("pa-bid-count")).toBeInTheDocument();
  });
});

describe("PointsAuction — 出價互動", () => {
  it("空白時出價鈕 disabled", () => {
    renderPa();
    expect(screen.getByTestId("pa-bid-btn")).toBeDisabled();
  });

  it("有效金額時出價鈕可點", () => {
    renderPa();
    fireEvent.change(screen.getByTestId("pa-bid-input"), {
      target: { value: "30" },
    });
    expect(screen.getByTestId("pa-bid-btn")).not.toBeDisabled();
  });

  it("點出價呼叫 onBid", () => {
    const onBid = vi.fn();
    renderPa({ onBid });
    fireEvent.change(screen.getByTestId("pa-bid-input"), {
      target: { value: "25" },
    });
    fireEvent.click(screen.getByTestId("pa-bid-btn"));
    expect(onBid).toHaveBeenCalledWith("i1", 25);
  });

  it("已出價後顯示 pa-my-bid", () => {
    const myBid: BidRecord = {
      bidId: "b99",
      userId: "u3",
      userName: "Carol",
      itemId: "i1",
      amount: 50,
    };
    renderPa({
      state: { bids: [myBid], currentItemIndex: 0, phase: "bidding" },
      myUserId: "u3",
    });
    expect(screen.getByTestId("pa-my-bid")).toHaveTextContent("50");
  });

  it("已出價後不顯示出價輸入框", () => {
    const myBid: BidRecord = {
      bidId: "b99",
      userId: "u3",
      userName: "Carol",
      itemId: "i1",
      amount: 50,
    };
    renderPa({
      state: { bids: [myBid], currentItemIndex: 0, phase: "bidding" },
      myUserId: "u3",
    });
    expect(screen.queryByTestId("pa-bid-input")).not.toBeInTheDocument();
  });

  it("已花費的代幣從剩餘中扣除", () => {
    const myBid: BidRecord = {
      bidId: "b99",
      userId: "u3",
      userName: "Carol",
      itemId: "i1",
      amount: 60,
    };
    renderPa({
      state: { bids: [myBid], currentItemIndex: 1, phase: "bidding" },
      myUserId: "u3",
    });
    expect(screen.getByTestId("pa-remaining")).toHaveTextContent("40");
  });

  it("點下一標呼叫 onAdvance", () => {
    const onAdvance = vi.fn();
    renderPa({ onAdvance });
    fireEvent.click(screen.getByTestId("pa-advance-btn"));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  it("最後一標按鈕顯示結算", () => {
    renderPa({
      state: { bids: [], currentItemIndex: 2, phase: "bidding" },
    });
    expect(screen.getByTestId("pa-advance-btn")).toHaveTextContent("結算");
  });
});

describe("PointsAuction — 結果顯示", () => {
  it("結果階段顯示 pa-result", () => {
    renderPa({ state: resultState });
    expect(screen.getByTestId("pa-result")).toBeInTheDocument();
  });

  it("每個標的都顯示結果", () => {
    renderPa({ state: resultState });
    expect(screen.getByTestId("pa-item-result-i1")).toBeInTheDocument();
    expect(screen.getByTestId("pa-item-result-i2")).toBeInTheDocument();
    expect(screen.getByTestId("pa-item-result-i3")).toBeInTheDocument();
  });

  it("i1 最高出價者是 Alice（40 > 30）", () => {
    renderPa({ state: resultState });
    expect(screen.getByTestId("pa-winner-i1")).toHaveTextContent("Alice");
  });

  it("無項目時顯示 pa-empty", () => {
    renderPa({
      config: { ...baseConfig, items: [] },
      state: { bids: [], currentItemIndex: 0, phase: "result" },
    });
    expect(screen.getByTestId("pa-empty")).toBeInTheDocument();
  });
});
