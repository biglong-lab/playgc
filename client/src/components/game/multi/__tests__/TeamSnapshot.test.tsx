import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamSnapshot, { TeamSnapshotConfig, TeamSnapshotState, SnapshotCard } from "../TeamSnapshot";

const baseConfig: TeamSnapshotConfig = {
  title: "團隊快照測試",
  fields: ["開心的事", "擔心的事", "需要支援"],
  maxLength: 50,
};

const emptyState: TeamSnapshotState = { cards: [], revealed: false };

const cards: SnapshotCard[] = [
  {
    cardId: "c1",
    userId: "u1",
    userName: "Alice",
    answers: { "開心的事": "完成了專案", "擔心的事": "下週deadline", "需要支援": "需要文件幫助" },
  },
  {
    cardId: "c2",
    userId: "u2",
    userName: "Bob",
    answers: { "開心的事": "學了新技術", "擔心的事": "溝通問題", "需要支援": "不需要" },
  },
];

const revealedState: TeamSnapshotState = { cards, revealed: true };

function renderTsn(overrides: Partial<Parameters<typeof TeamSnapshot>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<TeamSnapshot {...props} />), props };
}

describe("TeamSnapshot — 基本渲染", () => {
  it("顯示標題", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-title")).toHaveTextContent("團隊快照測試");
  });

  it("顯示所有欄位標籤", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-field-0")).toHaveTextContent("開心的事");
    expect(screen.getByTestId("tsn-field-1")).toHaveTextContent("擔心的事");
    expect(screen.getByTestId("tsn-field-2")).toHaveTextContent("需要支援");
  });

  it("顯示所有輸入框", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-input-0")).toBeInTheDocument();
    expect(screen.getByTestId("tsn-input-1")).toBeInTheDocument();
    expect(screen.getByTestId("tsn-input-2")).toBeInTheDocument();
  });

  it("未全部填寫時送出鈕 disabled", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-submit-btn")).toBeDisabled();
  });

  it("顯示已提交人數 0", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderTsn();
    expect(screen.getByTestId("tsn-reveal-btn")).toBeInTheDocument();
  });
});

describe("TeamSnapshot — 互動", () => {
  it("全部填寫後送出鈕可點", () => {
    renderTsn();
    fireEvent.change(screen.getByTestId("tsn-input-0"), { target: { value: "開心" } });
    fireEvent.change(screen.getByTestId("tsn-input-1"), { target: { value: "擔心" } });
    fireEvent.change(screen.getByTestId("tsn-input-2"), { target: { value: "支援" } });
    expect(screen.getByTestId("tsn-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶所有欄位", () => {
    const onSubmit = vi.fn();
    renderTsn({ onSubmit });
    fireEvent.change(screen.getByTestId("tsn-input-0"), { target: { value: "很開心" } });
    fireEvent.change(screen.getByTestId("tsn-input-1"), { target: { value: "有點擔心" } });
    fireEvent.change(screen.getByTestId("tsn-input-2"), { target: { value: "需要資料" } });
    fireEvent.click(screen.getByTestId("tsn-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith({
      "開心的事": "很開心",
      "擔心的事": "有點擔心",
      "需要支援": "需要資料",
    });
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderTsn({ onReveal });
    fireEvent.click(screen.getByTestId("tsn-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已提交者顯示 tsn-my-card", () => {
    const myCard: SnapshotCard = {
      cardId: "c99",
      userId: "u4",
      userName: "David",
      answers: { "開心的事": "完成了", "擔心的事": "無", "需要支援": "無" },
    };
    renderTsn({ state: { cards: [myCard], revealed: false } });
    expect(screen.getByTestId("tsn-my-card")).toBeInTheDocument();
  });

  it("已提交者不顯示輸入框", () => {
    const myCard: SnapshotCard = {
      cardId: "c99",
      userId: "u4",
      userName: "David",
      answers: { "開心的事": "完成了", "擔心的事": "無", "需要支援": "無" },
    };
    renderTsn({ state: { cards: [myCard], revealed: false } });
    expect(screen.queryByTestId("tsn-input-0")).not.toBeInTheDocument();
  });

  it("顯示已提交人數 2", () => {
    renderTsn({ state: { cards, revealed: false } });
    expect(screen.getByTestId("tsn-count")).toHaveTextContent("2");
  });
});

describe("TeamSnapshot — 公布結果", () => {
  it("公布後顯示 tsn-result", () => {
    renderTsn({ state: revealedState });
    expect(screen.getByTestId("tsn-result")).toBeInTheDocument();
  });

  it("顯示所有快照卡片", () => {
    renderTsn({ state: revealedState });
    expect(screen.getByTestId("tsn-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("tsn-card-c2")).toBeInTheDocument();
  });

  it("卡片顯示用戶名和填寫內容", () => {
    renderTsn({ state: revealedState });
    expect(screen.getByTestId("tsn-card-c1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("tsn-card-c1")).toHaveTextContent("完成了專案");
  });

  it("無快照顯示 tsn-empty", () => {
    renderTsn({ state: { cards: [], revealed: true } });
    expect(screen.getByTestId("tsn-empty")).toBeInTheDocument();
  });
});
