// 關聯 (Relations) - 所有表的關聯定義
import { relations } from "drizzle-orm";
import { fields } from "./fields";
import { users, sessions } from "./users";
import {
  roles,
  permissions,
  rolePermissions,
  userRoles,
  adminAccounts,
  adminSessions,
  auditLogs,
} from "./roles";
import { games, pages, items, events } from "./games";
import { gameSessions, playerProgress, chatMessages } from "./sessions";
import {
  teams,
  teamMembers,
  teamSessions,
  teamVotes,
  teamVoteBallots,
  teamScoreHistory,
  randomEvents,
  randomEventOccurrences,
} from "./teams";
import { arduinoDevices, deviceLogs, shootingRecords } from "./devices";
import {
  locations,
  playerLocations,
  locationVisits,
  navigationPaths,
  achievements,
  playerAchievements,
} from "./locations";
import { leaderboard } from "./leaderboard";
import { gameChapters, playerChapterProgress } from "./chapters";
import { gameMatches, matchParticipants } from "./matches";

export const usersRelations = relations(users, ({ many }) => ({
  gameSessions: many(gameSessions),
  playerProgress: many(playerProgress),
  chatMessages: many(chatMessages),
  shootingRecords: many(shootingRecords),
  createdGames: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  creator: one(users, {
    fields: [games.creatorId],
    references: [users.id],
  }),
  field: one(fields, {
    fields: [games.fieldId],
    references: [fields.id],
  }),
  pages: many(pages),
  items: many(items),
  events: many(events),
  chapters: many(gameChapters),
  gameSessions: many(gameSessions),
  leaderboard: many(leaderboard),
  matches: many(gameMatches),
}));

// ============================================================================
// Field Relations
// ============================================================================
export const fieldsRelations = relations(fields, ({ many }) => ({
  games: many(games),
  roles: many(roles),
  adminAccounts: many(adminAccounts),
  auditLogs: many(auditLogs),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  field: one(fields, {
    fields: [roles.fieldId],
    references: [fields.id],
  }),
  rolePermissions: many(rolePermissions),
  userRoles: many(userRoles),
  adminAccounts: many(adminAccounts),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
  field: one(fields, {
    fields: [userRoles.fieldId],
    references: [fields.id],
  }),
  game: one(games, {
    fields: [userRoles.gameId],
    references: [games.id],
  }),
}));

export const adminAccountsRelations = relations(adminAccounts, ({ one, many }) => ({
  field: one(fields, {
    fields: [adminAccounts.fieldId],
    references: [fields.id],
  }),
  role: one(roles, {
    fields: [adminAccounts.roleId],
    references: [roles.id],
  }),
  sessions: many(adminSessions),
  auditLogs: many(auditLogs),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  adminAccount: one(adminAccounts, {
    fields: [adminSessions.adminAccountId],
    references: [adminAccounts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actorUser: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  actorAdmin: one(adminAccounts, {
    fields: [auditLogs.actorAdminId],
    references: [adminAccounts.id],
  }),
  field: one(fields, {
    fields: [auditLogs.fieldId],
    references: [fields.id],
  }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  game: one(games, {
    fields: [pages.gameId],
    references: [games.id],
  }),
  chapter: one(gameChapters, {
    fields: [pages.chapterId],
    references: [gameChapters.id],
  }),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  game: one(games, {
    fields: [items.gameId],
    references: [games.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  game: one(games, {
    fields: [events.gameId],
    references: [games.id],
  }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one, many }) => ({
  game: one(games, {
    fields: [gameSessions.gameId],
    references: [games.id],
  }),
  currentChapter: one(gameChapters, {
    fields: [gameSessions.currentChapterId],
    references: [gameChapters.id],
  }),
  playerProgress: many(playerProgress),
  chatMessages: many(chatMessages),
  shootingRecords: many(shootingRecords),
}));

export const playerProgressRelations = relations(playerProgress, ({ one }) => ({
  session: one(gameSessions, {
    fields: [playerProgress.sessionId],
    references: [gameSessions.id],
  }),
  user: one(users, {
    fields: [playerProgress.userId],
    references: [users.id],
  }),
  currentPage: one(pages, {
    fields: [playerProgress.currentPageId],
    references: [pages.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  game: one(games, {
    fields: [teams.gameId],
    references: [games.id],
  }),
  leader: one(users, {
    fields: [teams.leaderId],
    references: [users.id],
  }),
  members: many(teamMembers),
  session: many(teamSessions),
  votes: many(teamVotes),
  scoreHistory: many(teamScoreHistory),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamSessionsRelations = relations(teamSessions, ({ one }) => ({
  team: one(teams, {
    fields: [teamSessions.teamId],
    references: [teams.id],
  }),
  session: one(gameSessions, {
    fields: [teamSessions.sessionId],
    references: [gameSessions.id],
  }),
  currentPage: one(pages, {
    fields: [teamSessions.currentPageId],
    references: [pages.id],
  }),
}));

export const teamVotesRelations = relations(teamVotes, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamVotes.teamId],
    references: [teams.id],
  }),
  page: one(pages, {
    fields: [teamVotes.pageId],
    references: [pages.id],
  }),
  ballots: many(teamVoteBallots),
}));

export const teamVoteBallotsRelations = relations(teamVoteBallots, ({ one }) => ({
  vote: one(teamVotes, {
    fields: [teamVoteBallots.voteId],
    references: [teamVotes.id],
  }),
  user: one(users, {
    fields: [teamVoteBallots.userId],
    references: [users.id],
  }),
}));

export const teamScoreHistoryRelations = relations(teamScoreHistory, ({ one }) => ({
  team: one(teams, {
    fields: [teamScoreHistory.teamId],
    references: [teams.id],
  }),
}));

export const randomEventsRelations = relations(randomEvents, ({ one, many }) => ({
  game: one(games, {
    fields: [randomEvents.gameId],
    references: [games.id],
  }),
  occurrences: many(randomEventOccurrences),
}));

export const randomEventOccurrencesRelations = relations(randomEventOccurrences, ({ one }) => ({
  event: one(randomEvents, {
    fields: [randomEventOccurrences.eventId],
    references: [randomEvents.id],
  }),
  session: one(gameSessions, {
    fields: [randomEventOccurrences.sessionId],
    references: [gameSessions.id],
  }),
  team: one(teams, {
    fields: [randomEventOccurrences.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [randomEventOccurrences.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(gameSessions, {
    fields: [chatMessages.sessionId],
    references: [gameSessions.id],
  }),
  user: one(users, {
    fields: [chatMessages.userId],
    references: [users.id],
  }),
}));

export const arduinoDevicesRelations = relations(arduinoDevices, ({ many }) => ({
  shootingRecords: many(shootingRecords),
  deviceLogs: many(deviceLogs),
}));

export const deviceLogsRelations = relations(deviceLogs, ({ one }) => ({
  device: one(arduinoDevices, {
    fields: [deviceLogs.deviceId],
    references: [arduinoDevices.deviceId],
  }),
}));

export const shootingRecordsRelations = relations(shootingRecords, ({ one }) => ({
  session: one(gameSessions, {
    fields: [shootingRecords.sessionId],
    references: [gameSessions.id],
  }),
  device: one(arduinoDevices, {
    fields: [shootingRecords.deviceId],
    references: [arduinoDevices.id],
  }),
  user: one(users, {
    fields: [shootingRecords.userId],
    references: [users.id],
  }),
}));

export const leaderboardRelations = relations(leaderboard, ({ one }) => ({
  game: one(games, {
    fields: [leaderboard.gameId],
    references: [games.id],
  }),
  session: one(gameSessions, {
    fields: [leaderboard.sessionId],
    references: [gameSessions.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  game: one(games, {
    fields: [locations.gameId],
    references: [games.id],
  }),
  visits: many(locationVisits),
}));

export const playerLocationsRelations = relations(playerLocations, ({ one }) => ({
  session: one(gameSessions, {
    fields: [playerLocations.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(users, {
    fields: [playerLocations.playerId],
    references: [users.id],
  }),
}));

export const locationVisitsRelations = relations(locationVisits, ({ one }) => ({
  location: one(locations, {
    fields: [locationVisits.locationId],
    references: [locations.id],
  }),
  session: one(gameSessions, {
    fields: [locationVisits.gameSessionId],
    references: [gameSessions.id],
  }),
  player: one(users, {
    fields: [locationVisits.playerId],
    references: [users.id],
  }),
}));

export const navigationPathsRelations = relations(navigationPaths, ({ one }) => ({
  game: one(games, {
    fields: [navigationPaths.gameId],
    references: [games.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ one, many }) => ({
  game: one(games, {
    fields: [achievements.gameId],
    references: [games.id],
  }),
  playerAchievements: many(playerAchievements),
}));

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  achievement: one(achievements, {
    fields: [playerAchievements.achievementId],
    references: [achievements.id],
  }),
  user: one(users, {
    fields: [playerAchievements.userId],
    references: [users.id],
  }),
  session: one(gameSessions, {
    fields: [playerAchievements.gameSessionId],
    references: [gameSessions.id],
  }),
}));

// ============================================================================
// Chapter Relations
// ============================================================================
export const gameChaptersRelations = relations(gameChapters, ({ one, many }) => ({
  game: one(games, {
    fields: [gameChapters.gameId],
    references: [games.id],
  }),
  pages: many(pages),
  playerProgress: many(playerChapterProgress),
}));

export const playerChapterProgressRelations = relations(
  playerChapterProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [playerChapterProgress.userId],
      references: [users.id],
    }),
    game: one(games, {
      fields: [playerChapterProgress.gameId],
      references: [games.id],
    }),
    chapter: one(gameChapters, {
      fields: [playerChapterProgress.chapterId],
      references: [gameChapters.id],
    }),
  })
);

// ============================================================================
// Match Relations（對戰系統）
// ============================================================================
export const gameMatchesRelations = relations(gameMatches, ({ one, many }) => ({
  game: one(games, {
    fields: [gameMatches.gameId],
    references: [games.id],
  }),
  chapter: one(gameChapters, {
    fields: [gameMatches.chapterId],
    references: [gameChapters.id],
  }),
  creator: one(users, {
    fields: [gameMatches.creatorId],
    references: [users.id],
  }),
  participants: many(matchParticipants),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
  match: one(gameMatches, {
    fields: [matchParticipants.matchId],
    references: [gameMatches.id],
  }),
  team: one(teams, {
    fields: [matchParticipants.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [matchParticipants.userId],
    references: [users.id],
  }),
  session: one(gameSessions, {
    fields: [matchParticipants.sessionId],
    references: [gameSessions.id],
  }),
}));

