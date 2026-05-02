import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TreasureHunt from "../TreasureHunt";

const sampleConfig = {
  title: "藏寶尋找",
  finalReward: "🏆 800",
  clues: [
    { id: "c1", prompt: "金門特產？", answer: "貢糖", reward: "8" },
    { id: "c2", prompt: "金門最大島？", answer: "大金門", reward: "0" },
    { id: "c3", prompt: "823 紀念什麼？", answer: "砲戰", reward: "0" },
  ],
};

describe("TreasureHunt", () => {
  it("顯示標題 + 全部線索（鎖頭）", () => {
    render(
      <TreasureHunt config={sampleConfig} state={{ unlockedClueIds: [] }} onUnlockClue={() => {}} />,
    );
    expect(screen.getByText("藏寶尋找")).toBeInTheDocument();
    expect(screen.getByText("金門特產？")).toBeInTheDocument();
    expect(screen.getByText("金門最大島？")).toBeInTheDocument();
  });

  it("點線索進入答題模式", () => {
    render(
      <TreasureHunt config={sampleConfig} state={{ unlockedClueIds: [] }} onUnlockClue={() => {}} />,
    );
    fireEvent.click(screen.getByTestId("btn-clue-c1"));
    expect(screen.getByText(/線索：金門特產/)).toBeInTheDocument();
    expect(screen.getByTestId("input-treasure-answer")).toBeInTheDocument();
  });

  it("答對觸發 onUnlockClue", () => {
    const onUnlock = vi.fn();
    render(
      <TreasureHunt config={sampleConfig} state={{ unlockedClueIds: [] }} onUnlockClue={onUnlock} />,
    );
    fireEvent.click(screen.getByTestId("btn-clue-c1"));
    fireEvent.change(screen.getByTestId("input-treasure-answer"), { target: { value: "貢糖" } });
    fireEvent.click(screen.getByTestId("btn-submit-answer"));
    expect(onUnlock).toHaveBeenCalledWith("c1");
  });

  it("答錯顯示錯誤訊息", () => {
    const onUnlock = vi.fn();
    render(
      <TreasureHunt config={sampleConfig} state={{ unlockedClueIds: [] }} onUnlockClue={onUnlock} />,
    );
    fireEvent.click(screen.getByTestId("btn-clue-c1"));
    fireEvent.change(screen.getByTestId("input-treasure-answer"), { target: { value: "錯的" } });
    fireEvent.click(screen.getByTestId("btn-submit-answer"));
    expect(screen.getByText(/再想想看/)).toBeInTheDocument();
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it("全部 unlocked → 揭曉畫面", () => {
    render(
      <TreasureHunt
        config={sampleConfig}
        state={{ unlockedClueIds: ["c1", "c2", "c3"] }}
        onUnlockClue={() => {}}
      />,
    );
    expect(screen.getByText("寶藏揭曉！")).toBeInTheDocument();
    expect(screen.getByText("🏆 800")).toBeInTheDocument();
  });

  it("答案不分大小寫 + 忽略空白", () => {
    const onUnlock = vi.fn();
    render(
      <TreasureHunt config={sampleConfig} state={{ unlockedClueIds: [] }} onUnlockClue={onUnlock} />,
    );
    fireEvent.click(screen.getByTestId("btn-clue-c1"));
    fireEvent.change(screen.getByTestId("input-treasure-answer"), { target: { value: " 貢糖 " } });
    fireEvent.click(screen.getByTestId("btn-submit-answer"));
    expect(onUnlock).toHaveBeenCalledWith("c1");
  });
});
