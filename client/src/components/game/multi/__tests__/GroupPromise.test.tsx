import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GroupPromise from "../GroupPromise";
import type { GroupPromiseConfig, GroupPromiseState } from "../GroupPromise";

const defaultConfig: GroupPromiseConfig = {
  title: "🤝 集體承諾宣言",
  pledgeText: "我承諾落實今天學到的內容。",
  goalSigners: 3,
};

const emptyState: GroupPromiseState = { signers: [] };
const alice = { userId: "u1", userName: "Alice", signedAt: 1000 };
const bob = { userId: "u2", userName: "Bob", signedAt: 2000 };

const mockProps = {
  config: defaultConfig,
  state: emptyState,
  myUserId: "u1",
  onSign: vi.fn(),
};

describe("GroupPromise", () => {
  it("顯示標題", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.getByTestId("gp-title")).toHaveTextContent("集體承諾宣言");
  });

  it("顯示宣言文字", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.getByTestId("gp-pledge")).toHaveTextContent("我承諾落實今天學到的內容");
  });

  it("未簽署時顯示簽名按鈕", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.getByTestId("gp-sign-btn")).toBeInTheDocument();
  });

  it("點擊簽名呼叫 onSign", () => {
    const onSign = vi.fn();
    render(<GroupPromise {...mockProps} onSign={onSign} />);
    fireEvent.click(screen.getByTestId("gp-sign-btn"));
    expect(onSign).toHaveBeenCalled();
  });

  it("已簽署後顯示已承諾訊息", () => {
    const state = { signers: [alice] };
    render(<GroupPromise {...mockProps} state={state} myUserId="u1" />);
    expect(screen.getByTestId("gp-signed-msg")).toBeInTheDocument();
  });

  it("已簽署後隱藏簽名按鈕", () => {
    const state = { signers: [alice] };
    render(<GroupPromise {...mockProps} state={state} myUserId="u1" />);
    expect(screen.queryByTestId("gp-sign-btn")).not.toBeInTheDocument();
  });

  it("有目標時顯示進度條", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.getByTestId("gp-bar")).toBeInTheDocument();
  });

  it("有目標時顯示目標人數", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.getByTestId("gp-goal")).toHaveTextContent("3");
  });

  it("顯示已簽署人數", () => {
    const state = { signers: [alice, bob] };
    render(<GroupPromise {...mockProps} state={state} />);
    expect(screen.getAllByTestId("gp-count")[0]).toHaveTextContent("2");
  });

  it("顯示進度百分比", () => {
    const state = { signers: [alice] };
    render(<GroupPromise {...mockProps} state={state} />);
    expect(screen.getByTestId("gp-pct")).toHaveTextContent("33%");
  });

  it("達標時顯示達標提示", () => {
    const state = { signers: [alice, bob, { userId: "u3", userName: "Carol", signedAt: 3000 }] };
    render(<GroupPromise {...mockProps} state={state} />);
    expect(screen.getByTestId("gp-achieved")).toBeInTheDocument();
  });

  it("未達標時不顯示達標提示", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.queryByTestId("gp-achieved")).not.toBeInTheDocument();
  });

  it("顯示簽署名單", () => {
    const state = { signers: [alice, bob] };
    render(<GroupPromise {...mockProps} state={state} />);
    expect(screen.getByTestId("gp-signer-list")).toBeInTheDocument();
    expect(screen.getByTestId("gp-signer-u1")).toBeInTheDocument();
    expect(screen.getByTestId("gp-signer-u2")).toBeInTheDocument();
  });

  it("無簽署者時不顯示名單", () => {
    render(<GroupPromise {...mockProps} />);
    expect(screen.queryByTestId("gp-signer-list")).not.toBeInTheDocument();
  });

  it("無目標時仍顯示簽署人數", () => {
    const config = { ...defaultConfig, goalSigners: undefined };
    const state = { signers: [alice] };
    render(<GroupPromise {...mockProps} config={config} state={state} />);
    expect(screen.getByTestId("gp-count")).toHaveTextContent("1");
  });
});
