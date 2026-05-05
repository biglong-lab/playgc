import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PhotoContest from "../PhotoContest";
import type { PhotoContestConfig, PhotoContestState } from "../PhotoContest";

const defaultConfig: PhotoContestConfig = {
  title: "📸 照片競賽",
  prompt: "上傳你的最佳作品！",
  theme: "最美金門一角",
  maxPhotosPerPerson: 2,
  allowVoteOwn: false,
  showAuthor: true,
  maxCaptionLength: 60,
};

const submitState: PhotoContestState = {
  entries: [],
  phase: "submit",
};

const e1 = {
  id: "e1",
  userId: "u1",
  userName: "Alice",
  caption: "金城老街黃昏",
  votes: ["u2", "u3"],
  submittedAt: 1000,
};

const e2 = {
  id: "e2",
  userId: "u2",
  userName: "Bob",
  caption: "翟山坑道的倒影",
  votes: ["u1"],
  submittedAt: 2000,
};

const mockProps = {
  config: defaultConfig,
  state: submitState,
  myUserId: "u1",
  draftCaption: "",
  draftImageUrl: "",
  onCaptionChange: vi.fn(),
  onImageUrlChange: vi.fn(),
  onSubmit: vi.fn(),
  onVote: vi.fn(),
};

describe("PhotoContest", () => {
  it("顯示標題", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-title")).toHaveTextContent("照片競賽");
  });

  it("顯示主題", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-theme")).toHaveTextContent("最美金門一角");
  });

  it("顯示提示語", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-prompt")).toHaveTextContent("上傳你的最佳作品！");
  });

  it("submit 階段顯示表單", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-submit-form")).toBeInTheDocument();
  });

  it("空白 caption 時送出按鈕 disabled", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-submit-btn")).toBeDisabled();
  });

  it("有 caption 時送出按鈕啟用", () => {
    render(<PhotoContest {...mockProps} draftCaption="我的作品" />);
    expect(screen.getByTestId("pc-submit-btn")).not.toBeDisabled();
  });

  it("輸入 caption 呼叫 onCaptionChange", () => {
    const onCaptionChange = vi.fn();
    render(<PhotoContest {...mockProps} onCaptionChange={onCaptionChange} />);
    fireEvent.change(screen.getByTestId("pc-caption-input"), { target: { value: "好照片" } });
    expect(onCaptionChange).toHaveBeenCalledWith("好照片");
  });

  it("點擊送出呼叫 onSubmit", () => {
    const onSubmit = vi.fn();
    render(<PhotoContest {...mockProps} draftCaption="好照片" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("無作品時顯示空狀態", () => {
    render(<PhotoContest {...mockProps} />);
    expect(screen.getByTestId("pc-empty")).toBeInTheDocument();
  });

  it("有作品時顯示列表", () => {
    const state: PhotoContestState = { entries: [e1, e2], phase: "submit" };
    render(<PhotoContest {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-entry-e1")).toBeInTheDocument();
    expect(screen.getByTestId("pc-entry-e2")).toBeInTheDocument();
  });

  it("顯示作品說明", () => {
    const state: PhotoContestState = { entries: [e1], phase: "submit" };
    render(<PhotoContest {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-caption-e1")).toHaveTextContent("金城老街黃昏");
  });

  it("顯示投票數", () => {
    const state: PhotoContestState = { entries: [e1], phase: "vote" };
    render(<PhotoContest {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-vote-count-e1")).toHaveTextContent("2");
  });

  it("submit 階段投票按鈕 disabled", () => {
    const state: PhotoContestState = { entries: [e2], phase: "submit" };
    render(<PhotoContest {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("pc-vote-btn-e2")).toBeDisabled();
  });

  it("vote 階段別人的作品投票可點", () => {
    const state: PhotoContestState = { entries: [e2], phase: "vote" };
    render(<PhotoContest {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("pc-vote-btn-e2")).not.toBeDisabled();
  });

  it("vote 階段自己的作品投票 disabled（allowVoteOwn=false）", () => {
    const state: PhotoContestState = { entries: [e1], phase: "vote" };
    render(<PhotoContest {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("pc-vote-btn-e1")).toBeDisabled();
  });

  it("點擊投票呼叫 onVote", () => {
    const onVote = vi.fn();
    const state: PhotoContestState = { entries: [e2], phase: "vote" };
    render(<PhotoContest {...mockProps} myUserId="u1" state={state} onVote={onVote} />);
    fireEvent.click(screen.getByTestId("pc-vote-btn-e2"));
    expect(onVote).toHaveBeenCalledWith("e2");
  });

  it("result 階段顯示排名", () => {
    const state: PhotoContestState = { entries: [e1, e2], phase: "result" };
    render(<PhotoContest {...mockProps} myUserId="u9" state={state} />);
    expect(screen.getByTestId("pc-rank-e1")).toHaveTextContent("1");
    expect(screen.getByTestId("pc-rank-e2")).toHaveTextContent("2");
  });

  it("result 階段顯示冠軍標誌", () => {
    const state: PhotoContestState = { entries: [e1, e2], phase: "result" };
    render(<PhotoContest {...mockProps} myUserId="u9" state={state} />);
    expect(screen.getByTestId("pc-winner-e1")).toBeInTheDocument();
  });

  it("達上限後顯示已達上限訊息並隱藏表單", () => {
    const myEntries = [
      { ...e1, id: "my1" },
      { ...e1, id: "my2" },
    ];
    const state: PhotoContestState = { entries: myEntries, phase: "submit" };
    render(<PhotoContest {...mockProps} myUserId="u1" state={state} />);
    expect(screen.getByTestId("pc-max-reached")).toBeInTheDocument();
    expect(screen.queryByTestId("pc-submit-form")).not.toBeInTheDocument();
  });

  it("顯示作者名稱", () => {
    const state: PhotoContestState = { entries: [e2], phase: "vote" };
    render(<PhotoContest {...mockProps} myUserId="u3" state={state} />);
    expect(screen.getByTestId("pc-author-e2")).toHaveTextContent("Bob");
  });

  it("vote 階段顯示投票進行中提示", () => {
    const state: PhotoContestState = { entries: [], phase: "vote" };
    render(<PhotoContest {...mockProps} state={state} />);
    expect(screen.getByTestId("pc-vote-phase-msg")).toBeInTheDocument();
  });
});
