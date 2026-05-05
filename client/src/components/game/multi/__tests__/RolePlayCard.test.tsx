import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RolePlayCard, { RolePlayCardConfig, RolePlayCardState, RoleAssignment } from "../RolePlayCard";

const baseConfig: RolePlayCardConfig = {
  title: "角色扮演測試",
  roles: ["領導者", "觀察者", "挑戰者", "支持者"],
};

const emptyState: RolePlayCardState = { assignments: [], revealed: false };

const assignments: RoleAssignment[] = [
  { assignId: "a1", userId: "u1", userName: "Alice", role: "領導者" },
  { assignId: "a2", userId: "u2", userName: "Bob", role: "觀察者" },
  { assignId: "a3", userId: "u3", userName: "Carol", role: "挑戰者" },
];

const revealedState: RolePlayCardState = { assignments, revealed: true };

function renderRpc(overrides: Partial<Parameters<typeof RolePlayCard>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onDraw: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<RolePlayCard {...props} />), props };
}

describe("RolePlayCard — 基本渲染", () => {
  it("顯示標題", () => {
    renderRpc();
    expect(screen.getByTestId("rpc-title")).toHaveTextContent("角色扮演測試");
  });

  it("顯示已抽卡人數 0", () => {
    renderRpc();
    expect(screen.getByTestId("rpc-count")).toHaveTextContent("0");
  });

  it("顯示抽取按鈕", () => {
    renderRpc();
    expect(screen.getByTestId("rpc-draw-btn")).toBeInTheDocument();
  });

  it("顯示公布按鈕", () => {
    renderRpc();
    expect(screen.getByTestId("rpc-reveal-btn")).toBeInTheDocument();
  });
});

describe("RolePlayCard — 互動", () => {
  it("點抽取按鈕呼叫 onDraw", () => {
    const onDraw = vi.fn();
    renderRpc({ onDraw });
    fireEvent.click(screen.getByTestId("rpc-draw-btn"));
    expect(onDraw).toHaveBeenCalledTimes(1);
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderRpc({ onReveal });
    fireEvent.click(screen.getByTestId("rpc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已抽卡者顯示 rpc-my-role", () => {
    const myAssignment: RoleAssignment = {
      assignId: "a99",
      userId: "u4",
      userName: "David",
      role: "支持者",
    };
    renderRpc({ state: { assignments: [myAssignment], revealed: false } });
    expect(screen.getByTestId("rpc-my-role")).toHaveTextContent("支持者");
  });

  it("已抽卡者不顯示抽取按鈕", () => {
    const myAssignment: RoleAssignment = {
      assignId: "a99",
      userId: "u4",
      userName: "David",
      role: "支持者",
    };
    renderRpc({ state: { assignments: [myAssignment], revealed: false } });
    expect(screen.queryByTestId("rpc-draw-btn")).not.toBeInTheDocument();
  });

  it("已有 3 人抽卡顯示人數 3", () => {
    renderRpc({ state: { assignments, revealed: false } });
    expect(screen.getByTestId("rpc-count")).toHaveTextContent("3");
  });
});

describe("RolePlayCard — 公布結果", () => {
  it("公布後顯示 rpc-result", () => {
    renderRpc({ state: revealedState });
    expect(screen.getByTestId("rpc-result")).toBeInTheDocument();
  });

  it("顯示所有角色分配", () => {
    renderRpc({ state: revealedState });
    expect(screen.getByTestId("rpc-assignment-a1")).toBeInTheDocument();
    expect(screen.getByTestId("rpc-assignment-a2")).toBeInTheDocument();
    expect(screen.getByTestId("rpc-assignment-a3")).toBeInTheDocument();
  });

  it("顯示角色名稱", () => {
    renderRpc({ state: revealedState });
    expect(screen.getByTestId("rpc-assignment-a1")).toHaveTextContent("領導者");
    expect(screen.getByTestId("rpc-assignment-a1")).toHaveTextContent("Alice");
  });

  it("無人抽卡顯示 rpc-empty", () => {
    renderRpc({ state: { assignments: [], revealed: true } });
    expect(screen.getByTestId("rpc-empty")).toBeInTheDocument();
  });
});
