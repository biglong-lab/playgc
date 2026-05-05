import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamContract from "../TeamContract";
import type { TeamContractConfig, TeamContractState } from "../TeamContract";

const defaultConfig: TeamContractConfig = {
  title: "📜 團隊承諾書",
  contractText: "我們承諾彼此尊重、積極合作，共同達成目標！",
  pledgeLabel: "我承諾！",
  showSigners: true,
  targetCount: 3,
  celebrationText: "全員完成簽署！",
};

const emptyState: TeamContractState = { signers: [] };

const signer1 = { userId: "u1", userName: "Alice", signedAt: 1000 };
const signer2 = { userId: "u2", userName: "Bob", signedAt: 2000 };
const signer3 = { userId: "u3", userName: "Carol", signedAt: 3000 };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onSign: vi.fn(),
};

describe("TeamContract", () => {
  it("顯示標題", () => {
    render(<TeamContract {...mockProps} />);
    expect(screen.getByTestId("tc-title")).toHaveTextContent("團隊承諾書");
  });

  it("顯示承諾書內容", () => {
    render(<TeamContract {...mockProps} />);
    expect(screen.getByTestId("tc-contract-text")).toHaveTextContent("我們承諾彼此尊重");
  });

  it("未簽署時顯示簽署按鈕", () => {
    render(<TeamContract {...mockProps} myUserId="u99" />);
    expect(screen.getByTestId("tc-sign-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("tc-signed-msg")).not.toBeInTheDocument();
  });

  it("已簽署時顯示已簽署訊息並隱藏按鈕", () => {
    const state: TeamContractState = { signers: [signer1] };
    render(<TeamContract {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("tc-signed-msg")).toBeInTheDocument();
    expect(screen.queryByTestId("tc-sign-btn")).not.toBeInTheDocument();
  });

  it("點擊簽署呼叫 onSign", () => {
    const onSign = vi.fn();
    render(<TeamContract {...mockProps} myUserId="u99" onSign={onSign} />);
    fireEvent.click(screen.getByTestId("tc-sign-btn"));
    expect(onSign).toHaveBeenCalled();
  });

  it("顯示簽署人數", () => {
    const state: TeamContractState = { signers: [signer1, signer2] };
    render(<TeamContract {...mockProps} state={state} />);
    expect(screen.getByTestId("tc-sign-count")).toHaveTextContent("2");
  });

  it("顯示進度條", () => {
    const state: TeamContractState = { signers: [signer1] };
    render(<TeamContract {...mockProps} state={state} />);
    expect(screen.getByTestId("tc-progress-bar")).toBeInTheDocument();
  });

  it("進度條寬度正確（1/3 約 33%）", () => {
    const state: TeamContractState = { signers: [signer1] };
    render(<TeamContract {...mockProps} state={state} />);
    const bar = screen.getByTestId("tc-progress-bar");
    expect(bar).toHaveStyle({ width: "33%" });
  });

  it("全員完成時顯示慶祝訊息", () => {
    const state: TeamContractState = { signers: [signer1, signer2, signer3] };
    render(<TeamContract {...mockProps} state={state} />);
    expect(screen.getByTestId("tc-complete-msg")).toHaveTextContent("全員完成簽署！");
  });

  it("未達 targetCount 時不顯示慶祝訊息", () => {
    const state: TeamContractState = { signers: [signer1, signer2] };
    render(<TeamContract {...mockProps} state={state} />);
    expect(screen.queryByTestId("tc-complete-msg")).not.toBeInTheDocument();
  });

  it("showSigners=true 時顯示簽署者名單", () => {
    const state: TeamContractState = { signers: [signer1, signer2] };
    render(<TeamContract {...mockProps} state={state} />);
    expect(screen.getByTestId("tc-signer-list")).toBeInTheDocument();
    expect(screen.getByTestId("tc-signer-u1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("tc-signer-u2")).toHaveTextContent("Bob");
  });

  it("showSigners=false 時不顯示名單", () => {
    const config = { ...defaultConfig, showSigners: false };
    const state: TeamContractState = { signers: [signer1] };
    render(<TeamContract {...mockProps} config={config} state={state} />);
    expect(screen.queryByTestId("tc-signer-list")).not.toBeInTheDocument();
  });

  it("無人簽署且未簽署自己時顯示空狀態", () => {
    render(<TeamContract {...mockProps} myUserId="u99" />);
    expect(screen.getByTestId("tc-no-signers")).toBeInTheDocument();
  });

  it("無 targetCount 時不顯示進度條", () => {
    const config = { ...defaultConfig, targetCount: undefined };
    render(<TeamContract {...mockProps} config={config} />);
    expect(screen.queryByTestId("tc-progress-bar")).not.toBeInTheDocument();
  });

  it("自己簽署後不再顯示空狀態", () => {
    const state: TeamContractState = { signers: [signer1] };
    render(<TeamContract {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("tc-no-signers")).not.toBeInTheDocument();
  });
});
