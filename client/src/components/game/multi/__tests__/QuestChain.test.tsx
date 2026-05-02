import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QuestChain, {
  checkStationAnswer,
  calculateChainProgress,
} from "../QuestChain";

const sampleConfig = {
  title: "金門 5 站",
  stations: [
    { id: "s1", label: "後浦小鎮入口", puzzle: "輸入正確答案", answer: "金門" },
    { id: "s2", label: "模範街", puzzle: "輸入答案", answer: "模範" },
    { id: "s3", label: "邱良功母節孝坊", puzzle: "輸入", answer: "節孝" },
  ],
};

describe("QuestChain", () => {
  it("顯示標題 + 進度", () => {
    render(
      <QuestChain
        config={sampleConfig}
        currentIndex={1}
        completedIds={["s1"]}
        failureCount={{}}
        onSubmitAnswer={() => {}}
      />,
    );
    expect(screen.getByText(/金門 5 站/)).toBeInTheDocument();
    expect(screen.getByText(/進度 1 \/ 3/)).toBeInTheDocument();
  });

  it("已完成站點顯示 ✅、鎖住站點顯示 🔒", () => {
    render(
      <QuestChain
        config={sampleConfig}
        currentIndex={1}
        completedIds={["s1"]}
        failureCount={{}}
        onSubmitAnswer={() => {}}
      />,
    );
    const s1 = screen.getByTestId("station-card-s1");
    const s3 = screen.getByTestId("station-card-s3");
    // s1 應有 emerald（completed）
    expect(s1.className).toMatch(/emerald/);
    // s3 應 opacity-60（locked）
    expect(s3.className).toMatch(/opacity-60/);
  });

  it("當前站顯示輸入框 + 送出按鈕", () => {
    render(
      <QuestChain
        config={sampleConfig}
        currentIndex={1}
        completedIds={["s1"]}
        failureCount={{}}
        onSubmitAnswer={() => {}}
      />,
    );
    expect(screen.getByTestId("input-station-s2")).toBeInTheDocument();
    expect(screen.getByTestId("btn-submit-station-s2")).toBeInTheDocument();
  });

  it("送出答案觸發 onSubmitAnswer", () => {
    const onSubmit = vi.fn();
    render(
      <QuestChain
        config={sampleConfig}
        currentIndex={0}
        completedIds={[]}
        failureCount={{}}
        onSubmitAnswer={onSubmit}
      />,
    );
    const input = screen.getByTestId("input-station-s1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "金門" } });
    fireEvent.click(screen.getByTestId("btn-submit-station-s1"));
    expect(onSubmit).toHaveBeenCalledWith("s1", "金門");
  });

  it("達 hintAfterFailures 顯示 hint", () => {
    const config = {
      ...sampleConfig,
      stations: [{ id: "s1", label: "test", puzzle: "?", answer: "X", hint: "提示文字" }],
      hintAfterFailures: 2,
    };
    render(
      <QuestChain
        config={config}
        currentIndex={0}
        completedIds={[]}
        failureCount={{ s1: 2 }}
        onSubmitAnswer={() => {}}
      />,
    );
    expect(screen.getByText(/提示文字/)).toBeInTheDocument();
  });

  it("全部完成顯示獎勵 banner + onComplete 按鈕", () => {
    const onComplete = vi.fn();
    render(
      <QuestChain
        config={{ ...sampleConfig, rewardOnComplete: "金牌" }}
        currentIndex={3}
        completedIds={["s1", "s2", "s3"]}
        failureCount={{}}
        onSubmitAnswer={() => {}}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText(/全部完成/)).toBeInTheDocument();
    expect(screen.getByText(/金牌/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("btn-quest-complete"));
    expect(onComplete).toHaveBeenCalled();
  });

  it("checkStationAnswer 比對 normalize 後相等", () => {
    const station = { id: "s", label: "", puzzle: "", answer: "金門" };
    expect(checkStationAnswer(station, "金門")).toBe(true);
    expect(checkStationAnswer(station, "  金門  ")).toBe(true); // normalize trim
    expect(checkStationAnswer(station, "其他")).toBe(false);
  });

  it("checkStationAnswer 大小寫不敏感", () => {
    const station = { id: "s", label: "", puzzle: "", answer: "Hello" };
    expect(checkStationAnswer(station, "hello")).toBe(true);
    expect(checkStationAnswer(station, "HELLO")).toBe(true);
  });

  it("checkStationAnswer 無 answer 時任何答案都過", () => {
    const station = { id: "s", label: "", puzzle: "" };
    expect(checkStationAnswer(station, "anything")).toBe(true);
    expect(checkStationAnswer(station, "")).toBe(true);
  });

  it("calculateChainProgress 計算百分比", () => {
    expect(calculateChainProgress([], 5)).toBe(0);
    expect(calculateChainProgress(["a", "b"], 5)).toBe(40);
    expect(calculateChainProgress(["a", "b", "c", "d", "e"], 5)).toBe(100);
    expect(calculateChainProgress(["a"], 0)).toBe(0); // div by 0 防護
  });

  it("無 stations 顯示 fallback 訊息", () => {
    render(
      <QuestChain
        config={{ stations: [] }}
        currentIndex={0}
        completedIds={[]}
        failureCount={{}}
        onSubmitAnswer={() => {}}
      />,
    );
    expect(screen.getByText(/尚未設定站點/)).toBeInTheDocument();
  });
});
