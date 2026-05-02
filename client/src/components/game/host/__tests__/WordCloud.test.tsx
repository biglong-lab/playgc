import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import WordCloud, {
  buildInitialWordCloudState,
  calculateWordSize,
  getSortedWords,
} from "../WordCloud";

beforeEach(() => {
  vi.mocked(localStorage.getItem).mockReset();
});

describe("WordCloud", () => {
  it("hostMode 顯示標題 + 等待訊息（無詞）", () => {
    render(
      <WordCloud
        config={{ title: "婚禮新人特質" }}
        hostMode={true}
        state={buildInitialWordCloudState()}
      />,
    );
    expect(screen.getByText(/婚禮新人特質/)).toBeInTheDocument();
    expect(screen.getByText(/等待玩家送詞/)).toBeInTheDocument();
  });

  it("hostMode 顯示字雲（依詞頻字體大小不同）", () => {
    render(
      <WordCloud
        config={{}}
        hostMode={true}
        state={{
          wordCounts: { 美麗: 10, 善良: 3, 聰明: 1 },
          totalSubmissions: 14,
          recentWords: [],
          submitters: {},
        }}
      />,
    );
    expect(screen.getByTestId("word-美麗")).toBeInTheDocument();
    expect(screen.getByTestId("word-善良")).toBeInTheDocument();
    expect(screen.getByTestId("word-聰明")).toBeInTheDocument();
    // 詞頻 > 1 顯示 ×N
    expect(screen.getByText(/×10/)).toBeInTheDocument();
  });

  it("玩家端顯示 input + 送出按鈕", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    render(<WordCloud config={{}} hostMode={false} />);
    expect(screen.getByTestId("input-word")).toBeInTheDocument();
    expect(screen.getByTestId("btn-word-submit")).toBeInTheDocument();
  });

  it("玩家端 - 輸入並送出觸發 onPulse", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    const onPulse = vi.fn();
    render(<WordCloud config={{}} hostMode={false} onPulse={onPulse} />);
    const input = screen.getByTestId("input-word") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "可愛" } });
    fireEvent.click(screen.getByTestId("btn-word-submit"));
    expect(onPulse).toHaveBeenCalledWith("submit", { word: "可愛", userId: "Hung" });
  });

  it("玩家端 - 達上限後 input 與按鈕 disabled", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    render(
      <WordCloud
        config={{ maxWordsPerUser: 2 }}
        hostMode={false}
        state={{
          wordCounts: { test: 1 },
          totalSubmissions: 2,
          recentWords: [],
          submitters: { Hung: 2 },
        }}
      />,
    );
    const input = screen.getByTestId("input-word") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    const btn = screen.getByTestId("btn-word-submit") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn).toHaveTextContent(/已達上限/);
  });

  it("calculateWordSize 詞頻越多字越大", () => {
    expect(calculateWordSize(1)).toBe(32); // baseSize 24 + 8
    expect(calculateWordSize(3)).toBe(48); // 24 + 24
    expect(calculateWordSize(10)).toBe(96); // 24 + 72 (max)
    expect(calculateWordSize(100)).toBe(96); // 上限 96
  });

  it("getSortedWords 依詞頻降冪排序", () => {
    const sorted = getSortedWords({ A: 5, B: 1, C: 10 });
    expect(sorted[0].word).toBe("C");
    expect(sorted[0].count).toBe(10);
    expect(sorted[2].word).toBe("B");
    expect(sorted[2].count).toBe(1);
    // 含 size
    expect(sorted[0].size).toBe(96);
  });

  it("buildInitialWordCloudState 回傳乾淨初始狀態", () => {
    const state = buildInitialWordCloudState();
    expect(state.wordCounts).toEqual({});
    expect(state.totalSubmissions).toBe(0);
    expect(state.recentWords).toEqual([]);
    expect(state.submitters).toEqual({});
  });

  it("玩家端顯示熱詞 top 5", () => {
    vi.mocked(localStorage.getItem).mockReturnValue("Hung");
    render(
      <WordCloud
        config={{}}
        hostMode={false}
        state={{
          wordCounts: { A: 5, B: 4, C: 3, D: 2, E: 1, F: 1, G: 1 },
          totalSubmissions: 17,
          recentWords: [],
          submitters: { Hung: 0 },
        }}
      />,
    );
    expect(screen.getByText(/🔥 全場熱詞/)).toBeInTheDocument();
    // 顯示 top 5
    expect(screen.getByText(/A ×5/)).toBeInTheDocument();
    expect(screen.getByText(/E ×1/)).toBeInTheDocument();
  });
});
