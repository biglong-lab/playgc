import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import PointsAuction, {
  PointsAuctionConfig,
  PointsAuctionState,
  BidRecord,
} from "./PointsAuction";

const DEFAULT_CONFIG: PointsAuctionConfig = {
  title: "虛擬競標",
  items: [],
  startingCoins: 100,
};

const DEFAULT_STATE: PointsAuctionState = {
  bids: [],
  currentItemIndex: 0,
  phase: "bidding",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): PointsAuctionConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "startingCoins" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("startingCoins" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        items: (src.items as PointsAuctionConfig["items"]) ?? DEFAULT_CONFIG.items,
        startingCoins: (src.startingCoins as number) ?? DEFAULT_CONFIG.startingCoins,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function PointsAuctionPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<PointsAuctionState>({
    gameId,
    sessionId,
    pageId,
    type: "points_auction",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleBid(itemId: string, amount: number) {
    const already = state.bids.find(
      (b) => b.userId === myUserId && b.itemId === itemId,
    );
    if (already) return;
    const newBid: BidRecord = {
      bidId: `${myUserId}-${itemId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      itemId,
      amount,
    };
    updateState({ ...state, bids: [...state.bids, newBid] });
  }

  function handleAdvance() {
    const nextIdx = state.currentItemIndex + 1;
    if (nextIdx >= config.items.length) {
      updateState({ ...state, phase: "result" });
    } else {
      updateState({ ...state, currentItemIndex: nextIdx });
    }
  }

  return (
    <PointsAuction
      config={config}
      state={state}
      myUserId={myUserId}
      onBid={handleBid}
      onAdvance={handleAdvance}
    />
  );
}
