import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActionPledge, {
  type ActionPledgeConfig,
  type ActionPledgeState,
} from "../ActionPledge";

const config: ActionPledgeConfig = {
  title: "行動宣誓牆",
  prompt: "你打算做什麼？",
  actionLabel: "我承諾會…",
  timelineOptions: ["1週內", "1個月內"],
  showAuthor: true,
};

const emptyState: ActionPledgeState = { pledges: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  draftAction: "",
  draftTimeline: "",
  onDraftActionChange: vi.fn(),
  onDraftTimelineChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderAP(overrides = {}) {
  return render(<ActionPledge {...baseProps} {...overrides} />);
}

describe("ActionPledge — 基本渲染", () => {
  it("顯示標題", () => {
    renderAP();
    expect(screen.getByTestId("ap-title")).toHaveTextContent("行動宣誓牆");
  });

  it("顯示已填寫人數 0", () => {
    renderAP();
    expect(screen.getByTestId("ap-count")).toHaveTextContent("0");
  });

  it("顯示行動輸入框", () => {
    renderAP();
    expect(screen.getByTestId("ap-action-input")).toBeInTheDocument();
  });

  it("顯示期限選項按鈕", () => {
    renderAP();
    expect(screen.getByTestId("ap-timeline-1週內")).toBeInTheDocument();
    expect(screen.getByTestId("ap-timeline-1個月內")).toBeInTheDocument();
  });

  it("顯示揭曉按鈕", () => {
    renderAP();
    expect(screen.getByTestId("ap-reveal-btn")).toBeInTheDocument();
  });
});

describe("ActionPledge — 送出邏輯", () => {
  it("空白時送出按鈕 disabled", () => {
    renderAP({ draftAction: "", draftTimeline: "" });
    expect(screen.getByTestId("ap-submit-btn")).toBeDisabled();
  });

  it("只有 action 沒有 timeline 時 disabled", () => {
    renderAP({ draftAction: "去做某事", draftTimeline: "" });
    expect(screen.getByTestId("ap-submit-btn")).toBeDisabled();
  });

  it("有 action + timeline 時可送出", () => {
    renderAP({ draftAction: "去做某事", draftTimeline: "1週內" });
    expect(screen.getByTestId("ap-submit-btn")).not.toBeDisabled();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderAP({ draftAction: "去做某事", draftTimeline: "1週內", onSubmit });
    fireEvent.click(screen.getByTestId("ap-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("輸入觸發 onDraftActionChange", () => {
    const onDraftActionChange = vi.fn();
    renderAP({ onDraftActionChange });
    fireEvent.change(screen.getByTestId("ap-action-input"), {
      target: { value: "新計畫" },
    });
    expect(onDraftActionChange).toHaveBeenCalledWith("新計畫");
  });

  it("點期限觸發 onDraftTimelineChange", () => {
    const onDraftTimelineChange = vi.fn();
    renderAP({ onDraftTimelineChange });
    fireEvent.click(screen.getByTestId("ap-timeline-1週內"));
    expect(onDraftTimelineChange).toHaveBeenCalledWith("1週內");
  });
});

describe("ActionPledge — 已送出狀態", () => {
  const stateWithMyPledge: ActionPledgeState = {
    pledges: [
      {
        pledgeId: "p1",
        userId: "u1",
        userName: "Alice",
        action: "每天冥想15分鐘",
        timeline: "1週內",
      },
    ],
    revealed: false,
  };

  it("已送出顯示確認訊息", () => {
    renderAP({ state: stateWithMyPledge });
    expect(screen.getByTestId("ap-submitted-msg")).toBeInTheDocument();
  });

  it("已送出隱藏輸入框", () => {
    renderAP({ state: stateWithMyPledge });
    expect(screen.queryByTestId("ap-action-input")).not.toBeInTheDocument();
  });

  it("已送出後揭曉按鈕仍顯示", () => {
    renderAP({ state: stateWithMyPledge });
    expect(screen.getByTestId("ap-reveal-btn")).toBeInTheDocument();
  });
});

describe("ActionPledge — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderAP({ onReveal });
    fireEvent.click(screen.getByTestId("ap-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: ActionPledgeState = { pledges: [], revealed: true };

  it("揭曉空白顯示 ap-empty", () => {
    renderAP({ state: revealedEmpty });
    expect(screen.getByTestId("ap-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderAP({ state: revealedEmpty });
    expect(screen.queryByTestId("ap-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithPledge: ActionPledgeState = {
    pledges: [
      {
        pledgeId: "p1",
        userId: "u2",
        userName: "Bob",
        action: "每日閱讀30分鐘",
        timeline: "1個月內",
      },
    ],
    revealed: true,
  };

  it("顯示承諾卡", () => {
    renderAP({ state: revealedWithPledge });
    expect(screen.getByTestId("ap-pledge-p1")).toBeInTheDocument();
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderAP({ state: revealedWithPledge });
    expect(screen.getByTestId("ap-author-p1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderAP({
      state: revealedWithPledge,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("ap-author-p1")).not.toBeInTheDocument();
  });

  it("顯示行動文字", () => {
    renderAP({ state: revealedWithPledge });
    expect(screen.getByTestId("ap-action-p1")).toHaveTextContent("每日閱讀30分鐘");
  });

  it("顯示期限 badge", () => {
    renderAP({ state: revealedWithPledge });
    expect(screen.getByTestId("ap-timeline-badge-p1")).toHaveTextContent("1個月內");
  });

  it("顯示 ap-pledges 容器", () => {
    renderAP({ state: revealedWithPledge });
    expect(screen.getByTestId("ap-pledges")).toBeInTheDocument();
  });
});
