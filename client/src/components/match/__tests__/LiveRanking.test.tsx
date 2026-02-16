import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveRanking from "../LiveRanking";

// Mock framer-motion 避免動畫影響測試
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { variants: _v, initial: _i, animate: _a, exit: _e, layout: _l, ...rest } = props;
      return <div {...rest}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const makeEntry = (overrides: Partial<{
  userId: string; userName: string; score: number; rank: number;
  relaySegment: number | null; relayStatus: string | null;
}> = {}) => ({
  userId: overrides.userId ?? "u1",
  userName: overrides.userName ?? "玩家1",
  score: overrides.score ?? 100,
  rank: overrides.rank ?? 1,
  relaySegment: overrides.relaySegment ?? null,
  relayStatus: overrides.relayStatus ?? null,
});

describe("LiveRanking", () => {
  it("空排名顯示提示文字", () => {
    render(<LiveRanking ranking={[]} />);
    expect(screen.getByText("尚無參與者")).toBeInTheDocument();
  });

  it("渲染排名列表", () => {
    const ranking = [
      makeEntry({ userId: "a", userName: "Alice", rank: 1, score: 200 }),
      makeEntry({ userId: "b", userName: "Bob", rank: 2, score: 150 }),
    ];
    render(<LiveRanking ranking={ranking} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
  });

  it("當前玩家高亮並顯示 (你)", () => {
    const ranking = [
      makeEntry({ userId: "me", userName: "我", rank: 1, score: 300 }),
      makeEntry({ userId: "other", userName: "對手", rank: 2, score: 100 }),
    ];
    render(<LiveRanking ranking={ranking} currentUserId="me" />);
    expect(screen.getByText(/我/)).toBeInTheDocument();
    expect(screen.getByText(/(你)/)).toBeInTheDocument();
  });

  it("第 1 名顯示 Trophy icon (svg)", () => {
    const { container } = render(
      <LiveRanking ranking={[makeEntry({ rank: 1 })]} />,
    );
    // Trophy/Medal/Award 都是 lucide svg
    const svgs = container.querySelectorAll("svg");
    // 至少有標題 Trophy + 排名 Trophy + User icon
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it("排名 >=4 顯示數字而非 icon", () => {
    render(<LiveRanking ranking={[makeEntry({ rank: 4, userId: "u4" })]} />);
    // 第 4 名用數字 span
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("無 userName 時顯示 userId 前 8 碼", () => {
    const entry = {
      userId: "abcdef1234567890",
      score: 50,
      rank: 1,
      relaySegment: null,
      relayStatus: null,
    };
    render(<LiveRanking ranking={[entry]} />);
    expect(screen.getByText("abcdef12")).toBeInTheDocument();
  });

  // --- showRelay ---
  it("showRelay=true 且 relayStatus=active 顯示 badge", () => {
    const ranking = [makeEntry({ relayStatus: "active" })];
    render(<LiveRanking ranking={ranking} showRelay />);
    expect(screen.getByText("進行中")).toBeInTheDocument();
  });

  it("showRelay=true 且 relayStatus=completed 顯示已完成", () => {
    const ranking = [makeEntry({ relayStatus: "completed" })];
    render(<LiveRanking ranking={ranking} showRelay />);
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("showRelay=true 且 relayStatus=pending 顯示待命", () => {
    const ranking = [makeEntry({ relayStatus: "pending" })];
    render(<LiveRanking ranking={ranking} showRelay />);
    expect(screen.getByText("待命")).toBeInTheDocument();
  });

  it("showRelay=false 不顯示 relay badge", () => {
    const ranking = [makeEntry({ relayStatus: "active" })];
    render(<LiveRanking ranking={ranking} showRelay={false} />);
    expect(screen.queryByText("進行中")).not.toBeInTheDocument();
  });

  it("標題顯示即時排名", () => {
    render(<LiveRanking ranking={[]} />);
    expect(screen.getByText("即時排名")).toBeInTheDocument();
  });
});
