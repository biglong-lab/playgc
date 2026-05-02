import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LotteryWheel, { buildInitialLotteryState, calculateWheelAngle } from "../LotteryWheel";

// localStorage 在 setup.ts 是 mock、需在測試中明確 mockReturnValue
beforeEach(() => {
  vi.mocked(localStorage.getItem).mockReset();
});

const sampleItems = [
  { id: "1", label: "Alice" },
  { id: "2", label: "Bob" },
  { id: "3", label: "Charlie" },
];

describe("LotteryWheel", () => {
  it("hostMode 顯示標題 + 候選數", () => {
    render(
      <LotteryWheel
        config={{ title: "婚禮抽伴娘" }}
        hostMode={true}
        state={{
          items: sampleItems,
          spinning: false,
          winnerId: null,
          spinStartedAt: null,
          spinDurationMs: 5000,
        }}
      />,
    );
    expect(screen.getByText(/婚禮抽伴娘/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // 候選數
  });

  it("hostMode 無候選時顯示等待訊息", () => {
    render(
      <LotteryWheel
        config={{}}
        hostMode={true}
        state={{
          items: [],
          spinning: false,
          winnerId: null,
          spinStartedAt: null,
          spinDurationMs: 5000,
        }}
      />,
    );
    expect(screen.getByText(/等待玩家報名/)).toBeInTheDocument();
  });

  it("hostMode 旋轉結束顯示中獎者", () => {
    render(
      <LotteryWheel
        config={{}}
        hostMode={true}
        state={{
          items: sampleItems,
          spinning: false,
          winnerId: "2",
          // 確認 isFinished 為 true（spinStartedAt 在過去 + 已超過 spinDurationMs）
          spinStartedAt: Date.now() - 10000,
          spinDurationMs: 5000,
        }}
      />,
    );
    const winner = screen.getByTestId("lottery-winner");
    expect(winner).toBeInTheDocument();
    expect(winner).toHaveTextContent("Bob");
  });

  it("玩家端顯示報名按鈕（allowJoin 預設 true）", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("TestUser");
    render(<LotteryWheel config={{}} hostMode={false} />);
    const btn = screen.getByTestId("btn-lottery-join");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("TestUser");
  });

  it("玩家端 allowJoin=false 不顯示報名按鈕", () => {
    render(<LotteryWheel config={{ allowJoin: false }} hostMode={false} />);
    expect(screen.queryByTestId("btn-lottery-join")).not.toBeInTheDocument();
  });

  it("buildInitialLotteryState 套用 config 預設值", () => {
    const state = buildInitialLotteryState({
      items: sampleItems,
      spinDurationMs: 8000,
    });
    expect(state.items).toEqual(sampleItems);
    expect(state.spinDurationMs).toBe(8000);
    expect(state.spinning).toBe(false);
    expect(state.winnerId).toBeNull();
  });

  it("calculateWheelAngle 旋轉中回傳合理角度", () => {
    const startedAt = 1000;
    // 旋轉中（progress = 0.5）→ 應該是 ease-out 後的角度
    const angle = calculateWheelAngle(startedAt, 4000, 1, 4, startedAt + 2000);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(360 * 5); // 不超過總圈數
  });

  it("calculateWheelAngle 結束後固定在 winner 角度", () => {
    const startedAt = 1000;
    // 旋轉已過、targetIndex=2 / total=4 → 每段 90°
    const angle = calculateWheelAngle(startedAt, 4000, 2, 4, startedAt + 5000);
    // 預期：-2 * 90 - 45 + 360*5 = -225 + 1800 = 1575
    expect(angle).toBe(-2 * 90 - 45 + 360 * 5);
  });

  it("玩家端 - 點擊報名觸發 onPulse", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    const onPulse = vi.fn();

    render(<LotteryWheel config={{}} hostMode={false} onPulse={onPulse} />);
    const btn = screen.getByTestId("btn-lottery-join");
    fireEvent.click(btn);
    expect(onPulse).toHaveBeenCalledWith("join", { name: "Hung" });
  });
});
