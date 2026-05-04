// 🏃 race-state.ts — Server 端 ChoiceVerifyRace 狀態管理（多人題目同步）
//
// 解決問題：原本每位玩家 client 各自管理 currentQIndex 造成「題目不同步」
//   - 玩家 A 比玩家 B 早進場 → 看到不同題
//   - 想拿積分但沒積分（client 算的、server 沒記錄）
//
// 設計：
//   - 一場 race = (sessionId + teamId + pageId) 唯一識別
//   - in-memory state（race 是即時遊戲、不持久化、結束後 cleanup）
//   - server 統一推進題目（依 secondsPerQuestion timer）
//   - 廣播給同隊全員：currentQuestionIndex + startAt + endAt
//   - client 依 startAt + endAt 計算自己 UI 的倒數
//   - 個人分數累積、結束時 broadcast 給全員 + 寫進 game_session score（透過 client onComplete）

export interface RaceMember {
  userId: string;
  displayName: string;
}

export interface RaceAnswerEntry {
  userId: string;
  displayName: string;
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  points: number;
  answeredAt: string; // ISO
}

export interface RaceState {
  /** 唯一 key：sessionId:teamId:pageId */
  raceKey: string;
  sessionId: string;
  teamId: string;
  pageId: string;
  totalQuestions: number;
  /** 每題秒數（admin 可設、預設 20） */
  secondsPerQuestion: number;
  currentQuestionIndex: number;
  /** 該題開始時間（epoch ms） */
  startAt: number;
  /** 該題結束時間（startAt + secondsPerQuestion * 1000） */
  endAt: number;
  /** 已參與的成員（首次 race_init 時收集） */
  members: RaceMember[];
  /** 該玩家累計總分 — userId → totalPoints */
  scores: Map<string, number>;
  /** 全部答題紀錄（提供給後續玩家進場時 catch up） */
  answers: RaceAnswerEntry[];
  /** advance timer ref（時間到 → 推下一題 / 完成）*/
  advanceTimer: NodeJS.Timeout | null;
  /** 是否已完成（避免重複觸發 complete）*/
  completed: boolean;
}

const states = new Map<string, RaceState>();

function buildKey(sessionId: string, teamId: string, pageId: string): string {
  return `${sessionId}:${teamId}:${pageId}`;
}

/** 取得既有 state（不會 init）*/
export function getRaceState(sessionId: string, teamId: string, pageId: string): RaceState | undefined {
  return states.get(buildKey(sessionId, teamId, pageId));
}

/**
 * 取或建立 state（第一個玩家進場時建）
 *
 * @param onAdvance 推進下一題時的 callback（含廣播 / 完成）— 由 caller 注入避免循環依賴
 */
export function ensureRaceState(
  args: {
    sessionId: string;
    teamId: string;
    pageId: string;
    totalQuestions: number;
    secondsPerQuestion: number;
    member: RaceMember;
  },
  onAdvance: (state: RaceState) => void,
): RaceState {
  const key = buildKey(args.sessionId, args.teamId, args.pageId);
  const existing = states.get(key);
  if (existing) {
    // 已存在 → 補加成員（若沒在內）
    if (!existing.members.some((m) => m.userId === args.member.userId)) {
      existing.members.push(args.member);
    }
    return existing;
  }

  // 第一個進場 → 初始化
  const now = Date.now();
  const seconds = Math.max(5, Math.min(args.secondsPerQuestion, 120)); // 軟邊界 5-120 秒
  const state: RaceState = {
    raceKey: key,
    sessionId: args.sessionId,
    teamId: args.teamId,
    pageId: args.pageId,
    totalQuestions: Math.max(1, args.totalQuestions),
    secondsPerQuestion: seconds,
    currentQuestionIndex: 0,
    startAt: now,
    endAt: now + seconds * 1000,
    members: [args.member],
    scores: new Map(),
    answers: [],
    advanceTimer: null,
    completed: false,
  };

  // 啟動推進 timer
  state.advanceTimer = setTimeout(() => onAdvance(state), seconds * 1000);
  states.set(key, state);
  return state;
}

/** 記錄答題（只記、不立即推進）*/
export function recordAnswer(state: RaceState, entry: RaceAnswerEntry): void {
  if (state.completed) return;
  if (entry.questionIndex !== state.currentQuestionIndex) return; // 過期或超前的答題忽略
  // 同題同人只計第一次（防止重複送）
  const already = state.answers.some(
    (a) => a.userId === entry.userId && a.questionIndex === entry.questionIndex,
  );
  if (already) return;
  state.answers.push(entry);
  if (entry.isCorrect && entry.points > 0) {
    const prev = state.scores.get(entry.userId) ?? 0;
    state.scores.set(entry.userId, prev + entry.points);
  }
}

/**
 * 推進到下一題（時間到 / 全員答完都呼叫）
 *
 * @returns 推進後的狀態
 *   - 若還有題：currentQuestionIndex++、startAt/endAt 重設、advanceTimer 重排
 *   - 若已最後題：completed=true、cleanup timer
 */
export function advanceQuestion(
  state: RaceState,
  onAdvance: (state: RaceState) => void,
): { advanced: boolean; completed: boolean } {
  if (state.completed) return { advanced: false, completed: true };
  // clear 既有 timer（避免重複觸發）
  if (state.advanceTimer) {
    clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
  }
  if (state.currentQuestionIndex + 1 >= state.totalQuestions) {
    // 完成
    state.completed = true;
    return { advanced: false, completed: true };
  }
  // 推進
  state.currentQuestionIndex += 1;
  const now = Date.now();
  state.startAt = now;
  state.endAt = now + state.secondsPerQuestion * 1000;
  // 排下一個 timer
  state.advanceTimer = setTimeout(
    () => onAdvance(state),
    state.secondsPerQuestion * 1000,
  );
  return { advanced: true, completed: false };
}

/** 結束清理（broadcast race_complete 後呼叫）*/
export function cleanupRaceState(state: RaceState): void {
  if (state.advanceTimer) {
    clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
  }
  states.delete(state.raceKey);
}

/** 取目前該玩家分數 */
export function getMyScore(state: RaceState, userId: string): number {
  return state.scores.get(userId) ?? 0;
}

/** 列出所有分數（給 race_complete broadcast）*/
export function getAllScores(state: RaceState): Record<string, number> {
  return Object.fromEntries(state.scores);
}

/** 取 client 用的 race state snapshot（中途進場 catch up 用）*/
export function getStateSnapshot(state: RaceState) {
  return {
    currentQuestionIndex: state.currentQuestionIndex,
    totalQuestions: state.totalQuestions,
    secondsPerQuestion: state.secondsPerQuestion,
    startAt: state.startAt,
    endAt: state.endAt,
    answers: [...state.answers],
    members: [...state.members],
    completed: state.completed,
  };
}
