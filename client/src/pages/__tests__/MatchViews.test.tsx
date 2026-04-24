import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  LoadingView,
  BrowseMatchesView,
  WaitingView,
  CountdownView,
  PlayingView,
  FinishedView,
} from "../match-lobby/MatchViews";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { variants: _v, initial: _i, animate: _a, exit: _e, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
    p: ({ children, ...props }: Record<string, unknown>) => {
      const { variants: _v, initial: _i, animate: _a, exit: _e, ...rest } = props;
      return <p {...rest}>{children as React.ReactNode}</p>;
    },
    h1: ({ children, ...props }: Record<string, unknown>) => {
      const { variants: _v, initial: _i, animate: _a, transition: _t, ...rest } = props;
      return <h1 {...rest}>{children as React.ReactNode}</h1>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock 子元件
vi.mock("@/components/match/LiveRanking", () => ({
  default: ({ ranking, currentUserId }: { ranking: readonly unknown[]; currentUserId?: string }) => (
    <div data-testid="live-ranking">
      排名人數: {ranking.length}, uid: {currentUserId ?? "none"}
    </div>
  ),
}));

vi.mock("@/components/match/MatchTimer", () => ({
  default: ({ mode, seconds }: { mode: string; seconds: number }) => (
    <div data-testid="match-timer">
      {mode}: {seconds}
    </div>
  ),
}));

// ============================================================================
// LoadingView
// ============================================================================
describe("LoadingView", () => {
  it("渲染 spinner svg", () => {
    const { container } = render(<LoadingView />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});

// ============================================================================
// BrowseMatchesView
// ============================================================================
describe("BrowseMatchesView", () => {
  const defaultProps = {
    game: { id: 1, title: "測試遊戲", gameMode: "competitive" } as Record<string, unknown>,
    matches: [] as Record<string, unknown>[],
    onCreateMatch: vi.fn(),
    onJoinMatch: vi.fn(),
    onGoBack: vi.fn(),
    isCreating: false,
    isJoining: false,
  };

  it("顯示遊戲標題", () => {
    render(<BrowseMatchesView {...defaultProps} />);
    expect(screen.getByText("測試遊戲")).toBeInTheDocument();
  });

  it("顯示建立新對戰按鈕", () => {
    render(<BrowseMatchesView {...defaultProps} />);
    expect(screen.getByText("建立新對戰")).toBeInTheDocument();
  });

  it("點擊建立按鈕觸發 onCreateMatch", () => {
    const onCreate = vi.fn();
    render(<BrowseMatchesView {...defaultProps} onCreateMatch={onCreate} />);
    fireEvent.click(screen.getByText("建立新對戰"));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("空列表顯示提示訊息", () => {
    render(<BrowseMatchesView {...defaultProps} />);
    expect(screen.getByText("目前沒有等待中的對戰，建立一個吧！")).toBeInTheDocument();
  });

  it("有等待中的對戰顯示列表", () => {
    const matches = [
      { id: "m1", accessCode: "ABC123", status: "waiting", participants: ["u1"], maxTeams: 4 },
    ];
    render(<BrowseMatchesView {...defaultProps} matches={matches} />);
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("加入")).toBeInTheDocument();
  });

  it("點擊加入按鈕觸發 onJoinMatch", () => {
    const onJoin = vi.fn();
    const matches = [
      { id: "m1", accessCode: "XYZ", status: "waiting", participants: [], maxTeams: 4 },
    ];
    render(<BrowseMatchesView {...defaultProps} matches={matches} onJoinMatch={onJoin} />);
    fireEvent.click(screen.getByText("加入"));
    expect(onJoin).toHaveBeenCalledWith("m1");
  });

  it("點擊返回按鈕觸發 onGoBack", () => {
    const onGoBack = vi.fn();
    render(<BrowseMatchesView {...defaultProps} onGoBack={onGoBack} />);
    // 返回按鈕是第一個 button (ghost icon)
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });

  it("relay 模式顯示接力模式文字", () => {
    const game = { id: 1, title: "接力遊戲", gameMode: "relay" } as Record<string, unknown>;
    render(<BrowseMatchesView {...defaultProps} game={game} />);
    expect(screen.getByText("接力模式")).toBeInTheDocument();
  });
});

// ============================================================================
// WaitingView
// ============================================================================
describe("WaitingView", () => {
  const defaultProps = {
    match: { accessCode: "WAIT99", participants: ["u1", "u2"] } as Record<string, unknown>,
    isCreator: true,
    onStart: vi.fn(),
    isStarting: false,
    ranking: [],
    userId: "u1",
  };

  it("顯示存取碼", () => {
    render(<WaitingView {...defaultProps} />);
    expect(screen.getByText("WAIT99")).toBeInTheDocument();
  });

  it("顯示參與人數", () => {
    render(<WaitingView {...defaultProps} />);
    // 新 UX：用 Badge 顯示 "2 人"，而非「2 人已加入」純文字
    expect(screen.getByText("2 人")).toBeInTheDocument();
  });

  it("創建者可見開始按鈕", () => {
    render(<WaitingView {...defaultProps} />);
    // 用 role=button 精確查詢，避免抓到 fallback 文字
    expect(screen.getByRole("button", { name: /開始對戰/ })).toBeInTheDocument();
  });

  it("非創建者不顯示開始按鈕", () => {
    render(<WaitingView {...defaultProps} isCreator={false} />);
    // 用 role=button 精確查詢
    expect(screen.queryByRole("button", { name: /開始對戰/ })).not.toBeInTheDocument();
  });

  it("只有 1 人時開始按鈕 disabled", () => {
    const match = { accessCode: "X", participants: ["u1"] } as Record<string, unknown>;
    render(<WaitingView {...defaultProps} match={match} />);
    const btn = screen.getByRole("button", { name: /開始對戰/ });
    expect(btn).toBeDisabled();
  });

  // 新 UX：複製/分享 + 參賽者列表 + 房主標記
  it("顯示複製按鈕與分享按鈕", () => {
    render(<WaitingView {...defaultProps} />);
    expect(screen.getByTestId("button-copy-match-code")).toBeInTheDocument();
    expect(screen.getByTestId("button-share-match-code")).toBeInTheDocument();
  });

  it("非房主顯示等待提示", () => {
    render(<WaitingView {...defaultProps} isCreator={false} />);
    expect(screen.getByText(/等待房主開始對戰/)).toBeInTheDocument();
  });

  it("人數不足時顯示「還需 N 人」說明", () => {
    const match = { accessCode: "X", participants: ["u1"] } as Record<string, unknown>;
    render(<WaitingView {...defaultProps} match={match} />);
    expect(screen.getByText(/還需 1 人/)).toBeInTheDocument();
  });

  it("顯示參賽者列表（含 displayName）", () => {
    const match = {
      accessCode: "X",
      participants: [
        { userId: "u1", displayName: "小明" },
        { userId: "u2", displayName: "小華" },
      ],
    } as Record<string, unknown>;
    render(<WaitingView {...defaultProps} match={match} />);
    expect(screen.getByText("小明")).toBeInTheDocument();
    expect(screen.getByText("小華")).toBeInTheDocument();
  });

  it("自己的列在會標 「我」 Badge", () => {
    const match = {
      accessCode: "X",
      participants: [{ userId: "u1", displayName: "小明" }],
    } as Record<string, unknown>;
    render(<WaitingView {...defaultProps} match={match} userId="u1" />);
    expect(screen.getByText("我")).toBeInTheDocument();
  });
});

// ============================================================================
// CountdownView
// ============================================================================
describe("CountdownView", () => {
  it("顯示倒數秒數", () => {
    render(<CountdownView seconds={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("顯示準備開始文字", () => {
    render(<CountdownView seconds={5} />);
    expect(screen.getByText("準備開始...")).toBeInTheDocument();
  });
});

// ============================================================================
// PlayingView
// ============================================================================
describe("PlayingView", () => {
  it("顯示對戰進行中標題", () => {
    render(<PlayingView match={{}} ranking={[]} userId="u1" />);
    expect(screen.getByText("對戰進行中")).toBeInTheDocument();
  });

  it("渲染 LiveRanking mock", () => {
    const ranking = [{ userId: "u1", score: 10, rank: 1 }];
    render(<PlayingView match={{}} ranking={ranking} userId="u1" />);
    expect(screen.getByTestId("live-ranking")).toBeInTheDocument();
    expect(screen.getByText(/排名人數: 1/)).toBeInTheDocument();
  });

  it("有 timeLimit 時渲染 countdown 計時器", () => {
    const match = { settings: { timeLimit: 120 } } as Record<string, unknown>;
    render(<PlayingView match={match} ranking={[]} userId="u1" />);
    expect(screen.getByTestId("match-timer")).toHaveTextContent("countdown: 120");
  });

  it("無 timeLimit 時渲染 elapsed 計時器", () => {
    render(<PlayingView match={{}} ranking={[]} userId="u1" />);
    expect(screen.getByTestId("match-timer")).toHaveTextContent("elapsed: 0");
  });
});

// ============================================================================
// FinishedView
// ============================================================================
describe("FinishedView", () => {
  const defaultProps = {
    ranking: [{ userId: "u1", score: 100, rank: 1 }],
    userId: "u1",
    onGoBack: vi.fn(),
  };

  it("顯示對戰結束標題", () => {
    render(<FinishedView {...defaultProps} />);
    expect(screen.getByText("對戰結束！")).toBeInTheDocument();
  });

  it("渲染 LiveRanking", () => {
    render(<FinishedView {...defaultProps} />);
    expect(screen.getByTestId("live-ranking")).toBeInTheDocument();
  });

  it("點擊返回按鈕觸發 onGoBack", () => {
    const onGoBack = vi.fn();
    render(<FinishedView {...defaultProps} onGoBack={onGoBack} />);
    fireEvent.click(screen.getByText("返回遊戲大廳"));
    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
