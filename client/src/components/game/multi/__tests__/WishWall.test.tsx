import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import WishWall from "../WishWall";
import type { WishWallConfig, WishWallState, WishCard } from "../WishWall";

const defaultConfig: WishWallConfig = {
  title: "💌 祝福牆",
  recipientName: "小明",
  prompt: "寫下你的祝福",
  maxLength: 100,
  showAuthor: true,
};

const emptyState: WishWallState = { wishes: [] };

const mockOnSubmit = vi.fn(() => Promise.resolve());

const sampleWish: WishCard = {
  id: "w1",
  userId: "other-user",
  userName: "老王",
  message: "祝你生日快樂！",
  emoji: "🎉",
  submittedAt: Date.now() - 1000,
};

describe("WishWall", () => {
  it("顯示標題", () => {
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-wall-title")).toHaveTextContent("💌 祝福牆");
  });

  it("顯示收件人名稱", () => {
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-recipient")).toHaveTextContent("小明");
  });

  it("顯示 8 個 emoji 選項", () => {
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("emoji-btn-💌")).toBeInTheDocument();
    expect(screen.getByTestId("emoji-btn-🎉")).toBeInTheDocument();
    expect(screen.getByTestId("emoji-btn-💖")).toBeInTheDocument();
  });

  it("送出按鈕初始停用（無輸入）", () => {
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-submit-btn")).toBeDisabled();
  });

  it("輸入後送出按鈕啟用", () => {
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    fireEvent.change(screen.getByTestId("wish-input"), { target: { value: "恭喜你！" } });
    expect(screen.getByTestId("wish-submit-btn")).not.toBeDisabled();
  });

  it("點擊送出後呼叫 onSubmit", async () => {
    const onSubmit = vi.fn(() => Promise.resolve());
    render(<WishWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onSubmit={onSubmit} />);
    fireEvent.change(screen.getByTestId("wish-input"), { target: { value: "恭喜你！" } });
    fireEvent.click(screen.getByTestId("wish-submit-btn"));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("恭喜你！", expect.any(String));
    });
  });

  it("已送出時顯示感謝畫面", () => {
    const myWish: WishCard = { id: "w2", userId: "u1", userName: "我", message: "感謝有你！", emoji: "💖", submittedAt: Date.now() };
    const state: WishWallState = { wishes: [myWish] };
    render(<WishWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-submitted")).toBeInTheDocument();
    expect(screen.getByTestId("wish-submitted")).toHaveTextContent("感謝有你！");
  });

  it("已送出時不再顯示輸入框", () => {
    const myWish: WishCard = { id: "w2", userId: "u1", userName: "我", message: "感謝！", emoji: "💌", submittedAt: Date.now() };
    const state: WishWallState = { wishes: [myWish] };
    render(<WishWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.queryByTestId("wish-input")).not.toBeInTheDocument();
  });

  it("顯示他人的祝福卡片", () => {
    const state: WishWallState = { wishes: [sampleWish] };
    render(<WishWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-card-w1")).toBeInTheDocument();
    expect(screen.getByTestId("wish-card-w1")).toHaveTextContent("祝你生日快樂！");
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    const state: WishWallState = { wishes: [sampleWish] };
    render(<WishWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-card-w1")).toHaveTextContent("老王");
  });

  it("showAuthor=false 隱藏作者名稱", () => {
    const state: WishWallState = { wishes: [sampleWish] };
    const cfg = { ...defaultConfig, showAuthor: false };
    render(<WishWall config={cfg} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.queryByText(/— 老王/)).not.toBeInTheDocument();
  });

  it("顯示祝福數量徽章", () => {
    const state: WishWallState = { wishes: [sampleWish] };
    render(<WishWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.getByTestId("wish-count")).toHaveTextContent("1 則祝福");
  });

  it("無收件人時不顯示收件人區塊", () => {
    const cfg: WishWallConfig = { title: "祝福牆" };
    render(<WishWall config={cfg} state={emptyState} myUserId="u1" myUserName="我" onSubmit={mockOnSubmit} />);
    expect(screen.queryByTestId("wish-recipient")).not.toBeInTheDocument();
  });
});
