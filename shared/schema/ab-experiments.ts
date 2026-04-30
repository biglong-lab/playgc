// 🔬 A/B 自動實驗框架
//
// 用途：admin 想知道「兩個變體哪個讓玩家滿意度更高」→ 建實驗
//   - 玩家依 user_id hash 分到 A 或 B 組
//   - 各組看到不同變體
//   - 1 週後系統自動算統計顯著性 → 判定勝出
//
// 設計：
//   - ab_experiments：實驗本體（type / target / status / conclusion）
//   - ab_assignments：玩家分組紀錄（讓同玩家始終看同變體）
//   - 結果指標 = variant_feedback 表的 like/dislike 比例
//
// 範圍限制（不擴散）：
//   - 第一版只支援 variant_pool 類型實驗（A/B 兩個變體訊息）
//   - 不做多臂（>2 組）/ 不做多目標
//   - 不做即時手動結論（只支援 cron 自動結論）
import { pgTable, varchar, integer, text, timestamp, index, unique, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { fields } from "./fields";

// ============================================================================
// ab_experiments — 實驗本體
// ============================================================================
export const abExperiments = pgTable(
  "ab_experiments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** 實驗名稱（admin 看的） */
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    /** 實驗類型：第一版只支援 variant_pool */
    experimentType: varchar("experiment_type", { length: 30 })
      .default("variant_pool")
      .notNull(),
    /** 目標 page ID（soft ref） */
    targetPageId: varchar("target_page_id", { length: 50 }),
    /** 目標變體類別：success / fail / nearMiss / hint */
    targetVariantKey: varchar("target_variant_key", { length: 20 }),
    /** A 組：變體 index（在 variantPool[key] 中的位置） */
    variantAIndex: integer("variant_a_index"),
    /** B 組：變體 index */
    variantBIndex: integer("variant_b_index"),
    /** 狀態：draft / running / completed / abandoned */
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    /** 自動結論（cron 算統計顯著性後填入） */
    conclusion: varchar("conclusion", { length: 30 }),
    /** 結論 metadata（z-test / p-value / effect size） */
    conclusionStats: jsonb("conclusion_stats"),
    /** 最少需要多少 assignments 才結論（預設 50） */
    minAssignmentsForConclusion: integer("min_assignments_for_conclusion").default(50),
    /** p-value 顯著性閾值（預設 0.05） */
    significanceLevel: text("significance_level").default("0.05"),
    createdAt: timestamp("created_at").defaultNow(),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    // admin 後台列表（按場域 / status 篩）
    index("idx_ab_experiments_field_status").on(table.fieldId, table.status),
    // 找 active 實驗（玩家請求時要快）
    index("idx_ab_experiments_status_target").on(table.status, table.targetPageId, table.targetVariantKey),
  ],
);

export type AbExperiment = typeof abExperiments.$inferSelect;
export type InsertAbExperiment = typeof abExperiments.$inferInsert;

// ============================================================================
// ab_assignments — 玩家分組紀錄
// ============================================================================
export const abAssignments = pgTable(
  "ab_assignments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    experimentId: varchar("experiment_id")
      .references(() => abExperiments.id, { onDelete: "cascade" })
      .notNull(),
    /** 玩家 ID（必填；匿名玩家用 session_id 當 user_id） */
    userId: varchar("user_id").notNull(),
    /** 'a' / 'b' */
    assignedGroup: varchar("assigned_group", { length: 5 }).notNull(),
    assignedAt: timestamp("assigned_at").defaultNow(),
  },
  (table) => [
    // 同一實驗 × 同一玩家只能有一個分組（保證實驗一致性）
    unique("uniq_assignment_user").on(table.experimentId, table.userId),
    index("idx_assignment_experiment").on(table.experimentId),
  ],
);

export type AbAssignment = typeof abAssignments.$inferSelect;
export type InsertAbAssignment = typeof abAssignments.$inferInsert;

// ============================================================================
// Enum
// ============================================================================
export const abExperimentStatusEnum = ["draft", "running", "completed", "abandoned"] as const;
export type AbExperimentStatus = (typeof abExperimentStatusEnum)[number];

export const abConclusionEnum = ["a_wins", "b_wins", "no_difference", "insufficient_data"] as const;
export type AbConclusion = (typeof abConclusionEnum)[number];

export const abGroupEnum = ["a", "b"] as const;
export type AbGroup = (typeof abGroupEnum)[number];
