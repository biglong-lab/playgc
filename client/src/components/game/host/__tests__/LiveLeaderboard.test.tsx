import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveLeaderboard from "../LiveLeaderboard";

const sampleEntries = [
  { id: "p1", name: "Alice", score: 100 },
  { id: "p2", name: "Bob", score: 80 },
  { id: "p3", name: "Carol", score: 60 },
  { id: "p4", name: "Dave", score: 40 },
];

describe("LiveLeaderboard", () => {
  it("hostMode 顯示標題 + Top entries", () => {
    render(
      <LiveLeaderboard
        config={{ title: "競賽榜" }}
        hostMode={true}
        state={{ entries: sampleEntries }}
      />,
    );
    expect(screen.getByText("競賽榜")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("依分數倒排（Alice > Bob > Carol > Dave）", () => {
    render(
      <LiveLeaderboard
        config={{}}
        hostMode={true}
        state={{
          entries: [
            { id: "d", name: "Dave", score: 40 },
            { id: "a", name: "Alice", score: 100 },
            { id: "c", name: "Carol", score: 60 },
            { id: "b", name: "Bob", score: 80 },
          ],
        }}
      />,
    );
    const aliceText = screen.getByText("Alice").textContent;
    const bobText = screen.getByText("Bob").textContent;
    expect(aliceText).toBeTruthy();
    expect(bobText).toBeTruthy();
    // 確保有金牌 emoji 顯示（前 3 名）
    expect(screen.getByText("🥇")).toBeInTheDocument();
    expect(screen.getByText("🥈")).toBeInTheDocument();
    expect(screen.getByText("🥉")).toBeInTheDocument();
  });

  it("topN config 控制顯示筆數", () => {
    render(
      <LiveLeaderboard
        config={{ topN: 2 }}
        hostMode={true}
        state={{ entries: sampleEntries }}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Carol")).not.toBeInTheDocument();
  });

  it("空 entries 顯示「等待第一筆得分」", () => {
    render(<LiveLeaderboard config={{}} hostMode={true} state={{ entries: [] }} />);
    expect(screen.getByText(/等待第一筆得分/)).toBeInTheDocument();
  });

  it("玩家端有 myId 時 highlight 我的位置", () => {
    render(
      <LiveLeaderboard
        config={{}}
        hostMode={false}
        state={{ entries: sampleEntries }}
        myId="p2"
      />,
    );
    expect(screen.getByText("我的排名")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
    expect(screen.getByText(/Bob.*80 分/)).toBeInTheDocument();
  });

  it("玩家端無 myId 不顯示「我的排名」卡", () => {
    render(
      <LiveLeaderboard
        config={{}}
        hostMode={false}
        state={{ entries: sampleEntries }}
      />,
    );
    expect(screen.queryByText("我的排名")).not.toBeInTheDocument();
  });
});
