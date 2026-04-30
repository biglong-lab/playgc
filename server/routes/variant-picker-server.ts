// 🎰 P12-4: Server-side Bandit Variant Picker
//
// 用途：
//   給 server-side 元件（例如 cron 內生成測試訊息、或自動化流程）
//   想用「精準的 server bandit」時用。
//
// 玩家正常拍照 toast 不需要呼叫此 endpoint（前端用 pickVariantWeighted 即可）。
//
// API：
//   GET /api/player/variants/:pageId/pick?strategy=ucb1&key=success
//   → 回傳 server bandit 選中的 index + reason
import type { Express } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { pages } from "@shared/schema";
import { getVariantScores } from "../lib/feedback-aggregator";
import { banditPick, buildArmsFromVariants } from "../lib/bandit";

const pickQuerySchema = z.object({
  key: z.enum(["success", "fail", "nearMiss", "hint"]).default("success"),
  strategy: z.enum(["ucb1", "epsilon-greedy", "thompson-like"]).default("ucb1"),
  epsilon: z.coerce.number().min(0).max(1).default(0.1),
  coldStartMin: z.coerce.number().int().min(0).max(20).default(3),
});

export function registerVariantPickerServerRoutes(app: Express) {
  // ============================================================================
  // GET /api/player/variants/:pageId/pick
  // 用 server-side bandit 演算法選一個變體（給需要精準計算的場景）
  // ============================================================================
  app.get("/api/player/variants/:pageId/pick", isAuthenticated, async (req, res) => {
    try {
      const { pageId } = req.params;
      const parsed = pickQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: "查詢參數驗證失敗",
          details: parsed.error.errors,
        });
      }
      const { key, strategy, epsilon, coldStartMin } = parsed.data;

      // 取 page + variantPool
      const [page] = await db.select().from(pages).where(eq(pages.id, pageId)).limit(1);
      if (!page) {
        return res.status(404).json({ error: "頁面不存在" });
      }

      const pool = page.variantPool as Record<string, unknown> | null;
      if (!pool || !pool[key] || !Array.isArray(pool[key])) {
        return res.json({
          pageId,
          key,
          picked: null,
          reason: "no-pool",
          message: "此 page 沒有對應類別的變體池",
        });
      }

      const variants = pool[key] as string[];
      if (variants.length === 0) {
        return res.json({
          pageId,
          key,
          picked: null,
          reason: "empty-pool",
        });
      }

      // 取分數
      const scoreMap = await getVariantScores(pageId);
      // 轉成 Record 給 buildArmsFromVariants 用
      const scoresObj: Record<string, { totalFeedback?: number; score?: number; hidden?: boolean }> = {};
      for (const [k, v] of Array.from(scoreMap.entries())) {
        scoresObj[k] = v;
      }

      // 建立 arms + 跑 bandit
      const arms = buildArmsFromVariants(variants, scoresObj, key);
      const result = banditPick(arms, { strategy, epsilon, coldStartMin });

      // 解析 pickedId 拿 index
      const [, idxStr] = result.pickedId.split("|");
      const idx = parseInt(idxStr ?? "0", 10);
      const text = variants[idx] ?? "";

      res.json({
        pageId,
        key,
        picked: {
          index: idx,
          text,
        },
        reason: result.reason,
        score: result.score,
        candidateCount: result.candidateCount,
        strategy,
      });
    } catch (error) {
      console.error("[variant-picker-server] 失敗:", error);
      res.status(500).json({ error: "選擇變體失敗" });
    }
  });
}
