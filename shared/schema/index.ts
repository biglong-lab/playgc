// 統一匯出 - 所有 schema 模組的 re-export
// 確保 import { xxx } from "@shared/schema" 繼續正常運作

export * from "./fields";
export * from "./users";
export * from "./roles";
export * from "./games";
export * from "./sessions";
export * from "./teams";
export * from "./walkie-groups";
export * from "./client-events";
export * from "./devices";
export * from "./locations";
export * from "./leaderboard";
export * from "./chapters";
export * from "./relations";
export * from "./extended-types";
export * from "./game-templates";
export * from "./game-modules";
export * from "./matches";
export * from "./purchases";
export * from "./battle-venues";
export * from "./battle-slots";
export * from "./battle-results";
export * from "./battle-clans";
export * from "./battle-notifications";
export * from "./battle-seasons";
export * from "./battle-achievements";
export * from "./squads";
export * from "./rewards";
export * from "./engagement";

// SaaS 平台層（v4.0 新增 — 多租戶架構）
export * from "./platform-plans";
export * from "./platform-features";
export * from "./platform-billing";
export * from "./platform-admins";
export * from "./field-applications";
export * from "./field-memberships";
export * from "./ai-models";
export * from "./ai-usage-logs";
export * from "./ai-variant-pool";
export * from "./ai-cache";
export * from "./ai-cache-archive";
export * from "./field-exemplar";
export * from "./module-catalog";
export * from "./game-routes";
export * from "./player-feedback";
export * from "./player-events";
export * from "./task-thresholds";
export * from "./ab-experiments";
export * from "./markov-transitions";
export * from "./support-tickets";
export * from "./error-logs";
export * from "./platform-security";
export * from "./notifications";
export * from "./platform-menu";
export * from "./team-race";

// 🔭 Observability — WS event log + DB write log（Phase 0.2 / 2026-05-08）
export * from "./observability";
export * from "./admin-session-timings";

// 🏆 Trivia answers — TriviaShowdown server-side scoring（Phase 4 / 2026-05-08）
export * from "./trivia-answers";

// 預約系統（Phase δ W1 — 2026-05-07）
export * from "./bookings";
