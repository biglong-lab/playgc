import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GroupContract, { GroupContractConfig, GroupContractState, ContractRule } from "../GroupContract";

const baseConfig: GroupContractConfig = {
  title: "共識公約",
  prompt: "提出一條規則",
  maxRuleLength: 30,
  topN: 2,
};

const submitState: GroupContractState = { rules: [], phase: "submit" };

const rules: ContractRule[] = [
  { ruleId: "r1", userId: "u1", userName: "Alice", text: "尊重每個人", votes: ["u2", "u3"] },
  { ruleId: "r2", userId: "u2", userName: "Bob", text: "準時出席", votes: ["u1"] },
  { ruleId: "r3", userId: "u3", userName: "Carol", text: "積極發言", votes: [] },
];

const voteState: GroupContractState = { rules, phase: "vote" };
const resultState: GroupContractState = { rules, phase: "result" };

function renderGc(overrides: Partial<Parameters<typeof GroupContract>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: submitState,
    myUserId: "u1",
    onSubmitRule: vi.fn(),
    onVote: vi.fn(),
    onAdvancePhase: vi.fn(),
    ...overrides,
  };
  return { ...render(<GroupContract {...props} />), props };
}

describe("GroupContract — 基本渲染", () => {
  it("顯示標題", () => {
    renderGc();
    expect(screen.getByTestId("gc-title")).toHaveTextContent("共識公約");
  });

  it("顯示提示語", () => {
    renderGc();
    expect(screen.getByTestId("gc-prompt")).toHaveTextContent("提出一條規則");
  });

  it("顯示提案數量", () => {
    renderGc();
    expect(screen.getByTestId("gc-rule-count")).toBeInTheDocument();
  });

  it("顯示目前階段", () => {
    renderGc();
    expect(screen.getByTestId("gc-phase")).toHaveTextContent("提案");
  });
});

describe("GroupContract — 提案階段", () => {
  it("空白時送出鈕 disabled", () => {
    renderGc();
    expect(screen.getByTestId("gc-submit-btn")).toBeDisabled();
  });

  it("有內容時送出鈕可點", () => {
    renderGc();
    fireEvent.change(screen.getByTestId("gc-rule-input"), {
      target: { value: "保持互相尊重" },
    });
    expect(screen.getByTestId("gc-submit-btn")).not.toBeDisabled();
  });

  it("超過 maxRuleLength 顯示錯誤", () => {
    renderGc({ config: { ...baseConfig, maxRuleLength: 5 } });
    fireEvent.change(screen.getByTestId("gc-rule-input"), {
      target: { value: "超過五個字的規則" },
    });
    expect(screen.getByTestId("gc-rule-error")).toBeInTheDocument();
  });

  it("點送出呼叫 onSubmitRule", () => {
    const onSubmitRule = vi.fn();
    renderGc({ onSubmitRule });
    fireEvent.change(screen.getByTestId("gc-rule-input"), {
      target: { value: "保持禮貌" },
    });
    fireEvent.click(screen.getByTestId("gc-submit-btn"));
    expect(onSubmitRule).toHaveBeenCalledWith("保持禮貌");
  });

  it("已送出顯示 gc-submitted-msg", () => {
    renderGc({
      state: {
        rules: [{ ruleId: "r1", userId: "u1", userName: "Alice", text: "尊重", votes: [] }],
        phase: "submit",
      },
      myUserId: "u1",
    });
    expect(screen.getByTestId("gc-submitted-msg")).toBeInTheDocument();
  });

  it("點進入投票呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderGc({ onAdvancePhase });
    fireEvent.click(screen.getByTestId("gc-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("GroupContract — 投票階段", () => {
  it("顯示投票階段標籤", () => {
    renderGc({ state: voteState });
    expect(screen.getByTestId("gc-phase")).toHaveTextContent("投票");
  });

  it("每條規則都有投票按鈕", () => {
    renderGc({ state: voteState });
    expect(screen.getByTestId("gc-vote-btn-r1")).toBeInTheDocument();
    expect(screen.getByTestId("gc-vote-btn-r2")).toBeInTheDocument();
  });

  it("點投票按鈕呼叫 onVote", () => {
    const onVote = vi.fn();
    renderGc({ state: voteState, onVote });
    fireEvent.click(screen.getByTestId("gc-vote-btn-r2"));
    expect(onVote).toHaveBeenCalledWith("r2");
  });

  it("自己的規則投票鈕 disabled", () => {
    renderGc({ state: voteState, myUserId: "u1" });
    expect(screen.getByTestId("gc-vote-btn-r1")).toBeDisabled();
  });

  it("已投票的按鈕顯示已投", () => {
    renderGc({ state: voteState, myUserId: "u2" });
    expect(screen.getByTestId("gc-vote-btn-r1")).toHaveTextContent("✓ 已投");
  });

  it("點確立公約呼叫 onAdvancePhase", () => {
    const onAdvancePhase = vi.fn();
    renderGc({ state: voteState, onAdvancePhase });
    fireEvent.click(screen.getByTestId("gc-advance-btn"));
    expect(onAdvancePhase).toHaveBeenCalledTimes(1);
  });
});

describe("GroupContract — 結果階段", () => {
  it("顯示公約確立標籤", () => {
    renderGc({ state: resultState });
    expect(screen.getByTestId("gc-phase")).toHaveTextContent("公約");
  });

  it("顯示所有規則", () => {
    renderGc({ state: resultState });
    expect(screen.getByTestId("gc-result-rule-r1")).toBeInTheDocument();
    expect(screen.getByTestId("gc-result-rule-r2")).toBeInTheDocument();
    expect(screen.getByTestId("gc-result-rule-r3")).toBeInTheDocument();
  });

  it("得票前 topN 條標記為 adopted", () => {
    renderGc({ state: resultState });
    expect(screen.getByTestId("gc-adopted-r1")).toBeInTheDocument();
    expect(screen.getByTestId("gc-adopted-r2")).toBeInTheDocument();
    expect(screen.queryByTestId("gc-adopted-r3")).not.toBeInTheDocument();
  });

  it("無規則時顯示 gc-empty", () => {
    renderGc({ state: { rules: [], phase: "result" } });
    expect(screen.getByTestId("gc-empty")).toBeInTheDocument();
  });
});
