// 🏁 競賽 / 接力設定（games.match_config，2026-09-23）
// 業主：競賽個人 / 隊伍兩種都要；接力依頁面分段（每一棒負責第幾頁到第幾頁、依序交棒）
import { z } from "zod";

export const relaySegmentSchema = z
  .object({
    /** 1-based、含頭尾 */
    fromPage: z.number().int().min(1),
    toPage: z.number().int().min(1),
  })
  .refine((s) => s.toPage >= s.fromPage, { message: "結束頁不可小於起始頁" });

export const gameMatchConfigSchema = z.object({
  /** 0 / 未設 = 不限時 */
  timeLimitMinutes: z.number().int().min(0).max(600).optional(),
  countdownSeconds: z.number().int().min(0).max(30).optional(),
  minParticipants: z.number().int().min(1).max(100).optional(),
  maxParticipants: z.number().int().min(1).max(100).optional(),
  relaySegments: z.array(relaySegmentSchema).max(20).optional(),
});

export type GameMatchConfig = z.infer<typeof gameMatchConfigSchema>;

/** 系統預設（遊戲沒設定時） */
export const MATCH_CONFIG_DEFAULTS = {
  timeLimitMinutes: 0,
  countdownSeconds: 3,
  minParticipants: 2,
  maxParticipants: 10,
} as const;

/** 補齊預設值 */
export function resolveMatchConfig(raw: GameMatchConfig | null | undefined) {
  const cfg = raw ?? {};
  return {
    timeLimitMinutes: cfg.timeLimitMinutes ?? MATCH_CONFIG_DEFAULTS.timeLimitMinutes,
    countdownSeconds: cfg.countdownSeconds ?? MATCH_CONFIG_DEFAULTS.countdownSeconds,
    minParticipants: cfg.minParticipants ?? MATCH_CONFIG_DEFAULTS.minParticipants,
    maxParticipants: cfg.maxParticipants ?? MATCH_CONFIG_DEFAULTS.maxParticipants,
    relaySegments: cfg.relaySegments ?? [],
  };
}
