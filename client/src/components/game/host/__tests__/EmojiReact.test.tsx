import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiReact from "../EmojiReact";

describe("EmojiReact", () => {
  it("hostMode 顯示總互動數 + 各 emoji", () => {
    render(
      <EmojiReact
        config={{ title: "現場應援" }}
        hostMode={true}
        state={{
          counts: { "❤️": 10, "👍": 5, "🎉": 0, "🔥": 0, "😍": 0, "👏": 0, "😂": 0, "🙌": 0 },
          totalReacts: 15,
          recentFlying: [],
        }}
      />,
    );
    expect(screen.getByText("現場應援")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("玩家端顯示 8 個預設 emoji 按鈕", () => {
    render(<EmojiReact config={{}} hostMode={false} />);
    expect(screen.getByTestId("btn-emoji-❤️")).toBeInTheDocument();
    expect(screen.getByTestId("btn-emoji-🎉")).toBeInTheDocument();
  });

  it("自訂 emojis 列表", () => {
    render(<EmojiReact config={{ emojis: ["🚀", "💎"] }} hostMode={false} />);
    expect(screen.getByTestId("btn-emoji-🚀")).toBeInTheDocument();
    expect(screen.getByTestId("btn-emoji-💎")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-emoji-❤️")).not.toBeInTheDocument();
  });

  it("點擊 emoji 觸發 onPulse", () => {
    const onPulse = vi.fn();
    render(<EmojiReact config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-emoji-❤️"));
    expect(onPulse).toHaveBeenCalledWith("react", { emoji: "❤️" });
  });

  it("throttle：200ms 內第二次點擊被擋", () => {
    const onPulse = vi.fn();
    render(<EmojiReact config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-emoji-❤️"));
    fireEvent.click(screen.getByTestId("btn-emoji-❤️"));
    expect(onPulse).toHaveBeenCalledTimes(1);
  });
});
