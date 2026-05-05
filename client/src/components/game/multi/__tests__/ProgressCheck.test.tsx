import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProgressCheck, {
  ProgressCheckConfig,
  ProgressCheckState,
  ProgressReport,
} from "../ProgressCheck";

const baseConfig: ProgressCheckConfig = {
  title: "進度確認測試",
  prompt: "任務完成了多少？",
  showNotes: true,
};

const emptyState: ProgressCheckState = { reports: [], revealed: false };

const reports: ProgressReport[] = [
  { reportId: "r1", userId: "u1", userName: "Alice", percent: 100, note: "全部完成" },
  { reportId: "r2", userId: "u2", userName: "Bob", percent: 50, note: "一半" },
  { reportId: "r3", userId: "u3", userName: "Carol", percent: 75, note: "" },
];

const revealedState: ProgressCheckState = { reports, revealed: true };

function renderPc(overrides: Partial<Parameters<typeof ProgressCheck>[0]> = {}) {
  const props = {
    config: baseConfig,
    state: emptyState,
    myUserId: "u4",
    onSubmit: vi.fn(),
    onReveal: vi.fn(),
    ...overrides,
  };
  return { ...render(<ProgressCheck {...props} />), props };
}

describe("ProgressCheck — 基本渲染", () => {
  it("顯示標題", () => {
    renderPc();
    expect(screen.getByTestId("pc-title")).toHaveTextContent("進度確認測試");
  });

  it("顯示 prompt", () => {
    renderPc();
    expect(screen.getByTestId("pc-prompt")).toHaveTextContent("任務完成了多少？");
  });

  it("顯示 0/25/50/75/100% 按鈕", () => {
    renderPc();
    [0, 25, 50, 75, 100].forEach((p) => {
      expect(screen.getByTestId(`pc-pct-${p}`)).toBeInTheDocument();
    });
  });

  it("顯示備註輸入框", () => {
    renderPc();
    expect(screen.getByTestId("pc-note-input")).toBeInTheDocument();
  });

  it("顯示已回報人數 0", () => {
    renderPc();
    expect(screen.getByTestId("pc-count")).toHaveTextContent("0");
  });

  it("顯示公布按鈕", () => {
    renderPc();
    expect(screen.getByTestId("pc-reveal-btn")).toBeInTheDocument();
  });
});

describe("ProgressCheck — 互動", () => {
  it("點 100% 送出呼叫 onSubmit(100)", () => {
    const onSubmit = vi.fn();
    renderPc({ onSubmit });
    fireEvent.click(screen.getByTestId("pc-pct-100"));
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(100, "");
  });

  it("點 0% 送出呼叫 onSubmit(0)", () => {
    const onSubmit = vi.fn();
    renderPc({ onSubmit });
    fireEvent.click(screen.getByTestId("pc-pct-0"));
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(0, "");
  });

  it("輸入備註後送出帶備註", () => {
    const onSubmit = vi.fn();
    renderPc({ onSubmit });
    fireEvent.click(screen.getByTestId("pc-pct-75"));
    fireEvent.change(screen.getByTestId("pc-note-input"), {
      target: { value: "快完成了" },
    });
    fireEvent.click(screen.getByTestId("pc-submit-btn"));
    expect(onSubmit).toHaveBeenCalledWith(75, "快完成了");
  });

  it("點公布呼叫 onReveal", () => {
    const onReveal = vi.fn();
    renderPc({ onReveal });
    fireEvent.click(screen.getByTestId("pc-reveal-btn"));
    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("已回報者顯示 pc-my-report", () => {
    const myReport: ProgressReport = {
      reportId: "r99",
      userId: "u4",
      userName: "David",
      percent: 75,
      note: "進行中",
    };
    renderPc({
      state: { reports: [myReport], revealed: false },
      myUserId: "u4",
    });
    expect(screen.getByTestId("pc-my-report")).toHaveTextContent("75%");
  });

  it("已回報者不顯示選擇按鈕", () => {
    const myReport: ProgressReport = {
      reportId: "r99",
      userId: "u4",
      userName: "David",
      percent: 50,
      note: "",
    };
    renderPc({
      state: { reports: [myReport], revealed: false },
      myUserId: "u4",
    });
    expect(screen.queryByTestId("pc-pct-50")).not.toBeInTheDocument();
  });

  it("已有 3 人回報顯示人數 3", () => {
    renderPc({ state: { reports, revealed: false } });
    expect(screen.getByTestId("pc-count")).toHaveTextContent("3");
  });

  it("showNotes=false 不顯示備註輸入框", () => {
    renderPc({ config: { ...baseConfig, showNotes: false } });
    expect(screen.queryByTestId("pc-note-input")).not.toBeInTheDocument();
  });
});

describe("ProgressCheck — 公布結果", () => {
  it("公布後顯示 pc-result", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-result")).toBeInTheDocument();
  });

  it("顯示平均進度", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-avg")).toBeInTheDocument();
  });

  it("平均進度正確（100+50+75=225/3=75）", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-avg")).toHaveTextContent("75%");
  });

  it("顯示每人進度列", () => {
    renderPc({ state: revealedState });
    expect(screen.getByTestId("pc-report-r1")).toBeInTheDocument();
    expect(screen.getByTestId("pc-report-r2")).toBeInTheDocument();
    expect(screen.getByTestId("pc-report-r3")).toBeInTheDocument();
  });

  it("無人回報顯示 pc-empty", () => {
    renderPc({ state: { reports: [], revealed: true } });
    expect(screen.getByTestId("pc-empty")).toBeInTheDocument();
  });
});
