import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EmojiCheckIn, {
  type EmojiCheckInConfig,
  type EmojiCheckInState,
} from "../EmojiCheckIn";

const config: EmojiCheckInConfig = {
  title: "表情打卡",
  question: "現在的心情？",
  emojiOptions: ["😄", "😐", "😴"],
  maxNoteLength: 60,
  noteRequired: false,
  showAuthor: true,
};

const emptyState: EmojiCheckInState = { entries: [], revealed: false };

const baseProps = {
  config,
  state: emptyState,
  myUserId: "u1",
  selectedEmoji: null,
  noteText: "",
  onSelectEmoji: vi.fn(),
  onNoteChange: vi.fn(),
  onSubmit: vi.fn(),
  onReveal: vi.fn(),
};

function renderECI(overrides = {}) {
  return render(<EmojiCheckIn {...baseProps} {...overrides} />);
}

describe("EmojiCheckIn — 基本渲染", () => {
  it("顯示標題", () => {
    renderECI();
    expect(screen.getByTestId("eci-title")).toHaveTextContent("表情打卡");
  });

  it("顯示問題", () => {
    renderECI();
    expect(screen.getByTestId("eci-question")).toHaveTextContent("現在的心情？");
  });

  it("顯示 emoji 選項", () => {
    renderECI();
    expect(screen.getByTestId("eci-emoji-😄")).toBeInTheDocument();
    expect(screen.getByTestId("eci-emoji-😐")).toBeInTheDocument();
    expect(screen.getByTestId("eci-emoji-😴")).toBeInTheDocument();
  });

  it("顯示已打卡人數 0", () => {
    renderECI();
    expect(screen.getByTestId("eci-count")).toHaveTextContent("0");
  });

  it("顯示揭曉按鈕", () => {
    renderECI();
    expect(screen.getByTestId("eci-reveal-btn")).toBeInTheDocument();
  });
});

describe("EmojiCheckIn — 選擇與送出", () => {
  it("點 emoji 觸發 onSelectEmoji", () => {
    const onSelectEmoji = vi.fn();
    renderECI({ onSelectEmoji });
    fireEvent.click(screen.getByTestId("eci-emoji-😄"));
    expect(onSelectEmoji).toHaveBeenCalledWith("😄");
  });

  it("未選 emoji 時送出按鈕 disabled", () => {
    renderECI({ selectedEmoji: null });
    expect(screen.getByTestId("eci-submit-btn")).toBeDisabled();
  });

  it("已選 emoji 時送出按鈕可點（noteRequired=false）", () => {
    renderECI({ selectedEmoji: "😄" });
    expect(screen.getByTestId("eci-submit-btn")).not.toBeDisabled();
  });

  it("noteRequired=true 且無備註時送出按鈕 disabled", () => {
    renderECI({
      selectedEmoji: "😄",
      noteText: "",
      config: { ...config, noteRequired: true },
    });
    expect(screen.getByTestId("eci-submit-btn")).toBeDisabled();
  });

  it("noteRequired=true 且有備註時可送出", () => {
    renderECI({
      selectedEmoji: "😄",
      noteText: "很開心",
      config: { ...config, noteRequired: true },
    });
    expect(screen.getByTestId("eci-submit-btn")).not.toBeDisabled();
  });

  it("選了 emoji 後顯示備註輸入框", () => {
    renderECI({ selectedEmoji: "😄" });
    expect(screen.getByTestId("eci-note-input")).toBeInTheDocument();
  });

  it("未選 emoji 時不顯示備註輸入框", () => {
    renderECI({ selectedEmoji: null });
    expect(screen.queryByTestId("eci-note-input")).not.toBeInTheDocument();
  });

  it("點送出觸發 onSubmit", () => {
    const onSubmit = vi.fn();
    renderECI({ selectedEmoji: "😄", onSubmit });
    fireEvent.click(screen.getByTestId("eci-submit-btn"));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("備註輸入觸發 onNoteChange", () => {
    const onNoteChange = vi.fn();
    renderECI({ selectedEmoji: "😄", onNoteChange });
    fireEvent.change(screen.getByTestId("eci-note-input"), { target: { value: "很好" } });
    expect(onNoteChange).toHaveBeenCalledWith("很好");
  });
});

describe("EmojiCheckIn — 已打卡狀態", () => {
  const stateWithMyEntry: EmojiCheckInState = {
    entries: [
      { entryId: "e1", userId: "u1", userName: "Alice", emoji: "😄", note: "今天很棒" },
    ],
    revealed: false,
  };

  it("已打卡顯示確認訊息", () => {
    renderECI({ state: stateWithMyEntry });
    expect(screen.getByTestId("eci-submitted-msg")).toBeInTheDocument();
  });

  it("已打卡隱藏 emoji 選擇", () => {
    renderECI({ state: stateWithMyEntry });
    expect(screen.queryByTestId("eci-emoji-😄")).not.toBeInTheDocument();
  });
});

describe("EmojiCheckIn — 揭曉", () => {
  it("點揭曉觸發 onReveal", () => {
    const onReveal = vi.fn();
    renderECI({ onReveal });
    fireEvent.click(screen.getByTestId("eci-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  const revealedEmpty: EmojiCheckInState = { entries: [], revealed: true };

  it("揭曉空白顯示 eci-empty", () => {
    renderECI({ state: revealedEmpty });
    expect(screen.getByTestId("eci-empty")).toBeInTheDocument();
  });

  it("揭曉後隱藏揭曉按鈕", () => {
    renderECI({ state: revealedEmpty });
    expect(screen.queryByTestId("eci-reveal-btn")).not.toBeInTheDocument();
  });

  const revealedWithEntries: EmojiCheckInState = {
    entries: [
      { entryId: "e1", userId: "u2", userName: "Bob", emoji: "😄", note: "開心" },
      { entryId: "e2", userId: "u3", userName: "Carol", emoji: "😄", note: "" },
      { entryId: "e3", userId: "u4", userName: "Dave", emoji: "😴", note: "" },
    ],
    revealed: true,
  };

  it("顯示 eci-result 容器", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-result")).toBeInTheDocument();
  });

  it("顯示表情雲", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-cloud")).toBeInTheDocument();
  });

  it("表情雲顯示分組計數", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-group-count-😄")).toHaveTextContent("2");
    expect(screen.getByTestId("eci-group-count-😴")).toHaveTextContent("1");
  });

  it("顯示個人打卡卡片", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-entry-e1")).toBeInTheDocument();
  });

  it("顯示作者名稱（showAuthor=true）", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-author-e1")).toHaveTextContent("Bob");
  });

  it("不顯示作者（showAuthor=false）", () => {
    renderECI({
      state: revealedWithEntries,
      config: { ...config, showAuthor: false },
    });
    expect(screen.queryByTestId("eci-author-e1")).not.toBeInTheDocument();
  });

  it("顯示備註文字", () => {
    renderECI({ state: revealedWithEntries });
    expect(screen.getByTestId("eci-note-e1")).toHaveTextContent("開心");
  });
});
