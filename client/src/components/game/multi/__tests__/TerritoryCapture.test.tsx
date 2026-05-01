// TerritoryCapture 單元測試
//
// 覆蓋：
//   - 純函式：distanceMeters / computeRanking / canCapturePoint
//   - 元件：isTimeUp / 主畫面 / 排行榜 / 點清單三狀態
//   - 互動：onCapture / onComplete

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TerritoryCapture, {
  distanceMeters,
  computeRanking,
  canCapturePoint,
  type TerritoryCapture as TerritoryCaptureRecord,
} from "../TerritoryCapture";
import type { TerritoryCaptureConfig } from "@shared/schema";

// ============================================================================
// 純函式
// ============================================================================

describe("distanceMeters", () => {
  it("同點 → 0 公尺", () => {
    expect(distanceMeters(25.04, 121.5, 25.04, 121.5)).toBe(0);
  });

  it("台北 101 (25.0337, 121.5645) ↔ 國父紀念館 (25.0398, 121.5577) ≈ 940 公尺", () => {
    const d = distanceMeters(25.0337, 121.5645, 25.0398, 121.5577);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1100);
  });

  it("距離公式對稱", () => {
    const a = distanceMeters(24, 121, 25, 122);
    const b = distanceMeters(25, 122, 24, 121);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });
});

describe("computeRanking", () => {
  it("無佔領 → 空陣列", () => {
    expect(computeRanking([])).toEqual([]);
  });

  it("中立點（teamId=null）不計入排行", () => {
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: null, capturedAt: 0 },
    ];
    expect(computeRanking(captures)).toEqual([]);
  });

  it("依佔領數降序排列", () => {
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: "team-A", capturedAt: 0 },
      { pointId: "p2", teamId: "team-A", capturedAt: 0 },
      { pointId: "p3", teamId: "team-B", capturedAt: 0 },
    ];
    const ranking = computeRanking(captures);
    expect(ranking).toEqual([
      { teamId: "team-A", count: 2 },
      { teamId: "team-B", count: 1 },
    ]);
  });
});

describe("canCapturePoint", () => {
  const point = { id: "p1", title: "點", lat: 25, lng: 121, radius: 30 };

  it("距離 > radius → out_of_range", () => {
    const r = canCapturePoint(point, 25.001, 121, undefined, "team-A", 30000, Date.now());
    expect(r.capturable).toBe(false);
    expect(r.reason).toBe("out_of_range");
  });

  it("距離 < radius + 中立點 → 可佔", () => {
    const r = canCapturePoint(point, 25.0001, 121, undefined, "team-A", 30000, Date.now());
    expect(r.capturable).toBe(true);
  });

  it("已是自己佔的 → already_mine", () => {
    const capture: TerritoryCaptureRecord = {
      pointId: "p1",
      teamId: "team-A",
      capturedAt: Date.now() - 60000, // 60 秒前佔的
    };
    const r = canCapturePoint(point, 25.0001, 121, capture, "team-A", 30000, Date.now());
    expect(r.capturable).toBe(false);
    expect(r.reason).toBe("already_mine");
  });

  it("敵方佔了但還在冷卻期 → cooldown", () => {
    const now = Date.now();
    const capture: TerritoryCaptureRecord = {
      pointId: "p1",
      teamId: "team-B",
      capturedAt: now - 5000, // 5 秒前佔的，冷卻 30 秒
    };
    const r = canCapturePoint(point, 25.0001, 121, capture, "team-A", 30000, now);
    expect(r.capturable).toBe(false);
    expect(r.reason).toBe("cooldown");
  });

  it("敵方佔了且冷卻期過 → 可奪回", () => {
    const now = Date.now();
    const capture: TerritoryCaptureRecord = {
      pointId: "p1",
      teamId: "team-B",
      capturedAt: now - 60000, // 60 秒前佔的，冷卻 30 秒已過
    };
    const r = canCapturePoint(point, 25.0001, 121, capture, "team-A", 30000, now);
    expect(r.capturable).toBe(true);
  });
});

// ============================================================================
// 元件渲染
// ============================================================================

const baseConfig: TerritoryCaptureConfig = {
  title: "三點地盤戰",
  points: [
    { id: "p1", title: "點 A", lat: 25, lng: 121 },
    { id: "p2", title: "點 B", lat: 25.001, lng: 121.001 },
    { id: "p3", title: "點 C", lat: 25.002, lng: 121.002 },
  ],
  timeLimitSec: 600,
  cooldownSec: 30,
};

const baseProps = {
  config: baseConfig,
  myTeamId: "team-A",
  myPosition: { lat: 25.0001, lng: 121.0001 } as { lat: number; lng: number } | null,
  captures: [] as TerritoryCaptureRecord[],
  remainingSec: 600,
  isTimeUp: false,
  onCapture: vi.fn(),
  onComplete: vi.fn(),
};

describe("TerritoryCapture 元件渲染", () => {
  it("isTimeUp → 顯示結算畫面 Trophy", () => {
    render(<TerritoryCapture {...baseProps} isTimeUp />);
    expect(screen.getByTestId("territory-time-up")).toBeInTheDocument();
  });

  it("isTimeUp + 我隊第一 → 顯示「你們贏了」", () => {
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: "team-A", capturedAt: 0 },
      { pointId: "p2", teamId: "team-A", capturedAt: 0 },
      { pointId: "p3", teamId: "team-B", capturedAt: 0 },
    ];
    render(<TerritoryCapture {...baseProps} isTimeUp captures={captures} />);
    expect(screen.getByText(/你們贏了/)).toBeInTheDocument();
  });

  it("主畫面顯示標題 + 倒數", () => {
    render(<TerritoryCapture {...baseProps} />);
    expect(screen.getByTestId("territory-capture")).toBeInTheDocument();
    expect(screen.getByText("三點地盤戰")).toBeInTheDocument();
    expect(screen.getByTestId("territory-remaining")).toHaveTextContent("剩 10:00");
  });

  it("點清單顯示 N 個點", () => {
    render(<TerritoryCapture {...baseProps} />);
    expect(screen.getByTestId("territory-point-p1")).toBeInTheDocument();
    expect(screen.getByTestId("territory-point-p2")).toBeInTheDocument();
    expect(screen.getByTestId("territory-point-p3")).toBeInTheDocument();
  });

  it("已佔領顯示「已佔領」徽章 / 敵方顯示「敵方」/ 中立顯示「中立」", () => {
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: "team-A", capturedAt: Date.now() - 60000 },
      { pointId: "p2", teamId: "team-B", capturedAt: Date.now() - 60000 },
    ];
    render(<TerritoryCapture {...baseProps} captures={captures} />);
    expect(screen.getByText("已佔領")).toBeInTheDocument();
    expect(screen.getByText("敵方")).toBeInTheDocument();
    expect(screen.getByText("中立")).toBeInTheDocument();
  });

  it("無 myPosition → 顯示等待 GPS 訊息", () => {
    render(<TerritoryCapture {...baseProps} myPosition={null} />);
    expect(screen.getByText(/等待 GPS/)).toBeInTheDocument();
  });
});

// ============================================================================
// 互動
// ============================================================================

describe("TerritoryCapture 互動", () => {
  it("距離夠 + 中立點 → 顯示佔領按鈕，點擊觸發 onCapture", () => {
    const onCapture = vi.fn();
    render(<TerritoryCapture {...baseProps} onCapture={onCapture} />);
    const btn = screen.getByTestId("btn-territory-capture-p1");
    fireEvent.click(btn);
    expect(onCapture).toHaveBeenCalledWith("p1");
  });

  it("距離太遠 → 不顯示佔領按鈕", () => {
    render(
      <TerritoryCapture
        {...baseProps}
        myPosition={{ lat: 26, lng: 122 }} // 遠在天邊
      />,
    );
    expect(screen.queryByTestId("btn-territory-capture-p1")).not.toBeInTheDocument();
  });

  it("已是自己佔的 → 不顯示按鈕（avoid 重佔）", () => {
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: "team-A", capturedAt: Date.now() - 60000 },
    ];
    render(<TerritoryCapture {...baseProps} captures={captures} />);
    expect(screen.queryByTestId("btn-territory-capture-p1")).not.toBeInTheDocument();
  });

  it("敵方佔的還在冷卻 → 顯示冷卻中文字，無按鈕", () => {
    const now = Date.now();
    const captures: TerritoryCaptureRecord[] = [
      { pointId: "p1", teamId: "team-B", capturedAt: now - 5000 }, // 5s ago
    ];
    render(<TerritoryCapture {...baseProps} captures={captures} />);
    expect(screen.queryByTestId("btn-territory-capture-p1")).not.toBeInTheDocument();
    expect(screen.getByText(/冷卻中/)).toBeInTheDocument();
  });

  it("結算畫面點繼續 → 觸發 onComplete 帶 reward + nextPageId", () => {
    const onComplete = vi.fn();
    const config: TerritoryCaptureConfig = {
      ...baseConfig,
      rewardPoints: 50,
      nextPageId: "page-next",
    };
    render(
      <TerritoryCapture
        {...baseProps}
        config={config}
        isTimeUp
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-territory-continue"));
    expect(onComplete).toHaveBeenCalledWith({ points: 50 }, "page-next");
  });
});
