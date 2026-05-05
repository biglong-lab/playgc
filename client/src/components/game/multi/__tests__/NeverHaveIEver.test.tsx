import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NeverHaveIEver, {
  type NeverHaveIEverConfig,
  type NeverHaveIEverState,
} from "../NeverHaveIEver";

const config: NeverHaveIEverConfig = {
  title: "我從來沒有",
  prompt: "誠實作答！",
  statements: ["吃宵夜到天亮", "搭飛機超過 10 小時", "在工作中睡著"],
  showWhoAdmitted: false,
};

const emptyState: NeverHaveIEverState = { responses: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  onRespond: vi.fn(),
  onReveal: vi.fn(),
};

function renderNH(overrides = {}) {
  return render(<NeverHaveIEver {...baseProps} {...overrides} />);
}

describe("NeverHaveIEver — 基本渲染", () => {
  it("顯示標題", () => {
    renderNH();
    expect(screen.getByTestId("nhie-title")).toHaveTextContent("我從來沒有");
  });

  it("顯示提示語", () => {
    renderNH();
    expect(screen.getByTestId("nhie-prompt")).toHaveTextContent("誠實作答！");
  });

  it("顯示所有題目", () => {
    renderNH();
    expect(screen.getByTestId("nhie-stmt-0")).toBeInTheDocument();
    expect(screen.getByTestId("nhie-stmt-1")).toBeInTheDocument();
    expect(screen.getByTestId("nhie-stmt-2")).toBeInTheDocument();
  });

  it("每題顯示我有按鈕", () => {
    renderNH();
    expect(screen.getByTestId("nhie-have-btn-0")).toBeInTheDocument();
  });

  it("每題顯示我沒有按鈕", () => {
    renderNH();
    expect(screen.getByTestId("nhie-havent-btn-0")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderNH();
    expect(screen.getByTestId("nhie-reveal-btn")).toBeInTheDocument();
  });
});

describe("NeverHaveIEver — 回應邏輯", () => {
  it("點我有觸發 onRespond(idx, true)", () => {
    const onRespond = vi.fn();
    renderNH({ onRespond });
    fireEvent.click(screen.getByTestId("nhie-have-btn-0"));
    expect(onRespond).toHaveBeenCalledWith(0, true);
  });

  it("點我沒有觸發 onRespond(idx, false)", () => {
    const onRespond = vi.fn();
    renderNH({ onRespond });
    fireEvent.click(screen.getByTestId("nhie-havent-btn-1"));
    expect(onRespond).toHaveBeenCalledWith(1, false);
  });

  it("已回應後再點不重複呼叫", () => {
    const onRespond = vi.fn();
    const stateWithResp: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
      ],
      revealed: false,
    };
    renderNH({ state: stateWithResp, onRespond });
    fireEvent.click(screen.getByTestId("nhie-have-btn-0"));
    expect(onRespond).not.toHaveBeenCalled();
  });

  it("已回應顯示計數", () => {
    const stateWithResp: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
        { entryId: "r2", userId: "u2", userName: "Bob", statementIndex: 0, haveDone: false },
      ],
      revealed: false,
    };
    renderNH({ state: stateWithResp });
    expect(screen.getByTestId("nhie-count-0")).toBeInTheDocument();
  });

  it("有 1 人有 1 人沒有", () => {
    const stateWithResp: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
        { entryId: "r2", userId: "u2", userName: "Bob", statementIndex: 0, haveDone: false },
      ],
      revealed: false,
    };
    renderNH({ state: stateWithResp });
    expect(screen.getByTestId("nhie-count-0")).toHaveTextContent("1 人有");
    expect(screen.getByTestId("nhie-count-0")).toHaveTextContent("1 人沒有");
  });
});

describe("NeverHaveIEver — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderNH({ onReveal });
    fireEvent.click(screen.getByTestId("nhie-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("揭曉後顯示 nhie-result", () => {
    const revealed: NeverHaveIEverState = { responses: [], revealed: true };
    renderNH({ state: revealed });
    expect(screen.getByTestId("nhie-result")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    const revealed: NeverHaveIEverState = { responses: [], revealed: true };
    renderNH({ state: revealed });
    expect(screen.queryByTestId("nhie-reveal-btn")).not.toBeInTheDocument();
  });

  it("揭曉後顯示計數（即使本人未回應）", () => {
    const state: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u2", userName: "Bob", statementIndex: 0, haveDone: true },
      ],
      revealed: true,
    };
    renderNH({ state });
    expect(screen.getByTestId("nhie-count-0")).toBeInTheDocument();
  });

  it("showWhoAdmitted=true 揭曉後顯示名字", () => {
    const cfgWithNames: NeverHaveIEverConfig = { ...config, showWhoAdmitted: true };
    const state: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
      ],
      revealed: true,
    };
    renderNH({ config: cfgWithNames, state });
    expect(screen.getByTestId("nhie-count-0")).toHaveTextContent("Alice");
  });

  it("showWhoAdmitted=false 揭曉後不顯示名字", () => {
    const state: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
      ],
      revealed: true,
    };
    renderNH({ state });
    expect(screen.getByTestId("nhie-count-0")).not.toHaveTextContent("Alice");
  });
});

describe("NeverHaveIEver — 多題獨立", () => {
  it("題目 0 和題目 1 計數獨立（揭曉後）", () => {
    const state: NeverHaveIEverState = {
      responses: [
        { entryId: "r1", userId: "u1", userName: "Alice", statementIndex: 0, haveDone: true },
        { entryId: "r2", userId: "u2", userName: "Bob", statementIndex: 0, haveDone: true },
        { entryId: "r3", userId: "u3", userName: "Charlie", statementIndex: 1, haveDone: false },
      ],
      revealed: true,
    };
    renderNH({ state });
    expect(screen.getByTestId("nhie-count-0")).toHaveTextContent("2 人有");
    expect(screen.getByTestId("nhie-count-1")).toHaveTextContent("0 人有");
  });
});
