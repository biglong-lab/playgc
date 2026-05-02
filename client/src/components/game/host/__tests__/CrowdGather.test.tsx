import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CrowdGather from "../CrowdGather";

describe("CrowdGather", () => {
  it("hostMode 顯示進度（5/10）", () => {
    render(
      <CrowdGather
        config={{ title: "歡迎加入", targetCount: 10 }}
        hostMode={true}
        state={{
          registered: [
            { name: "Alice", ts: Date.now() },
            { name: "Bob", ts: Date.now() },
          ],
          totalCount: 5,
          isReached: false,
        }}
      />,
    );
    expect(screen.getByText("歡迎加入")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText(/還差 5 位/)).toBeInTheDocument();
  });

  it("hostMode 達標時顯示慶祝文字", () => {
    render(
      <CrowdGather
        config={{ targetCount: 10, celebrationText: "全員到齊！" }}
        hostMode={true}
        state={{ registered: [], totalCount: 10, isReached: true }}
      />,
    );
    expect(screen.getByText("全員到齊！")).toBeInTheDocument();
  });

  it("玩家端顯示簽到按鈕 + 暱稱輸入", () => {
    render(<CrowdGather config={{ targetCount: 5 }} hostMode={false} />);
    expect(screen.getByTestId("btn-checkin")).toBeInTheDocument();
    expect(screen.getByTestId("input-checkin-name")).toBeInTheDocument();
  });

  it("簽到觸發 onPulse，含暱稱", () => {
    const onPulse = vi.fn();
    render(<CrowdGather config={{}} hostMode={false} onPulse={onPulse} />);
    const input = screen.getByTestId("input-checkin-name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "阿鬨" } });
    fireEvent.click(screen.getByTestId("btn-checkin"));
    expect(onPulse).toHaveBeenCalledWith("checkin", { name: "阿鬨" });
  });

  it("簽到後顯示「已簽到」UI（不再可以再簽）", () => {
    const onPulse = vi.fn();
    render(<CrowdGather config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-checkin"));
    expect(screen.getByText("已簽到")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-checkin")).not.toBeInTheDocument();
    // 再點不會再送（按鈕已不存在 → 沒法再觸發）
    expect(onPulse).toHaveBeenCalledTimes(1);
  });

  it("空白暱稱會用匿名", () => {
    const onPulse = vi.fn();
    render(<CrowdGather config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-checkin"));
    expect(onPulse).toHaveBeenCalledTimes(1);
    const call = onPulse.mock.calls[0];
    expect(call[0]).toBe("checkin");
    expect(call[1].name).toBeTruthy(); // 應該有 fallback 名字
  });
});
