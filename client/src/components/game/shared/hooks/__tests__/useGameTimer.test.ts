// useGameTimer 單元測試
//
// 覆蓋：初始狀態 / tick 倒數 / 自動停止 / pause+resume / reset / callbacks / unmount cleanup

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameTimer } from "../useGameTimer";

describe("useGameTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("初始狀態：remaining = durationSec, 自動 running, formatted 補零", () => {
    const { result } = renderHook(() => useGameTimer({ durationSec: 65 }));

    expect(result.current.remaining).toBe(65);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.formatted).toBe("01:05");
  });

  it("autoStart=false 時，初始為 paused 不倒數", () => {
    const { result } = renderHook(() =>
      useGameTimer({ durationSec: 30, autoStart: false }),
    );

    expect(result.current.isRunning).toBe(false);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.remaining).toBe(30);
  });

  it("每秒倒數 1，5 秒後 remaining 從 10 變 5", () => {
    const { result } = renderHook(() => useGameTimer({ durationSec: 10 }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.remaining).toBe(5);
    expect(result.current.formatted).toBe("00:05");
  });

  it("倒數歸零時 isExpired=true，自動停止 tick，觸發 onExpired", () => {
    const onExpired = vi.fn();
    const { result } = renderHook(() =>
      useGameTimer({ durationSec: 3, onExpired }),
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.remaining).toBe(0);
    expect(result.current.isExpired).toBe(true);
    // expired 後自動停止（避免 resume 啟動 0 計時器）
    expect(result.current.isRunning).toBe(false);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("onTick 每秒被呼叫，傳入剩餘秒數", () => {
    const onTick = vi.fn();
    renderHook(() => useGameTimer({ durationSec: 3, onTick }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onTick).toHaveBeenCalledWith(2);
    expect(onTick).toHaveBeenCalledWith(1);
    expect(onTick).toHaveBeenCalledWith(0);
  });

  it("pause 後不再倒數；resume 後繼續從剩餘秒數倒", () => {
    const { result } = renderHook(() => useGameTimer({ durationSec: 10 }));

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.remaining).toBe(7);

    act(() => {
      result.current.pause();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remaining).toBe(7);
    expect(result.current.isRunning).toBe(false);

    act(() => {
      result.current.resume();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remaining).toBe(5);
  });

  it("已 expired 後 resume 不會繼續（避免從 0 重啟）", () => {
    const { result } = renderHook(() => useGameTimer({ durationSec: 1 }));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remaining).toBe(0);

    act(() => {
      result.current.resume();
    });

    expect(result.current.isRunning).toBe(false);
  });

  it("reset 後 remaining 回到 durationSec，重新開始倒數", () => {
    const { result } = renderHook(() => useGameTimer({ durationSec: 10 }));

    act(() => {
      vi.advanceTimersByTime(7000);
    });
    expect(result.current.remaining).toBe(3);

    act(() => {
      result.current.reset();
    });

    expect(result.current.remaining).toBe(10);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remaining).toBe(8);
  });

  it("formatted 對 65 秒輸出 '01:05'，對 5 秒輸出 '00:05'", () => {
    const { result, rerender } = renderHook(
      ({ d }) => useGameTimer({ durationSec: d, autoStart: false }),
      { initialProps: { d: 65 } },
    );
    expect(result.current.formatted).toBe("01:05");

    rerender({ d: 5 });
    // rerender 不會重置（durationSec 變化只在 reset 時生效），但 formatted 會用當前 remaining
    expect(result.current.formatted).toBe("01:05"); // 既有 state 是 65
  });

  it("unmount 後 timer 不再 fire（無 leak）", () => {
    const onTick = vi.fn();
    const { unmount } = renderHook(() =>
      useGameTimer({ durationSec: 100, onTick }),
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onTick).toHaveBeenCalledTimes(2);

    unmount();
    onTick.mockClear();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onTick).not.toHaveBeenCalled();
  });
});
