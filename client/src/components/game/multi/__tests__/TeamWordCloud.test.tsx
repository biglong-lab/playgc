import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TeamWordCloud from "../TeamWordCloud";
import type { TeamWordCloudConfig, TeamWordCloudState, WordEntry } from "../TeamWordCloud";

const config: TeamWordCloudConfig = {
  title: "團隊詞雲",
  question: "一個詞描述今天？",
  maxWordsPerPerson: 3,
  maxWordLength: 15,
};

const emptyState: TeamWordCloudState = { entries: [] };

const makeEntry = (userId: string, words: string[]): WordEntry => ({
  userId, userName: userId === "u1" ? "Alice" : "Bob",
  words, submittedAt: Date.now(),
});

describe("TeamWordCloud", () => {
  it("顯示標題", () => {
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-title")).toHaveTextContent("團隊詞雲");
  });

  it("顯示 question", () => {
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-question")).toHaveTextContent("一個詞描述今天？");
  });

  it("顯示 maxWordsPerPerson 個輸入框", () => {
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    for (let i = 1; i <= 3; i++) {
      expect(screen.getByTestId(`word-input-${i}`)).toBeInTheDocument();
    }
  });

  it("未輸入時送出按鈕禁用", () => {
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    const btn = screen.getByTestId("word-cloud-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("輸入後送出按鈕可用", () => {
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    fireEvent.change(screen.getByTestId("word-input-1"), { target: { value: "快樂" } });
    const btn = screen.getByTestId("word-cloud-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("點擊送出呼叫 onSubmit（只傳非空詞）", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByTestId("word-input-1"), { target: { value: "快樂" } });
    fireEvent.change(screen.getByTestId("word-input-2"), { target: { value: "活力" } });
    fireEvent.click(screen.getByTestId("word-cloud-submit-btn"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(["快樂", "活力"]));
  });

  it("已提交顯示感謝畫面", () => {
    const state: TeamWordCloudState = { entries: [makeEntry("u1", ["快樂", "充實"])] };
    render(
      <TeamWordCloud config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-submitted")).toBeInTheDocument();
    expect(screen.getAllByText("快樂").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("充實").length).toBeGreaterThanOrEqual(1);
  });

  it("有貢獻後顯示統計區塊", () => {
    const state: TeamWordCloudState = { entries: [makeEntry("u2", ["自由"])] };
    render(
      <TeamWordCloud config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-stats")).toBeInTheDocument();
  });

  it("顯示詞雲中的詞", () => {
    const state: TeamWordCloudState = { entries: [makeEntry("u2", ["自由", "快樂"])] };
    render(
      <TeamWordCloud config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("cloud-word-自由")).toBeInTheDocument();
    expect(screen.getByTestId("cloud-word-快樂")).toBeInTheDocument();
  });

  it("顯示貢獻人數 badge", () => {
    const state: TeamWordCloudState = { entries: [makeEntry("u2", ["自由"]), makeEntry("u3", ["積極"])] };
    render(
      <TeamWordCloud config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-count")).toHaveTextContent("2 人已貢獻");
  });

  it("相同詞出現多次頻率疊加", () => {
    const state: TeamWordCloudState = {
      entries: [makeEntry("u2", ["快樂"]), makeEntry("u3", ["快樂", "自由"])],
    };
    render(
      <TeamWordCloud config={config} state={state} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    // 快樂 出現 2 次（u2 + u3），應該出現在詞雲（不重複顯示）
    const cloudWord = screen.getByTestId("cloud-word-快樂");
    expect(cloudWord).toBeInTheDocument();
  });

  it("使用預設標題（無 title 設定）", () => {
    render(
      <TeamWordCloud config={{}} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId("word-cloud-title")).toHaveTextContent("🌐 團隊詞雲");
  });

  it("空白輸入不計入有效詞", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <TeamWordCloud config={config} state={emptyState} myUserId="u1" myUserName="Alice" onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByTestId("word-input-1"), { target: { value: "   " } });
    const btn = screen.getByTestId("word-cloud-submit-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
