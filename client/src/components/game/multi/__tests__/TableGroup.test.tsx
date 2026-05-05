import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TableGroup, { TableGroupConfig, TableGroupState, TableMember } from "../TableGroup";

const baseConfig: TableGroupConfig = {
  title: "桌組分配測試",
  tableCount: 3,
  tableNames: ["桌 A", "桌 B", "桌 C"],
};

const emptyState: TableGroupState = { members: [], revealed: false };

const members: TableMember[] = [
  { memberId: "m1", userId: "u1", userName: "Alice", tableIndex: 0 },
  { memberId: "m2", userId: "u2", userName: "Bob", tableIndex: 0 },
  { memberId: "m3", userId: "u3", userName: "Carol", tableIndex: 1 },
];

const revealedState: TableGroupState = { members, revealed: true };

function renderTg(overrides: Partial<Parameters<typeof TableGroup>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onJoin: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<TableGroup {...props} />), props };
}

describe("TableGroup — 基本渲染", () => {
  it("顯示標題", () => {
    renderTg();
    expect(screen.getByTestId("tg-title")).toHaveTextContent("桌組分配測試");
  });

  it("顯示已加入人數 0", () => {
    renderTg();
    expect(screen.getByTestId("tg-count")).toHaveTextContent("0");
  });

  it("顯示 3 個桌組按鈕", () => {
    renderTg();
    expect(screen.getByTestId("tg-table-0")).toBeInTheDocument();
    expect(screen.getByTestId("tg-table-1")).toBeInTheDocument();
    expect(screen.getByTestId("tg-table-2")).toBeInTheDocument();
  });

  it("顯示桌組名稱", () => {
    renderTg();
    expect(screen.getByTestId("tg-table-0")).toHaveTextContent("桌 A");
    expect(screen.getByTestId("tg-table-1")).toHaveTextContent("桌 B");
  });

  it("顯示公布按鈕", () => {
    renderTg();
    expect(screen.getByTestId("tg-reveal-btn")).toBeInTheDocument();
  });
});

describe("TableGroup — 互動", () => {
  it("點桌組呼叫 onJoin 帶 index", () => {
    const onJoin = vi.fn();
    renderTg({ onJoin });
    fireEvent.click(screen.getByTestId("tg-table-1"));
    expect(onJoin).toHaveBeenCalledWith(1);
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderTg({ onReveal });
    fireEvent.click(screen.getByTestId("tg-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已加入者顯示 tg-my-table", () => {
    const myMember: TableMember = {
      memberId: "m99",
      userId: "u4",
      userName: "David",
      tableIndex: 2,
    };
    renderTg({ state: { members: [myMember], revealed: false } });
    expect(screen.getByTestId("tg-my-table")).toHaveTextContent("桌 C");
  });

  it("已加入者不顯示桌組選擇按鈕", () => {
    const myMember: TableMember = {
      memberId: "m99",
      userId: "u4",
      userName: "David",
      tableIndex: 0,
    };
    renderTg({ state: { members: [myMember], revealed: false } });
    expect(screen.queryByTestId("tg-table-0")).not.toBeInTheDocument();
  });

  it("已有 3 人加入顯示人數 3", () => {
    renderTg({ state: { members, revealed: false } });
    expect(screen.getByTestId("tg-count")).toHaveTextContent("3");
  });
});

describe("TableGroup — 公布結果", () => {
  it("公布後顯示 tg-result", () => {
    renderTg({ state: revealedState });
    expect(screen.getByTestId("tg-result")).toBeInTheDocument();
  });

  it("顯示各桌分組", () => {
    renderTg({ state: revealedState });
    expect(screen.getByTestId("tg-result-table-0")).toBeInTheDocument();
    expect(screen.getByTestId("tg-result-table-1")).toBeInTheDocument();
    expect(screen.getByTestId("tg-result-table-2")).toBeInTheDocument();
  });

  it("桌 A 顯示 Alice 和 Bob", () => {
    renderTg({ state: revealedState });
    expect(screen.getByTestId("tg-result-table-0")).toHaveTextContent("Alice");
    expect(screen.getByTestId("tg-result-table-0")).toHaveTextContent("Bob");
  });

  it("無人加入顯示 tg-empty", () => {
    renderTg({ state: { members: [], revealed: true } });
    expect(screen.getByTestId("tg-empty")).toBeInTheDocument();
  });
});
