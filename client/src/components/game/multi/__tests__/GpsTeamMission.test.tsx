// GpsTeamMission 單元測試
//
// 覆蓋：
//   - 純函式 helpers：getTargetLocation / findReachedMembers /
//     isGpsTeamMissionComplete / formatDistance
//   - 元件：render / 觸發模式 any vs all / fallback UI

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import GpsTeamMission, {
  getTargetLocation,
  findReachedMembers,
  isGpsTeamMissionComplete,
  formatDistance,
  type TeammateLocation,
} from "../GpsTeamMission";
import type { GpsMissionConfig } from "@shared/schema";

// ============================================================================
// 純函式 helpers
// ============================================================================

describe("getTargetLocation", () => {
  it("targetLocation 物件格式", () => {
    expect(
      getTargetLocation({
        targetLocation: { lat: 25.04, lng: 121.51 },
      } as GpsMissionConfig),
    ).toEqual({ lat: 25.04, lng: 121.51 });
  });

  it("targetLatitude/targetLongitude 平面格式", () => {
    expect(
      getTargetLocation({
        targetLatitude: 25.04,
        targetLongitude: 121.51,
      } as GpsMissionConfig),
    ).toEqual({ lat: 25.04, lng: 121.51 });
  });

  it("無目標 → null", () => {
    expect(getTargetLocation({} as GpsMissionConfig)).toBeNull();
  });

  it("targetLocation 優先於 targetLatitude/Longitude", () => {
    const result = getTargetLocation({
      targetLocation: { lat: 1, lng: 2 },
      targetLatitude: 10,
      targetLongitude: 20,
    } as GpsMissionConfig);
    expect(result).toEqual({ lat: 1, lng: 2 });
  });
});

const makeTeammate = (overrides: Partial<TeammateLocation> = {}): TeammateLocation => ({
  userId: "u1",
  displayName: "玩家",
  lat: 25.04,
  lng: 121.51,
  accuracy: 10,
  timestamp: "2026-05-01",
  ...overrides,
});

describe("findReachedMembers", () => {
  const target = { lat: 25.04, lng: 121.51 };

  it("空隊員 → 空陣列", () => {
    expect(findReachedMembers([], target, 50)).toEqual([]);
  });

  it("剛好在目標位置（距離 0）→ 算到達", () => {
    const result = findReachedMembers(
      [makeTeammate({ userId: "u1", lat: 25.04, lng: 121.51 })],
      target,
      50,
    );
    expect(result).toEqual(["u1"]);
  });

  it("超出半徑 → 不算到達", () => {
    // 25.04 + 0.01 約 1.1 km，遠超 50m 半徑
    const result = findReachedMembers(
      [makeTeammate({ userId: "u1", lat: 25.05, lng: 121.51 })],
      target,
      50,
    );
    expect(result).toEqual([]);
  });

  it("多人混合：有的到達有的沒", () => {
    const teammates = [
      makeTeammate({ userId: "u1", lat: 25.04, lng: 121.51 }), // 0m
      makeTeammate({ userId: "u2", lat: 25.05, lng: 121.51 }), // 1.1km
      makeTeammate({ userId: "u3", lat: 25.0401, lng: 121.5101 }), // ~13m
    ];
    const result = findReachedMembers(teammates, target, 50);
    expect(result).toContain("u1");
    expect(result).toContain("u3");
    expect(result).not.toContain("u2");
  });
});

describe("isGpsTeamMissionComplete", () => {
  it("空隊員 → false", () => {
    expect(isGpsTeamMissionComplete([], [], "any")).toBe(false);
  });

  it("any 模式：1 人到達即完成", () => {
    expect(isGpsTeamMissionComplete(["u1"], ["u1", "u2", "u3"], "any")).toBe(true);
  });

  it("any 模式：0 人到達 → 未完成", () => {
    expect(isGpsTeamMissionComplete([], ["u1", "u2"], "any")).toBe(false);
  });

  it("all 模式：全員到達才完成", () => {
    expect(
      isGpsTeamMissionComplete(["u1", "u2"], ["u1", "u2"], "all"),
    ).toBe(true);
  });

  it("all 模式：少 1 人 → 未完成", () => {
    expect(isGpsTeamMissionComplete(["u1"], ["u1", "u2"], "all")).toBe(false);
  });

  it("all 模式：reached 比 all 多（不該發生但容錯）→ true", () => {
    expect(
      isGpsTeamMissionComplete(["u1", "u2", "u3"], ["u1", "u2"], "all"),
    ).toBe(true);
  });
});

describe("formatDistance", () => {
  it("< 1km 顯示公尺整數", () => {
    expect(formatDistance(50)).toBe("50 公尺");
    expect(formatDistance(999.4)).toBe("999 公尺");
  });

  it(">= 1km 顯示公里小數點 1 位", () => {
    expect(formatDistance(1500)).toBe("1.5 公里");
    expect(formatDistance(2300)).toBe("2.3 公里");
  });

  it("剛好 1000m → 1.0 公里", () => {
    expect(formatDistance(1000)).toBe("1.0 公里");
  });
});

// ============================================================================
// 元件互動
// ============================================================================

const baseConfig: GpsMissionConfig = {
  title: "尋找古蹟",
  locationName: "金門城",
  targetLocation: { lat: 24.4, lng: 118.3 },
  radius: 50,
  instruction: "走到目標位置",
};

const baseProps = {
  config: baseConfig,
  myUserId: "me",
  teammates: [] as TeammateLocation[],
  triggerMode: "any" as const,
  onComplete: vi.fn(),
};

describe("GpsTeamMission 元件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("無 target 時顯示錯誤訊息", () => {
    render(<GpsTeamMission {...baseProps} config={{ ...baseConfig, targetLocation: undefined }} />);
    expect(screen.getByTestId("gps-team-mission-no-target")).toBeInTheDocument();
  });

  it("無隊員時顯示等待訊息", () => {
    render(<GpsTeamMission {...baseProps} />);
    expect(screen.getByTestId("gps-team-mission-no-teammates")).toBeInTheDocument();
  });

  it("有隊員時顯示主畫面 + 標題 + 目標名稱", () => {
    const teammates = [
      makeTeammate({ userId: "me", displayName: "我", lat: 24.5, lng: 118.4 }),
    ];
    render(<GpsTeamMission {...baseProps} teammates={teammates} />);

    expect(screen.getByTestId("gps-team-mission")).toBeInTheDocument();
    expect(screen.getByText("尋找古蹟")).toBeInTheDocument();
    expect(screen.getByText(/金門城/)).toBeInTheDocument();
  });

  it("any 模式：顯示「任一隊員到達即完成」", () => {
    const teammates = [makeTeammate({ userId: "me", displayName: "我" })];
    render(<GpsTeamMission {...baseProps} teammates={teammates} triggerMode="any" />);
    expect(screen.getByText(/任一隊員到達即完成/)).toBeInTheDocument();
  });

  it("all 模式：顯示「需全員到達」", () => {
    const teammates = [makeTeammate({ userId: "me", displayName: "我" })];
    render(<GpsTeamMission {...baseProps} teammates={teammates} triggerMode="all" />);
    expect(screen.getByText(/需全員到達/)).toBeInTheDocument();
  });

  it("到達者顯示綠勾", () => {
    const teammates = [
      makeTeammate({ userId: "u1", displayName: "已到", lat: 24.4, lng: 118.3 }),
      makeTeammate({ userId: "u2", displayName: "未到", lat: 24.5, lng: 118.4 }),
    ];
    render(<GpsTeamMission {...baseProps} teammates={teammates} />);

    expect(screen.getByTestId("gps-reached-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("gps-reached-u2")).not.toBeInTheDocument();
  });

  it("自己標記「（你）」", () => {
    const teammates = [
      makeTeammate({ userId: "me", displayName: "我自己" }),
      makeTeammate({ userId: "u2", displayName: "別人" }),
    ];
    render(<GpsTeamMission {...baseProps} teammates={teammates} />);
    expect(screen.getByText("（你）")).toBeInTheDocument();
  });

  it("any 模式達標 → 1 秒後 onComplete", async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const teammates = [
      makeTeammate({ userId: "me", lat: 24.4, lng: 118.3 }), // 在目標
    ];
    render(
      <GpsTeamMission
        {...baseProps}
        teammates={teammates}
        triggerMode="any"
        onComplete={onComplete}
      />,
    );

    expect(screen.getByTestId("gps-team-mission-complete")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(1100);
    expect(onComplete).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("all 模式：1/2 到達 → 不完成", () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const teammates = [
      makeTeammate({ userId: "u1", lat: 24.4, lng: 118.3 }), // 到了
      makeTeammate({ userId: "u2", lat: 25, lng: 119 }), // 沒到
    ];
    render(
      <GpsTeamMission
        {...baseProps}
        teammates={teammates}
        triggerMode="all"
        onComplete={onComplete}
      />,
    );
    vi.advanceTimersByTime(2000);
    expect(onComplete).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("進度 badge 顯示「N / M 已到達」", () => {
    const teammates = [
      makeTeammate({ userId: "u1", lat: 24.4, lng: 118.3 }),
      makeTeammate({ userId: "u2", lat: 25, lng: 119 }),
      makeTeammate({ userId: "u3", lat: 25, lng: 119 }),
    ];
    render(<GpsTeamMission {...baseProps} teammates={teammates} />);
    const badge = screen.getByTestId("gps-team-mission-progress-badge");
    expect(badge.textContent).toMatch(/1\s*\/\s*3/);
  });
});
