import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PersonalCompass, { PersonalCompassConfig, PersonalCompassState, CompassCard } from "../PersonalCompass";

const baseConfig: PersonalCompassConfig = {
  title: "個人指南針測試",
  northLabel: "N 優勢",
  southLabel: "S 挑戰",
  eastLabel: "E 機會",
  westLabel: "W 障礙",
};

const emptyState: PersonalCompassState = { cards: [], revealed: false };

const cards: CompassCard[] = [
  { cardId: "c1", userId: "u1", userName: "Alice", north: "溝通能力", south: "時間管理", east: "國際化", west: "資源不足" },
  { cardId: "c2", userId: "u2", userName: "Bob", north: "技術能力", south: "公開演說", east: "AI 趨勢", west: "競爭激烈" },
];

const revealedState: PersonalCompassState = { cards, revealed: true };

function renderPc(overrides: Partial<Parameters<typeof PersonalCompass>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<PersonalCompass {...props} />), props };
}

describe("PersonalCompass — 基本渲染", () => {
  it("顯示標題", () => {
    renderPc();
    expect(screen.getByTestId("pc-title")).toHaveTextContent("個人指南針測試");
  });

  it("顯示 N 方向輸入框", () => {
    renderPc();
    expect(screen.getByTestId("pc-north-input")).toBeInTheDocument();
  });

  it("顯示 S 方向輸入框", () => {
    renderPc();
    expect(screen.getByTestId("pc-south-input")).toBeInTheDocument();
  });

  it("顯示 E 方向輸入框", () => {
    renderPc();
    expect(screen.getByTestId("pc-east-input")).toBeInTheDocument();
  });

  it("顯示 W 方向輸入框", () => {
    renderPc();
    expect(screen.getByTestId("pc-west-input")).toBeInTheDocument();
  });

  it("未全部填寫時送出鈕 disabled", () => {
    renderPc();
    expect(screen.getByTestId("pc-submit-btn")).toBeDisabled();
  });

  it("顯示已填寫人數 0", () => {
    renderPc();
    expect(screen.getByTestId("pc-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderPc();
    expect(screen.getByTestId("pc-reveal-btn")).toBeInTheDocument();
  });
});

describe("PersonalCompass — 互動", () => {
  it("全部填寫後送出鈕可點", () => {
    renderPc();
    fireEvent.change(screen.getByTestId("pc-north-input"), { target: { value: "優" } });
    fireEvent.change(screen.getByTestId("pc-south-input"), { target: { value: "戰" } });
    fireEvent.change(screen.getByTestId("pc-east-input"), { target: { value: "機" } });
    fireEvent.change(screen.getByTestId("pc-west-input"), { target: { value: "礙" } });
    expect(screen.getByTestId("pc-submit-btn")).not.toBeDisabled();
  });

  it("點送出呼叫 onSubmit 帶四方向", () => {
    const onSubmit = vi.fn();
    renderPc({ onSubmit });
    fireEvent.change(screen.getByTestId("pc-north-input"), { target: { value: "強項A" } });
    fireEvent.change(screen.getByTestId("pc-south-input"), { target: { value: "弱項B" } });
    fireEvent.change(screen.getByTestId("pc-east-input"), { target: { value: "機會C" } });
    fireEvent.change(screen.getByTestId("pc-west-input"), { target: { value: "障礙D" } });
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith("強項A", "弱項B", "機會C", "障礙D");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderPc({ onReveal });
    fireEvent.click(screen.getByTestId("pc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已填寫者顯示 pc-my-card", () => {
    const myCard: CompassCard = { cardId: "c99", userId: "u4", userName: "David", north: "a", south: "b", east: "c", west: "d" };
    renderPc({ state: { cards: [myCard], revealed: false } });
    expect(screen.getByTestId("pc-my-card")).toBeInTheDocument();
  });

  it("已填寫者不顯示輸入框", () => {
    const myCard: CompassCard = { cardId: "c99", userId: "u4", userName: "David", north: "a", south: "b", east: "c", west: "d" };
    renderPc({ state: { cards: [myCard], revealed: false } });
    expect(screen.queryByTestId("pc-north-input")).not.toBeInTheDocument();
  });

  it("顯示已填寫人數 2", () => {
    renderPc({ state: { cards, revealed: false } });
    expect(screen.getByTestId("pc-count")).toHaveTextContent("2");
  });
});

describe("PersonalCompass — 公布結果", () => {
  it("公布後顯示 pc-result", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-result")).toBeInTheDocument();
  });

  it("顯示所有指南針卡片", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-card-c1")).toBeInTheDocument();
    expect(screen.getByTestId("pc-card-c2")).toBeInTheDocument();
  });

  it("卡片顯示用戶名和四方向內容", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-card-c1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("pc-card-c1")).toHaveTextContent("溝通能力");
  });

  it("無人填寫顯示 pc-empty", () => {
    renderPc({ state: { cards: [], revealed: true } });
    expect(screen.getByTestId("pc-empty")).toBeInTheDocument();
  });
});
