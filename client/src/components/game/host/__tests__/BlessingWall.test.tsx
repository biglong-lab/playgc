import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BlessingWall from "../BlessingWall";

beforeEach(() => {
  vi.useRealTimers();
});

describe("BlessingWall hostMode（大螢幕）", () => {
  it("顯示標題與計數", () => {
    render(
      <BlessingWall
        config={{ title: "婚禮祝福牆", theme: "wedding" }}
        hostMode={true}
        state={{
          blessings: [
            { id: "b1", name: "小明", message: "新婚快樂", emoji: "💕", addedAt: Date.now() },
            { id: "b2", name: "小美", message: "百年好合", emoji: "💝", addedAt: Date.now() },
          ],
          recentFlying: [],
        }}
      />,
    );
    expect(screen.getByText("婚禮祝福牆")).toBeInTheDocument();
    expect(screen.getByText("收到 2 則祝福")).toBeInTheDocument();
  });

  it("飛翔層存在（hostMode）", () => {
    render(<BlessingWall config={{}} hostMode={true} />);
    expect(screen.getByTestId("blessing-fly-layer")).toBeInTheDocument();
  });

  it("沒 state 時 fallback 不 crash", () => {
    render(<BlessingWall config={{ title: "測試" }} hostMode={true} />);
    expect(screen.getByText("收到 0 則祝福")).toBeInTheDocument();
  });

  it("飛翔中的祝福 8 秒內顯示", () => {
    const now = Date.now();
    render(
      <BlessingWall
        config={{}}
        hostMode={true}
        state={{
          blessings: [],
          recentFlying: [
            { id: "f1", name: "Alice", message: "Hello!", emoji: "🌟", x: 50, addedAt: now, startedAt: now },
          ],
        }}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Hello!")).toBeInTheDocument();
  });
});

describe("BlessingWall 玩家端（手機）", () => {
  it("顯示輸入表單", () => {
    render(<BlessingWall config={{}} hostMode={false} />);
    expect(screen.getByTestId("blessing-name")).toBeInTheDocument();
    expect(screen.getByTestId("blessing-message")).toBeInTheDocument();
    expect(screen.getByTestId("blessing-submit")).toBeInTheDocument();
  });

  it("預設 emoji 選擇 8 個按鈕", () => {
    render(<BlessingWall config={{}} hostMode={false} />);
    expect(screen.getByTestId("blessing-emoji-💕")).toBeInTheDocument();
    expect(screen.getByTestId("blessing-emoji-🎂")).toBeInTheDocument();
  });

  it("自訂 emojis", () => {
    render(<BlessingWall config={{ emojis: ["🚀", "💎"] }} hostMode={false} />);
    expect(screen.getByTestId("blessing-emoji-🚀")).toBeInTheDocument();
    expect(screen.queryByTestId("blessing-emoji-💕")).not.toBeInTheDocument();
  });

  it("名字 / 訊息空時 submit disabled", () => {
    render(<BlessingWall config={{}} hostMode={false} />);
    const btn = screen.getByTestId("blessing-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("填好名字 + 訊息可送出", () => {
    const onPulse = vi.fn();
    render(<BlessingWall config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.change(screen.getByTestId("blessing-name"), { target: { value: "小明" } });
    fireEvent.change(screen.getByTestId("blessing-message"), { target: { value: "祝你幸福" } });
    fireEvent.click(screen.getByTestId("blessing-submit"));
    expect(onPulse).toHaveBeenCalledWith("blessing", expect.objectContaining({
      name: "小明",
      message: "祝你幸福",
    }));
  });

  it("3 秒內第二次提交被 throttle", () => {
    const onPulse = vi.fn();
    render(<BlessingWall config={{}} hostMode={false} onPulse={onPulse} />);
    fireEvent.change(screen.getByTestId("blessing-name"), { target: { value: "A" } });
    fireEvent.change(screen.getByTestId("blessing-message"), { target: { value: "X" } });
    fireEvent.click(screen.getByTestId("blessing-submit"));
    // 立刻第二次（應該 throttle）
    fireEvent.click(screen.getByTestId("blessing-submit"));
    expect(onPulse).toHaveBeenCalledTimes(1);
  });

  it("maxLength 限制訊息長度", () => {
    render(<BlessingWall config={{ maxLength: 10 }} hostMode={false} />);
    const textarea = screen.getByTestId("blessing-message") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "12345678901234567890" } });
    expect(textarea.value.length).toBeLessThanOrEqual(10);
  });

  it("選 emoji 後 selectedEmoji 更新", () => {
    const onPulse = vi.fn();
    render(<BlessingWall config={{ emojis: ["🌟", "✨"] }} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("blessing-emoji-✨"));
    fireEvent.change(screen.getByTestId("blessing-name"), { target: { value: "T" } });
    fireEvent.change(screen.getByTestId("blessing-message"), { target: { value: "M" } });
    fireEvent.click(screen.getByTestId("blessing-submit"));
    expect(onPulse).toHaveBeenCalledWith("blessing", expect.objectContaining({ emoji: "✨" }));
  });

  it("主題 wedding 應用對應樣式（class 包含 rose）", () => {
    const { container } = render(<BlessingWall config={{ theme: "wedding" }} hostMode={false} />);
    expect(container.innerHTML).toContain("rose");
  });
});
