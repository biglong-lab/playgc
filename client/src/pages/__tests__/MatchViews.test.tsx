// 🏁 賽事大廳視圖（2026-09-23 P1 改寫）
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  BrowseMatchesView,
  WaitingView,
  PlayingView,
  FinishedView,
  CancelledView,
} from "../match-lobby/MatchViews";
import type { MatchDetail } from "@/lib/match-types";
import type { Game } from "@shared/schema";

vi.mock("framer-motion", () => {
  const strip = (tag: string) => ({ children, ...props }: Record<string, unknown>) => {
    const { variants: _v, initial: _i, animate: _a, exit: _e, transition: _t, ...rest } = props;
    const Tag = tag as "div";
    return <Tag {...rest}>{children as React.ReactNode}</Tag>;
  };
  return {
    motion: { div: strip("div"), p: strip("p"), h1: strip("h1") },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});
vi.mock("@/components/match/LiveRanking", () => ({
  default: ({ ranking, showScore }: { ranking: readonly unknown[]; showScore?: boolean }) => (
    <div data-testid="live-ranking">人數 {ranking.length} 分數{showScore === false ? "隱藏" : "顯示"}</div>
  ),
}));
vi.mock("@/components/match/MatchTimer", () => ({
  default: ({ mode, seconds }: { mode: string; seconds: number }) => <div data-testid="match-timer">{mode}:{seconds}</div>,
}));
vi.mock("@/components/game/SaveRecordCard", () => ({ default: () => null }));

function game(overrides: Partial<Game> = {}): Game {
  return { id: "g1", title: "金門大賽", gameMode: "competitive", matchConfig: null, ...overrides } as Game;
}

function match(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    id: "m1", gameId: "g1", matchMode: "competitive", status: "waiting", accessCode: "ABCD23", creatorId: "u1",
    startedAt: null, finishedAt: null, minParticipants: 2, maxParticipants: 10, countdownSeconds: 3,
    timeLimitSeconds: null, relayLegs: [], teamTotal: null,
    ranking: [{ participantId: "p1", userId: "u1", displayName: "小明", score: 0, rank: 1, completed: false, relaySegment: null, relayStatus: null }],
    ...overrides,
  };
}

const noop = () => undefined;

describe("BrowseMatchesView", () => {
  const base = { matches: [], onCreateMatch: noop, onJoinMatch: noop, onJoinByCode: noop, onGoBack: noop, isCreating: false, isJoining: false };

  it("建立賽事 / 邀請碼加入（自動轉大寫）", () => {
    const onCreate = vi.fn();
    const onCode = vi.fn();
    render(<BrowseMatchesView {...base} game={game()} onCreateMatch={onCreate} onJoinByCode={onCode} />);
    fireEvent.click(screen.getByTestId("button-create-match"));
    expect(onCreate).toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("input-match-code"), { target: { value: "abcd23" } });
    fireEvent.click(screen.getByTestId("button-join-by-code"));
    expect(onCode).toHaveBeenCalledWith("ABCD23");
  });

  it("列出等待中的賽事與人數，點加入帶賽事 ID", () => {
    const onJoin = vi.fn();
    render(
      <BrowseMatchesView {...base} game={game()} onJoinMatch={onJoin}
        matches={[{ id: "m9", accessCode: "XYZ789", maxTeams: 8, participantCount: 3, createdAt: "" }]} />,
    );
    expect(screen.getByText("3/8 人")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-join-match-m9"));
    expect(onJoin).toHaveBeenCalledWith("m9");
  });

  it("接力遊戲沒設分段 → 提示且不能建立", () => {
    render(<BrowseMatchesView {...base} game={game({ gameMode: "relay" })} />);
    expect(screen.getByText(/還沒設定每一棒的頁數/)).toBeInTheDocument();
    expect(screen.getByTestId("button-create-match")).toBeDisabled();
  });
});

describe("WaitingView", () => {
  const base = { userId: "u1", inviteUrl: "https://x/match/g1?code=ABCD23", onStart: noop, isStarting: false, onLeave: noop, isLeaving: false };

  it("房主人數不足 → 開始鈕停用並說明還差幾人", () => {
    render(<WaitingView {...base} match={match()} isCreator />);
    expect(screen.getByTestId("text-match-code")).toHaveTextContent("ABCD23");
    expect(screen.getByTestId("button-start-match")).toBeDisabled();
    expect(screen.getByText("至少需要 2 人才能開始（還差 1 人）")).toBeInTheDocument();
  });

  it("接力人數不等於棒數 → 顯示需要剛好幾人", () => {
    const legs = [{ segment: 1, fromPage: 1, toPage: 2 }, { segment: 2, fromPage: 3, toPage: 4 }];
    render(<WaitingView {...base} match={match({ matchMode: "relay", relayLegs: legs })} isCreator />);
    expect(screen.getByText("接力需要剛好 2 人（每人一棒），目前 1 人")).toBeInTheDocument();
  });

  it("人數夠 → 可以開始；非房主只看到等待提示", () => {
    const two = match({
      ranking: [
        ...match().ranking,
        { participantId: "p2", userId: "u2", displayName: "小華", score: 0, rank: 2, completed: false, relaySegment: null, relayStatus: null },
      ],
    });
    const onStart = vi.fn();
    const { unmount } = render(<WaitingView {...base} match={two} isCreator onStart={onStart} />);
    fireEvent.click(screen.getByTestId("button-start-match"));
    expect(onStart).toHaveBeenCalled();
    unmount();
    render(<WaitingView {...base} match={two} isCreator={false} userId="u2" />);
    expect(screen.queryByTestId("button-start-match")).toBeNull();
    expect(screen.getByText("等待房主開始賽事…")).toBeInTheDocument();
  });

  it("房主取消賽事要先確認；一般參賽者直接退出", () => {
    const onLeave = vi.fn();
    const { unmount } = render(<WaitingView {...base} match={match()} isCreator onLeave={onLeave} />);
    fireEvent.click(screen.getByTestId("button-leave-match"));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-confirm-cancel-match"));
    expect(onLeave).toHaveBeenCalledTimes(1);
    unmount();
    render(<WaitingView {...base} match={match()} isCreator={false} onLeave={onLeave} />);
    fireEvent.click(screen.getByTestId("button-leave-match"));
    expect(onLeave).toHaveBeenCalledTimes(2);
  });
});

describe("PlayingView / FinishedView / CancelledView", () => {
  it("進行中：有時限 → 倒數計時；房主可提前結束（先確認）", () => {
    const onFinish = vi.fn();
    const startedAt = new Date(Date.now() - 60_000).toISOString();
    render(<PlayingView match={match({ status: "playing", startedAt, timeLimitSeconds: 300 })} userId="u1" isCreator showScore onFinish={onFinish} />);
    expect(screen.getByTestId("match-timer").textContent).toMatch(/^countdown:2(39|40)$/);
    fireEvent.click(screen.getByTestId("button-finish-match"));
    fireEvent.click(screen.getByTestId("button-confirm-finish-match"));
    expect(onFinish).toHaveBeenCalled();
  });

  it("結算：競賽顯示我的名次；不計分遊戲隱藏分數", () => {
    render(<FinishedView match={match({ status: "finished" })} userId="u1" showScore={false} onPlayAnother={noop} onGoBack={noop} />);
    expect(screen.getByTestId("text-my-rank")).toHaveTextContent("你是第 1 名");
    expect(screen.getByTestId("live-ranking")).toHaveTextContent("分數隱藏");
  });

  it("結算：接力顯示全隊總分；再來一場", () => {
    const onAnother = vi.fn();
    render(
      <FinishedView match={match({ status: "finished", matchMode: "relay", teamTotal: 90 })} userId="u1" showScore
        onPlayAnother={onAnother} onGoBack={noop} />,
    );
    expect(screen.getByTestId("text-relay-total")).toHaveTextContent("全隊總分 90");
    fireEvent.click(screen.getByTestId("button-play-another-match"));
    expect(onAnother).toHaveBeenCalled();
  });

  it("取消：說明房主取消、可回列表", () => {
    const onBack = vi.fn();
    render(<CancelledView onBack={onBack} />);
    fireEvent.click(screen.getByText("回到賽事列表"));
    expect(onBack).toHaveBeenCalled();
  });
});
