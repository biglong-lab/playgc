import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PolaroidCollage from "../PolaroidCollage";

const samplePolaroids = [
  { id: "1", emoji: "💖", message: "新婚快樂！", author: "Alice", color: "#fef3c7", ts: Date.now() },
  { id: "2", emoji: "🎉", message: "一輩子幸福", author: "Bob", color: "#fce7f3", ts: Date.now() },
];

describe("PolaroidCollage", () => {
  it("hostMode 顯示祝福數 + 拍立得卡片", () => {
    render(
      <PolaroidCollage
        config={{ title: "婚禮紀念牆" }}
        hostMode={true}
        state={{ polaroids: samplePolaroids }}
      />,
    );
    expect(screen.getByText("婚禮紀念牆")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("新婚快樂！")).toBeInTheDocument();
    expect(screen.getByText("— Alice")).toBeInTheDocument();
  });

  it("hostMode 0 polaroids 顯示「等待第一則祝福」", () => {
    render(<PolaroidCollage config={{}} hostMode={true} state={{ polaroids: [] }} />);
    expect(screen.getByText(/等待第一則祝福/)).toBeInTheDocument();
  });

  it("玩家版型顯示預覽卡 + 表單", () => {
    render(<PolaroidCollage config={{}} hostMode={false} myUserName="我" />);
    expect(screen.getByTestId("input-polaroid-message")).toBeInTheDocument();
    expect(screen.getByTestId("btn-submit-polaroid")).toBeInTheDocument();
  });

  it("空白訊息禁用送出按鈕", () => {
    render(<PolaroidCollage config={{}} hostMode={false} />);
    const btn = screen.getByTestId("btn-submit-polaroid") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("提交觸發 onPulse + 顯示已送出畫面", () => {
    const onPulse = vi.fn();
    render(<PolaroidCollage config={{}} hostMode={false} onPulse={onPulse} myUserName="我" />);
    fireEvent.change(screen.getByTestId("input-polaroid-message"), {
      target: { value: "祝福你" },
    });
    fireEvent.click(screen.getByTestId("btn-submit-polaroid"));
    expect(onPulse).toHaveBeenCalled();
    const call = onPulse.mock.calls[0];
    expect(call[0]).toBe("polaroid");
    expect(call[1].message).toBe("祝福你");
    expect(screen.getByText("已送出祝福")).toBeInTheDocument();
  });

  it("自訂 emojis 列表", () => {
    render(<PolaroidCollage config={{ emojis: ["🚀", "💎"] }} hostMode={false} />);
    expect(screen.getByTestId("btn-polaroid-emoji-🚀")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-polaroid-emoji-💖")).not.toBeInTheDocument();
  });
});
