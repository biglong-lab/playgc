// 🩺 Scenario Health — 公開健康檢查端點（W8 D1）
//
// 端點：
//   GET /api/scenarios/health
//     公開（不需認證）— 回傳所有情境的 metadata + 平台狀態
//
// 用途：
//   - smoke test 驗證情境清單可正常讀取
//   - 監控系統定期檢查（CRON）
//   - 業務工具確認生產資料一致性

import type { Express } from "express";
import { SCENARIO_TEMPLATES, SCENARIO_CATEGORY_LABELS } from "@shared/scenario-templates";

export function registerScenarioHealthRoutes(app: Express) {
  /**
   * GET /api/scenarios/health
   * 公開端點，回傳情境平台健康狀態
   */
  app.get("/api/scenarios/health", (_req, res) => {
    const total = SCENARIO_TEMPLATES.length;
    const byStatus = {
      live: SCENARIO_TEMPLATES.filter((s) => s.status === "live").length,
      preview: SCENARIO_TEMPLATES.filter((s) => s.status === "preview").length,
      planned: SCENARIO_TEMPLATES.filter((s) => s.status === "planned").length,
    };
    const byCategory: Record<string, number> = {};
    for (const s of SCENARIO_TEMPLATES) {
      byCategory[s.category] = (byCategory[s.category] ?? 0) + 1;
    }

    const totalComponents = SCENARIO_TEMPLATES.reduce(
      (acc, s) => acc + s.components.length,
      0,
    );
    const uniquePageTypes = new Set(
      SCENARIO_TEMPLATES.flatMap((s) => s.components.map((c) => c.pageType)),
    );

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      total,
      byStatus,
      byCategory,
      categoryLabels: SCENARIO_CATEGORY_LABELS,
      totalComponents,
      uniquePageTypes: uniquePageTypes.size,
      scenarios: SCENARIO_TEMPLATES.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        status: s.status,
        componentCount: s.components.length,
        axes: Array.from(new Set(s.components.map((c) => c.axis))),
      })),
    });
  });
}
