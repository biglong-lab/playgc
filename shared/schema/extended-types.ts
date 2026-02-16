// 擴展類型 (Extended Types) - 前端使用的複合類型
import type {
  Game,
  Page,
  Item,
  GameEvent,
} from "./games";
import type { User } from "./users";
import type { GameSession, PlayerProgress } from "./sessions";
import type { LeaderboardEntry } from "./leaderboard";
import type {
  Team,
  TeamMember,
  TeamSession,
  TeamVote,
  TeamVoteBallot,
} from "./teams";
import type { GameChapter, PlayerChapterProgress } from "./chapters";

// Extended types for frontend use
export type GameWithPages = Game & {
  pages: Page[];
};

export type GameWithDetails = Game & {
  pages: Page[];
  items: Item[];
  events: GameEvent[];
  creator?: User;
};

export type GameSessionWithProgress = GameSession & {
  game?: Game;
  playerProgress: PlayerProgress[];
};

export type LeaderboardWithDetails = LeaderboardEntry & {
  game?: Game;
  session?: GameSession;
};

// Team extended types
export type TeamWithMembers = Team & {
  members: (TeamMember & { user?: User })[];
  leader?: User;
};

export type TeamWithSession = Team & {
  members: (TeamMember & { user?: User })[];
  session?: TeamSession;
  game?: Game;
};

export type TeamVoteWithBallots = TeamVote & {
  ballots: (TeamVoteBallot & { user?: User })[];
};

// 章節擴展類型
export type GameChapterWithPages = GameChapter & {
  pages: Page[];
};

export type GameWithChapters = Game & {
  chapters: GameChapterWithPages[];
};

export interface ChapterProgressSummary {
  totalChapters: number;
  completedChapters: number;
  currentChapterId?: string;
  progresses: PlayerChapterProgress[];
}

