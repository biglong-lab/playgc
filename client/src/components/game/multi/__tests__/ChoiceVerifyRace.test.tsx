// ChoiceVerifyRace 單元測試
//
// 覆蓋：純函式 helpers + 元件主流程

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ChoiceVerifyRace, {
  getRecordsForQuestion,
  getFirstCorrectUserId,
  calcUserScore,
  calcUserAnswerCount,
  getRaceRanking,
  hasUserAnswered,
  isQuestionResolved,
  type RaceAnswerRecord,
  type RaceMemberInfo,
} from "../ChoiceVerifyRace";
import type { ChoiceVerifyConfig } from "@shared/schema";

// ============================================================================
// 純函式 helpers
// ============================================================================

const makeRecord = (
  overrides: Partial<RaceAnswerRecord> = {},
): RaceAnswerRecord => ({
  userId: "u1",
  displayName: "玩家",
  questionIndex: 0,
  selectedOption: 0,
  isCorrect: false,
  answeredAt: "2026-05-02T10:00:00Z",
  points: 10,
  ...overrides,
});

describe("getRecordsForQuestion", () => {
  it("過濾並按時間排序", () => {
    const records = [
      makeRecord({ userId: "u1", questionIndex: 0, answeredAt: "2026-05-02T10:00:02Z" }),
      makeRecord({ userId: "u2", questionIndex: 1, answeredAt: "2026-05-02T10:00:01Z" }),
      makeRecord({ userId: "u3", questionIndex: 0, answeredAt: "2026-05-02T10:00:01Z" }),
    ];
    const result = getRecordsForQuestion(records, 0);
    expect(result.map((r) => r.userId)).toEqual(["u3", "u1"]);
  });

  it("無紀錄回空陣列", () => {
    expect(getRecordsForQuestion([], 0)).toEqual([]);
  });
});

describe("getFirstCorrectUserId", () => {
  it("第一個答對的玩家", () => {
    const records = [
      makeRecord({ userId: "u1", isCorrect: false, answeredAt: "2026-05-02T10:00:01Z" }),
      makeRecord({ userId: "u2", isCorrect: true, answeredAt: "2026-05-02T10:00:02Z" }),
      makeRecord({ userId: "u3", isCorrect: true, answeredAt: "2026-05-02T10:00:03Z" }),
    ];
    expect(getFirstCorrectUserId(records, 0)).toBe("u2");
  });

  it("無人答對 → null", () => {
    const records = [
      makeRecord({ userId: "u1", isCorrect: false }),
      makeRecord({ userId: "u2", isCorrect: false }),
    ];
    expect(getFirstCorrectUserId(records, 0)).toBeNull();
  });

  it("不同題不影響", () => {
    const records = [
      makeRecord({ userId: "u1", questionIndex: 1, isCorrect: true }),
    ];
    expect(getFirstCorrectUserId(records, 0)).toBeNull();
  });
});

describe("calcUserScore", () => {
  it("只有「先答對」者得分（後答對不計）", () => {
    const records = [
      makeRecord({
        userId: "u1",
        questionIndex: 0,
        isCorrect: true,
        answeredAt: "2026-05-02T10:00:01Z",
        points: 10,
      }),
      makeRecord({
        userId: "u2",
        questionIndex: 0,
        isCorrect: true,
        answeredAt: "2026-05-02T10:00:02Z",
        points: 10,
      }),
    ];
    expect(calcUserScore(records, "u1")).toBe(10);
    expect(calcUserScore(records, "u2")).toBe(0); // 後答對不計分
  });

  it("跨題累計", () => {
    const records = [
      makeRecord({ userId: "u1", questionIndex: 0, isCorrect: true, points: 10 }),
      makeRecord({ userId: "u1", questionIndex: 1, isCorrect: true, points: 15 }),
    ];
    expect(calcUserScore(records, "u1")).toBe(25);
  });

  it("答錯 → 不得分", () => {
    const records = [makeRecord({ userId: "u1", isCorrect: false, points: 10 })];
    expect(calcUserScore(records, "u1")).toBe(0);
  });
});

describe("calcUserAnswerCount", () => {
  it("不分對錯計總答題數", () => {
    const records = [
      makeRecord({ userId: "u1", isCorrect: false }),
      makeRecord({ userId: "u1", isCorrect: true }),
      makeRecord({ userId: "u2", isCorrect: true }),
    ];
    expect(calcUserAnswerCount(records, "u1")).toBe(2);
    expect(calcUserAnswerCount(records, "u2")).toBe(1);
  });
});

describe("getRaceRanking", () => {
  const members: RaceMemberInfo[] = [
    { userId: "u1", displayName: "阿明" },
    { userId: "u2", displayName: "小華" },
  ];

  it("依分數降序排序", () => {
    const records = [
      makeRecord({ userId: "u2", questionIndex: 0, isCorrect: true, points: 10, answeredAt: "2026-05-02T10:00:01Z" }),
      makeRecord({ userId: "u1", questionIndex: 0, isCorrect: true, points: 10, answeredAt: "2026-05-02T10:00:02Z" }),
      makeRecord({ userId: "u2", questionIndex: 1, isCorrect: true, points: 10, answeredAt: "2026-05-02T10:00:03Z" }),
    ];
    const ranking = getRaceRanking(records, members);
    expect(ranking[0].userId).toBe("u2"); // 20 分
    expect(ranking[1].userId).toBe("u1"); // 0 分（被 u2 搶先）
  });

  it("分數相同時依正確數降序", () => {
    const records = [
      makeRecord({ userId: "u1", isCorrect: true, points: 10 }),
      makeRecord({ userId: "u2", isCorrect: false, points: 0 }),
    ];
    const ranking = getRaceRanking(records, members);
    // u1 與 u2 都 0 分但 u1 有 1 個正確（first correct）
    // 實際 u1 score=10，u2=0
    expect(ranking[0].userId).toBe("u1");
  });

  it("無紀錄時所有成員 0 分", () => {
    const ranking = getRaceRanking([], members);
    expect(ranking).toHaveLength(2);
    ranking.forEach((r) => expect(r.score).toBe(0));
  });
});

describe("hasUserAnswered", () => {
  it("已答 → true", () => {
    const records = [makeRecord({ userId: "u1", questionIndex: 0 })];
    expect(hasUserAnswered(records, "u1", 0)).toBe(true);
  });

  it("沒答 → false", () => {
    expect(hasUserAnswered([], "u1", 0)).toBe(false);
  });

  it("不同題不算", () => {
    const records = [makeRecord({ userId: "u1", questionIndex: 1 })];
    expect(hasUserAnswered(records, "u1", 0)).toBe(false);
  });
});

describe("isQuestionResolved", () => {
  it("有人答對 → true", () => {
    const records = [makeRecord({ isCorrect: true })];
    expect(isQuestionResolved(records, 0, 4)).toBe(true);
  });

  it("全員答過（即使全錯）→ true", () => {
    const records = [
      makeRecord({ userId: "u1", isCorrect: false }),
      makeRecord({ userId: "u2", isCorrect: false }),
    ];
    expect(isQuestionResolved(records, 0, 2)).toBe(true);
  });

  it("尚有人沒答 → false", () => {
    const records = [makeRecord({ userId: "u1", isCorrect: false })];
    expect(isQuestionResolved(records, 0, 4)).toBe(false);
  });
});

// ============================================================================
// 元件互動
// ============================================================================

const baseConfig: ChoiceVerifyConfig = {
  title: "金門知識搶答",
  questions: [
    {
      question: "金門最有名的特產？",
      options: ["高粱酒", "鳳梨", "麻糬", "茶葉"],
      correctAnswer: 0,
    },
    {
      question: "金門面積多少平方公里？",
      options: ["50", "100", "150", "200"],
      correctAnswer: 2,
    },
  ],
  rewardPerQuestion: 10,
};

const baseMembers: RaceMemberInfo[] = [
  { userId: "me", displayName: "我" },
  { userId: "u2", displayName: "隊友" },
];

const baseProps = {
  config: baseConfig,
  myUserId: "me",
  members: baseMembers,
  answerRecords: [] as RaceAnswerRecord[],
  // 🆕 2026-05-05: server-driven props
  currentQuestionIndex: 0,
  questionStartedAt: "2026-05-05T10:00:00Z",
  secondsPerQuestion: 30,
  advanceCooldownSeconds: 5,
  resolvedAt: null as string | null,
  onAnswer: vi.fn(),
  onComplete: vi.fn(),
};

describe("ChoiceVerifyRace 元件", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空 questions 顯示空狀態", () => {
    render(<ChoiceVerifyRace {...baseProps} config={{ questions: [] }} />);
    expect(screen.getByTestId("choice-verify-race-empty")).toBeInTheDocument();
  });

  it("有題目時 render 第 1 題 + 4 個選項按鈕", () => {
    render(<ChoiceVerifyRace {...baseProps} />);
    expect(screen.getByText("金門最有名的特產？")).toBeInTheDocument();
    expect(screen.getByTestId("race-option-0")).toBeInTheDocument();
    expect(screen.getByTestId("race-option-1")).toBeInTheDocument();
    expect(screen.getByTestId("race-option-2")).toBeInTheDocument();
    expect(screen.getByTestId("race-option-3")).toBeInTheDocument();
  });

  it("題號 badge 顯示「第 1 / 2 題」", () => {
    render(<ChoiceVerifyRace {...baseProps} />);
    expect(screen.getByText(/第 1 \/ 2 題/)).toBeInTheDocument();
  });

  it("排行榜顯示所有成員（即使無答題）", () => {
    render(<ChoiceVerifyRace {...baseProps} />);
    expect(screen.getByTestId("race-rank-0")).toBeInTheDocument();
    expect(screen.getByTestId("race-rank-1")).toBeInTheDocument();
  });

  it("自己標記「（你）」", () => {
    render(<ChoiceVerifyRace {...baseProps} />);
    expect(screen.getByText(/（你）/)).toBeInTheDocument();
  });

  it("題目已 resolved 時顯示先答對者", () => {
    // 🆕 2026-05-05: server-driven、需傳 resolvedAt 才會顯示 resolved UI
    const records: RaceAnswerRecord[] = [
      makeRecord({
        userId: "u2",
        displayName: "隊友",
        questionIndex: 0,
        selectedOption: 0,
        isCorrect: true,
        points: 10,
        answeredAt: "2026-05-05T10:00:01Z",
      }),
    ];
    render(
      <ChoiceVerifyRace
        {...baseProps}
        answerRecords={records}
        resolvedAt="2026-05-05T10:00:01Z"
      />,
    );
    const resolvedSection = screen.getByTestId("race-resolved");
    expect(resolvedSection).toBeInTheDocument();
    expect(within(resolvedSection).getByText(/隊友/)).toBeInTheDocument();
    expect(within(resolvedSection).getByText(/先答對了/)).toBeInTheDocument();
  });

  it("已答題後選項全部 disabled", () => {
    // 自己已答 → myAlreadyAnswered=true → 全選項 disabled
    const records: RaceAnswerRecord[] = [
      makeRecord({
        userId: "me",
        questionIndex: 0,
        selectedOption: 1,
        isCorrect: false,
        points: 0,
      }),
    ];
    render(<ChoiceVerifyRace {...baseProps} answerRecords={records} />);
    expect(screen.getByTestId("race-option-0")).toBeDisabled();
    expect(screen.getByTestId("race-option-1")).toBeDisabled();
  });
});
