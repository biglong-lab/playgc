import { useState } from "react";

export interface AuctionItem extends Record<string, unknown> {
  itemId: string;
  label: string;
  description: string;
}

export interface BidRecord extends Record<string, unknown> {
  bidId: string;
  userId: string;
  userName: string;
  itemId: string;
  amount: number;
}

export interface PointsAuctionConfig extends Record<string, unknown> {
  title: string;
  items: AuctionItem[];
  startingCoins: number;
}

export interface PointsAuctionState extends Record<string, unknown> {
  bids: BidRecord[];
  currentItemIndex: number;
  phase: "bidding" | "result";
}

function spentCoins(bids: BidRecord[], userId: string): number {
  return bids
    .filter((b) => b.userId === userId)
    .reduce((sum, b) => sum + b.amount, 0);
}

function highestBidForItem(bids: BidRecord[], itemId: string): BidRecord | null {
  const forItem = bids.filter((b) => b.itemId === itemId);
  if (forItem.length === 0) return null;
  return forItem.reduce((top, b) => (b.amount > top.amount ? b : top), forItem[0]);
}

const DEFAULT_CONFIG: PointsAuctionConfig = {
  title: "虛擬競標",
  items: [],
  startingCoins: 100,
};

interface Props {
  config: PointsAuctionConfig;
  state: PointsAuctionState;
  myUserId: string;
  onBid: (itemId: string, amount: number) => void;
  onAdvance: () => void;
}

export default function PointsAuction({
  config,
  state,
  myUserId,
  onBid,
  onAdvance,
}: Props) {
  const [bidInput, setBidInput] = useState("");

  const { items, startingCoins } = config || DEFAULT_CONFIG;
  const { bids, currentItemIndex, phase } = state;

  const remaining = startingCoins - spentCoins(bids, myUserId);
  const currentItem = items[currentItemIndex] ?? null;

  const myBidOnCurrent = currentItem
    ? bids.find((b) => b.userId === myUserId && b.itemId === currentItem.itemId)
    : null;

  const bidNum = parseInt(bidInput, 10);
  const canBid =
    !myBidOnCurrent &&
    currentItem !== null &&
    phase === "bidding" &&
    !isNaN(bidNum) &&
    bidNum > 0 &&
    bidNum <= remaining;

  function handleBid() {
    if (!canBid || !currentItem) return;
    onBid(currentItem.itemId, bidNum);
    setBidInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="pa-title" className="text-xl font-bold text-center">
        {config.title}
      </h2>

      <div className="flex justify-between items-center bg-amber-50 rounded-xl px-4 py-2 border border-amber-200">
        <span className="text-sm text-gray-600">剩餘代幣</span>
        <span data-testid="pa-remaining" className="text-lg font-bold text-amber-700">
          🪙 {remaining}
        </span>
      </div>

      <div data-testid="pa-phase" className="text-center text-xs font-semibold text-violet-600">
        {phase === "bidding"
          ? `標的 ${currentItemIndex + 1} / ${items.length}`
          : "🏆 競標結果"}
      </div>

      {phase === "bidding" && currentItem && (
        <div className="space-y-3">
          <div
            data-testid="pa-current-item"
            className="p-4 bg-violet-50 rounded-xl border border-violet-200 text-center space-y-1"
          >
            <p className="font-bold text-violet-800 text-base">{currentItem.label}</p>
            <p className="text-sm text-gray-600">{currentItem.description}</p>
          </div>

          {!myBidOnCurrent ? (
            <div className="flex gap-2">
              <input
                data-testid="pa-bid-input"
                type="number"
                min={1}
                max={remaining}
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                placeholder="輸入出價..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              <button
                data-testid="pa-bid-btn"
                onClick={handleBid}
                disabled={!canBid}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40"
              >
                出價
              </button>
            </div>
          ) : (
            <p data-testid="pa-my-bid" className="text-center text-sm text-green-600 font-semibold">
              ✅ 已出價 🪙 {myBidOnCurrent.amount}
            </p>
          )}

          <div className="text-center">
            <span data-testid="pa-bid-count" className="text-xs text-gray-400">
              {bids.filter((b) => b.itemId === currentItem.itemId).length} 人已出價
            </span>
          </div>

          <div className="text-center">
            <button
              data-testid="pa-advance-btn"
              onClick={onAdvance}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              {currentItemIndex + 1 < items.length ? "下一標" : "結算競標"}
            </button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <div data-testid="pa-result" className="space-y-3">
          {items.length === 0 ? (
            <div data-testid="pa-empty" className="text-center text-gray-400 py-8">
              無競標項目
            </div>
          ) : (
            items.map((item) => {
              const winner = highestBidForItem(bids, item.itemId);
              return (
                <div
                  key={item.itemId}
                  data-testid={`pa-item-result-${item.itemId}`}
                  className="p-3 bg-white border border-gray-200 rounded-xl space-y-1"
                >
                  <p className="font-semibold text-sm text-gray-800">{item.label}</p>
                  {winner ? (
                    <p className="text-sm text-amber-700">
                      🏆{" "}
                      <span data-testid={`pa-winner-${item.itemId}`}>
                        {winner.userName}
                      </span>{" "}
                      — 🪙 {winner.amount}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400">無人競標</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
