import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PollLive from "../PollLive";

const baseConfig = {
  question: "你最喜歡哪個古蹟？",
  options: [
    { id: "a", label: "後浦老街" },
    { id: "b", label: "賈村" },
    { id: "c", label: "古寧頭" },
  ],
};

describe("PollLive — hostMode 大螢幕版型", () => {
  it("顯示題目 + 副標", () => {
    render(<PollLive config={{ ...baseConfig, subtitle: "請投票" }} hostMode={true} />);
    expect(screen.getByText("你最喜歡哪個古蹟？")).toBeInTheDocument();
    expect(screen.getByText("請投票")).toBeInTheDocument();
  });

  it("初始 0 票時顯示「投票進行中」", () => {
    render(<PollLive config={baseConfig} hostMode={true} />);
    expect(screen.getByText(/投票進行中/)).toBeInTheDocument();
  });

  it("有 state 時顯示票數 + 比例", () => {
    render(
      <PollLive
        config={baseConfig}
        hostMode={true}
        state={{
          question: baseConfig.question,
          options: baseConfig.options,
          votes: { a: 30, b: 50, c: 20 },
          totalVotes: 100,
          status: "open",
          revealResults: false,
        }}
      />,
    );
    // 兩個 30 — 一個是票數一個是百分比，用 getAllByText
    expect(screen.getAllByText(/30/).length).toBeGreaterThan(0);
    expect(screen.getByText("100")).toBeInTheDocument(); // 總票數
  });

  it("status='closed' 時顯示「投票已結束」", () => {
    render(
      <PollLive
        config={baseConfig}
        hostMode={true}
        state={{
          question: baseConfig.question,
          options: baseConfig.options,
          votes: { a: 0, b: 0, c: 0 },
          totalVotes: 0,
          status: "closed",
          revealResults: false,
        }}
      />,
    );
    expect(screen.getByText(/投票已結束/)).toBeInTheDocument();
  });
});

describe("PollLive — 玩家端版型", () => {
  it("顯示所有選項按鈕", () => {
    render(<PollLive config={baseConfig} hostMode={false} />);
    expect(screen.getByTestId("btn-poll-option-a")).toBeInTheDocument();
    expect(screen.getByTestId("btn-poll-option-b")).toBeInTheDocument();
    expect(screen.getByTestId("btn-poll-option-c")).toBeInTheDocument();
  });

  it("點擊選項時觸發 onPulse", () => {
    const onPulse = vi.fn();
    render(<PollLive config={baseConfig} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-poll-option-b"));
    expect(onPulse).toHaveBeenCalledWith("vote", { optionId: "b" });
  });

  it("一票後不允許再投（預設 allowChangeVote=false）", () => {
    const onPulse = vi.fn();
    render(<PollLive config={baseConfig} hostMode={false} onPulse={onPulse} />);
    fireEvent.click(screen.getByTestId("btn-poll-option-a"));
    fireEvent.click(screen.getByTestId("btn-poll-option-b"));
    expect(onPulse).toHaveBeenCalledTimes(1); // 第二次被擋
    expect(onPulse).toHaveBeenCalledWith("vote", { optionId: "a" });
  });

  it("allowChangeVote=true 時可改票", () => {
    const onPulse = vi.fn();
    render(
      <PollLive
        config={{ ...baseConfig, allowChangeVote: true }}
        hostMode={false}
        onPulse={onPulse}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-poll-option-a"));
    fireEvent.click(screen.getByTestId("btn-poll-option-b"));
    expect(onPulse).toHaveBeenCalledTimes(2);
  });

  it("status='closed' 時不可投票", () => {
    const onPulse = vi.fn();
    render(
      <PollLive
        config={baseConfig}
        hostMode={false}
        onPulse={onPulse}
        state={{
          question: baseConfig.question,
          options: baseConfig.options,
          votes: { a: 0, b: 0, c: 0 },
          totalVotes: 0,
          status: "closed",
          revealResults: false,
        }}
      />,
    );
    fireEvent.click(screen.getByTestId("btn-poll-option-a"));
    expect(onPulse).not.toHaveBeenCalled();
  });

  it("revealed 時顯示票數 + 百分比", () => {
    render(
      <PollLive
        config={baseConfig}
        hostMode={false}
        state={{
          question: baseConfig.question,
          options: baseConfig.options,
          votes: { a: 5, b: 3, c: 2 },
          totalVotes: 10,
          status: "revealed",
          revealResults: true,
        }}
      />,
    );
    // 揭曉時每個選項按鈕內會有 count + 百分比
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument();
  });
});
