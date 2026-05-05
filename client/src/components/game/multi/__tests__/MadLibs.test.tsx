import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MadLibs from "../MadLibs";
import type { MadLibsConfig, MadLibsState } from "../MadLibs";

const defaultConfig: MadLibsConfig = {
  title: "🎭 瘋狂故事",
  story: "今天 {hero} 遇見了 {animal}，大家都笑了",
  blanks: [
    { id: "hero", label: "主角名字", hint: "人名" },
    { id: "animal", label: "動物", hint: "任意動物" },
  ],
  revealWhenFull: true,
};

const emptyState: MadLibsState = { fills: [], revealed: false };

const fill1 = { blankId: "hero", value: "阿明", filledBy: "u1", filledByName: "Alice", filledAt: 1000 };
const fill2 = { blankId: "animal", value: "企鵝", filledBy: "u2", filledByName: "Bob", filledAt: 2000 };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  myUserName: "Alice",
  draftValue: "",
  selectedBlankId: null as string | null,
  onSelectBlank: vi.fn(),
  onDraftChange: vi.fn(),
  onFill: vi.fn(),
  onReveal: vi.fn(),
};

describe("MadLibs", () => {
  it("顯示標題", () => {
    render(<MadLibs {...mockProps} />);
    expect(screen.getByTestId("ml-title")).toHaveTextContent("瘋狂故事");
  });

  it("顯示填空進度", () => {
    render(<MadLibs {...mockProps} />);
    expect(screen.getByTestId("ml-fill-count")).toHaveTextContent("0 / 2");
  });

  it("顯示所有空格項目", () => {
    render(<MadLibs {...mockProps} />);
    expect(screen.getByTestId("ml-blank-hero")).toBeInTheDocument();
    expect(screen.getByTestId("ml-blank-animal")).toBeInTheDocument();
  });

  it("空格顯示填入按鈕", () => {
    render(<MadLibs {...mockProps} />);
    expect(screen.getByTestId("ml-claim-hero")).toBeInTheDocument();
  });

  it("點擊填入呼叫 onSelectBlank", () => {
    const onSelectBlank = vi.fn();
    render(<MadLibs {...mockProps} onSelectBlank={onSelectBlank} />);
    fireEvent.click(screen.getByTestId("ml-claim-hero"));
    expect(onSelectBlank).toHaveBeenCalledWith("hero");
  });

  it("選中空格時顯示輸入框", () => {
    render(<MadLibs {...mockProps} selectedBlankId="hero" />);
    expect(screen.getByTestId("ml-input-area-hero")).toBeInTheDocument();
    expect(screen.getByTestId("ml-input-hero")).toBeInTheDocument();
  });

  it("輸入框變化呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<MadLibs {...mockProps} selectedBlankId="hero" onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("ml-input-hero"), { target: { value: "阿明" } });
    expect(onDraftChange).toHaveBeenCalledWith("阿明");
  });

  it("無草稿時確認按鈕 disabled", () => {
    render(<MadLibs {...mockProps} selectedBlankId="hero" draftValue="" />);
    expect(screen.getByTestId("ml-confirm-hero")).toBeDisabled();
  });

  it("有草稿時確認按鈕啟用並呼叫 onFill", () => {
    const onFill = vi.fn();
    render(<MadLibs {...mockProps} selectedBlankId="hero" draftValue="阿明" onFill={onFill} />);
    fireEvent.click(screen.getByTestId("ml-confirm-hero"));
    expect(onFill).toHaveBeenCalledWith("hero", "阿明");
  });

  it("已填入的空格顯示 Lock 圖示（非自己填的）", () => {
    const state: MadLibsState = { fills: [fill1], revealed: false };
    render(<MadLibs {...mockProps} state={state} myUserId="u2" />);
    expect(screen.queryByTestId("ml-claim-hero")).not.toBeInTheDocument();
  });

  it("自己填的空格顯示內容", () => {
    const state: MadLibsState = { fills: [fill1], revealed: false };
    render(<MadLibs {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("ml-my-fill-hero")).toHaveTextContent("阿明");
  });

  it("填空進度更新", () => {
    const state: MadLibsState = { fills: [fill1], revealed: false };
    render(<MadLibs {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-fill-count")).toHaveTextContent("1 / 2");
  });

  it("全部填完後顯示揭曉按鈕", () => {
    const state: MadLibsState = { fills: [fill1, fill2], revealed: false };
    render(<MadLibs {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-reveal-btn")).toBeInTheDocument();
  });

  it("未全部填完不顯示揭曉按鈕", () => {
    const state: MadLibsState = { fills: [fill1], revealed: false };
    render(<MadLibs {...mockProps} state={state} />);
    expect(screen.queryByTestId("ml-reveal-btn")).not.toBeInTheDocument();
  });

  it("點擊揭曉呼叫 onReveal", () => {
    const onReveal = vi.fn();
    const state: MadLibsState = { fills: [fill1, fill2], revealed: false };
    render(<MadLibs {...mockProps} state={state} onReveal={onReveal} />);
    fireEvent.click(screen.getByTestId("ml-reveal-btn"));
    expect(onReveal).toHaveBeenCalled();
  });

  it("揭曉後顯示完整故事", () => {
    const state: MadLibsState = { fills: [fill1, fill2], revealed: true };
    render(<MadLibs {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-story-revealed")).toBeInTheDocument();
    expect(screen.getByTestId("ml-story-text")).toBeInTheDocument();
  });

  it("揭曉後故事包含填入的詞", () => {
    const state: MadLibsState = { fills: [fill1, fill2], revealed: true };
    render(<MadLibs {...mockProps} state={state} />);
    const storyText = screen.getByTestId("ml-story-text");
    expect(storyText.textContent).toContain("阿明");
    expect(storyText.textContent).toContain("企鵝");
  });

  it("揭曉後顯示填詞者名單", () => {
    const state: MadLibsState = { fills: [fill1, fill2], revealed: true };
    render(<MadLibs {...mockProps} state={state} />);
    expect(screen.getByTestId("ml-credits")).toBeInTheDocument();
    expect(screen.getByTestId("ml-credit-hero")).toHaveTextContent("Alice");
    expect(screen.getByTestId("ml-credit-animal")).toHaveTextContent("Bob");
  });

  it("尚未填完顯示等待提示", () => {
    render(<MadLibs {...mockProps} />);
    expect(screen.getByTestId("ml-waiting-hint")).toBeInTheDocument();
  });
});
