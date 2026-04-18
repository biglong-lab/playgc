// 統一匯出 - 所有 schema 模組的 re-export
// 確保 import { xxx } from "@shared/schema" 繼續正常運作

export * from "./fields";
export * from "./users";
export * from "./roles";
export * from "./games";
export * from "./sessions";
export * from "./teams";
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

// SaaS 平台層（v4.0 新增 — 多租戶架構）
export * from "./platform-plans";
export * from "./platform-features";
export * from "./platform-billing";
export * from "./platform-admins";
export * from "./field-applications";
export * from "./field-memberships";
