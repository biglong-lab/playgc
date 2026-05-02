import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WaveResponse from "../WaveResponse";

describe("WaveResponse", () => {
  it("hostMode 顯示總應援數", () => {
    render(
      <WaveResponse
        config={{ title: "全場應援" }}
        hostMode={true}
        state={{ totalTaps: 1234, bucketBySec: {} }}
      />,
    );
    expect(screen.getByText("全場應援")).toBeInTheDocument();
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("玩家端顯示應援按鈕（自訂 label）", () => {
    render(<WaveResponse config={{ buttonLabel: "GO!" }} hostMode={false} />);
    expect(screen.getByTestId("btn-wave-tap")).toBeInTheDocument();
    expect(screen.getByText("GO!")).toBeInTheDocument();
  });

  it("點擊應援按鈕觸發 onPulse('tap')", () => {
    const onPulse = vi.fn();
    render(<WaveResponse config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-wave-tap"));
    expect(onPulse).toHaveBeenCalledWith("tap", {});
  });

  it("80ms throttle 擋第二次點擊", () => {
    const onPulse = vi.fn();
    render(<WaveResponse config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-wave-tap"));
    fireEvent.click(screen.getByTestId("btn-wave-tap"));
    expect(onPulse).toHaveBeenCalledTimes(1);
  });

  it("hostMode 用 bucketBySec 渲染最近 30 秒（不報錯）", () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <WaveResponse
        config={{}}
        hostMode={true}
        state={{
          totalTaps: 50,
          bucketBySec: { [now.toString()]: 5, [(now - 1).toString()]: 3 },
        }}
      />,
    );
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});
