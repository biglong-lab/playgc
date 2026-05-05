import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PhotoCaption from "../PhotoCaption";
import type { PhotoCaptionConfig, PhotoCaptionState } from "../PhotoCaption";

const defaultConfig: PhotoCaptionConfig = {
  title: "📸 最佳配文",
  photoUrl: "https://example.com/photo.jpg",
  prompt: "你的第一個念頭？",
  maxCaptionLength: 80,
  maxCaptionsPerPerson: 2,
  showVotes: true,
};

const emptyState: PhotoCaptionState = { captions: [] };

const cap1 = {
  id: "c1",
  text: "這就是人生",
  submitterId: "u1",
  submitterName: "Alice",
  votes: ["u2"],
  submittedAt: 1000,
};

const cap2 = {
  id: "c2",
  text: "週一的臉",
  submitterId: "u2",
  submitterName: "Bob",
  votes: [],
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  draftCaption: "",
  onDraftChange: vi.fn(),
  onSubmit: vi.fn(),
  onVote: vi.fn(),
};

describe("PhotoCaption", () => {
  it("顯示標題", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-title")).toHaveTextContent("最佳配文");
  });

  it("顯示提示文字", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-prompt")).toHaveTextContent("你的第一個念頭");
  });

  it("無提示時不顯示", () => {
    const config = { ...defaultConfig, prompt: undefined };
    render(<PhotoCaption {...mockProps} config={config} />);
    expect(screen.queryByTestId("pc-prompt")).not.toBeInTheDocument();
  });

  it("有 photoUrl 時顯示圖片", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-photo")).toBeInTheDocument();
  });

  it("無 photoUrl 時顯示佔位區", () => {
    const config = { ...defaultConfig, photoUrl: "" };
    render(<PhotoCaption {...mockProps} config={config} />);
    expect(screen.getByTestId("pc-photo-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("pc-photo")).not.toBeInTheDocument();
  });

  it("顯示輸入區域", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-input")).toBeInTheDocument();
  });

  it("輸入時呼叫 onDraftChange", () => {
    const onDraftChange = vi.fn();
    render(<PhotoCaption {...mockProps} onDraftChange={onDraftChange} />);
    fireEvent.change(screen.getByTestId("pc-input"), { target: { value: "測試配文" } });
    expect(onDraftChange).toHaveBeenCalledWith("測試配文");
  });

  it("空草稿時提交按鈕 disabled", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-submit-btn")).toBeDisabled();
  });

  it("有草稿時提交按鈕啟用", () => {
    render(<PhotoCaption {...mockProps} draftCaption="測試" />);
    expect(screen.getByTestId("pc-submit-btn")).not.toBeDisabled();
  });

  it("點擊提交呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<PhotoCaption {...mockProps} draftCaption="配文！" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("達上限時顯示提示並禁用輸入", () => {
    const state: PhotoCaptionState = {
      captions: [
        { ...cap1, id: "c1" },
        { ...cap1, id: "c2", text: "第二則" },
      ],
    };
    render(<PhotoCaption {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("pc-limit-msg")).toBeInTheDocument();
    expect(screen.getByTestId("pc-input")).toBeDisabled();
  });

  it("顯示配文數量", () => {
    const state: PhotoCaptionState = { captions: [cap1, cap2] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-count")).toHaveTextContent("2");
  });

  it("顯示所有配文", () => {
    const state: PhotoCaptionState = { captions: [cap1, cap2] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-caption-c1")).toBeInTheDocument();
    expect(screen.getByTestId("pc-caption-c2")).toBeInTheDocument();
  });

  it("顯示配文文字", () => {
    const state: PhotoCaptionState = { captions: [cap1] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-text-c1")).toHaveTextContent("這就是人生");
  });

  it("顯示提交者名稱", () => {
    const state: PhotoCaptionState = { captions: [cap1] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-by-c1")).toHaveTextContent("Alice");
  });

  it("顯示投票按鈕", () => {
    const state: PhotoCaptionState = { captions: [cap2] };
    render(<PhotoCaption {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("pc-vote-c2")).toBeInTheDocument();
  });

  it("不可以對自己的配文投票", () => {
    const state: PhotoCaptionState = { captions: [cap1] };
    render(<PhotoCaption {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("pc-vote-c1")).toBeDisabled();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const state: PhotoCaptionState = { captions: [cap2] };
    render(<PhotoCaption {...mockProps} state={state} myUserId="u1" onVote={onVote} />);
    fireEvent.click(screen.getByTestId("pc-vote-c2"));
    expect(onVote).toHaveBeenCalledWith("c2");
  });

  it("顯示得票數", () => {
    const state: PhotoCaptionState = { captions: [cap1] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-vote-count-c1")).toHaveTextContent("1");
  });

  it("最高票顯示桂冠標記", () => {
    const state: PhotoCaptionState = { captions: [cap1, cap2] };
    render(<PhotoCaption {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-top-c1")).toBeInTheDocument();
  });

  it("空列表顯示提示", () => {
    render(<PhotoCaption {...mockProps} />);
    expect(screen.getByTestId("pc-empty")).toBeInTheDocument();
  });

  it("showVotes=false 不顯示投票按鈕", () => {
    const config = { ...defaultConfig, showVotes: false };
    const state: PhotoCaptionState = { captions: [cap1] };
    render(<PhotoCaption {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("pc-vote-c1")).not.toBeInTheDocument();
  });
});
