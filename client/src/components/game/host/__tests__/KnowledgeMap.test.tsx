import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import KnowledgeMap from "../KnowledgeMap";

const sampleConfig = {
  title: "金門全景地圖",
  subtitle: "8 個地標等你打卡",
  points: [
    { id: "p1", name: "後浦老街", x: 25, y: 35, emoji: "🏛️", description: "歷史巷弄" },
    { id: "p2", name: "莒光樓", x: 60, y: 25, emoji: "🏯" },
    { id: "p3", name: "翟山坑道", x: 75, y: 60, emoji: "🪖" },
  ],
};

const sampleVisits = [
  { id: "v1", pointId: "p1", name: "Alice", message: "好棒的老街", ts: Date.now() - 3000 },
  { id: "v2", pointId: "p1", name: "Bob", ts: Date.now() - 2000 },
  { id: "v3", pointId: "p2", name: "Carol", message: "風景超美", ts: Date.now() - 1000 },
];

describe("KnowledgeMap", () => {
  it("hostMode 顯示標題、總打卡數、地標數量", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={true}
        state={{ visits: sampleVisits }}
      />,
    );
    expect(screen.getByText("金門全景地圖")).toBeInTheDocument();
    expect(screen.getByText("8 個地標等你打卡")).toBeInTheDocument();
    expect(screen.getByTestId("text-total-visits")).toHaveTextContent("3");
    expect(screen.getByText("3", { selector: ".text-cyan-400" })).toBeInTheDocument();
  });

  it("hostMode 0 visits 顯示等待提示", () => {
    render(
      <KnowledgeMap config={sampleConfig} hostMode={true} state={{ visits: [] }} />,
    );
    expect(screen.getByText(/等待第一位玩家打卡/)).toBeInTheDocument();
  });

  it("hostMode 顯示所有 POI markers", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={true}
        state={{ visits: sampleVisits }}
      />,
    );
    expect(screen.getByTestId("map-point-p1")).toBeInTheDocument();
    expect(screen.getByTestId("map-point-p2")).toBeInTheDocument();
    expect(screen.getByTestId("map-point-p3")).toBeInTheDocument();
  });

  it("hostMode 跑馬燈顯示最近打卡", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={true}
        state={{ visits: sampleVisits }}
      />,
    );
    expect(screen.getByTestId("recent-visit-v1")).toBeInTheDocument();
    expect(screen.getByTestId("recent-visit-v2")).toBeInTheDocument();
    expect(screen.getByTestId("recent-visit-v3")).toBeInTheDocument();
    expect(screen.getByText(/好棒的老街/)).toBeInTheDocument();
  });

  it("玩家版型列出所有地標 + 已打卡進度", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={false}
        myUserName="我"
        state={{ visits: sampleVisits }}
      />,
    );
    expect(screen.getByTestId("player-point-p1")).toBeInTheDocument();
    expect(screen.getByTestId("player-point-p2")).toBeInTheDocument();
    expect(screen.getByText(/已打卡 0 \/ 3 個地標/)).toBeInTheDocument();
  });

  it("玩家點選 POI 後展開留言 + 打卡按鈕", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={false}
        myUserName="我"
        state={{ visits: [] }}
      />,
    );
    fireEvent.click(screen.getByTestId("player-point-p1").querySelector("button")!);
    expect(screen.getByTestId("input-knowledge-map-message-p1")).toBeInTheDocument();
    expect(screen.getByTestId("btn-knowledge-map-checkin-p1")).toBeInTheDocument();
  });

  it("玩家送出打卡觸發 onPulse 並標記已打卡", () => {
    const onPulse = vi.fn();
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={false}
        myUserName="阿鬨"
        onPulse={onPulse}
        state={{ visits: [] }}
      />,
    );
    fireEvent.click(screen.getByTestId("player-point-p2").querySelector("button")!);
    fireEvent.change(screen.getByTestId("input-knowledge-map-message-p2"), {
      target: { value: "風景真好" },
    });
    fireEvent.click(screen.getByTestId("btn-knowledge-map-checkin-p2"));
    expect(onPulse).toHaveBeenCalledWith("visit", {
      pointId: "p2",
      name: "阿鬨",
      message: "風景真好",
    });
  });

  it("空白名字禁用打卡按鈕（無 myUserName 且無輸入）", () => {
    render(
      <KnowledgeMap
        config={sampleConfig}
        hostMode={false}
        state={{ visits: [] }}
      />,
    );
    fireEvent.click(screen.getByTestId("player-point-p1").querySelector("button")!);
    const btn = screen.getByTestId("btn-knowledge-map-checkin-p1") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("使用預設地標當 config 無 points", () => {
    render(<KnowledgeMap config={{}} hostMode={true} state={{ visits: [] }} />);
    expect(screen.getByText("🗺️ 場域全景地圖")).toBeInTheDocument();
    expect(screen.getByTestId("map-point-p1")).toBeInTheDocument();
  });
});
