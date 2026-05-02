// 🌐 Public API v1 — 對外開放給代理商整合（W11 D1）
//
// 認證：Authorization: Bearer ck_xxx
// 環境變數：API_KEYS（逗號分隔的有效 key）
//
// 設計依據：docs/decisions/0008-public-api-design.md
//
// W11 D1（read-only）：
//   GET /api/v1/health      公開（不需認證）
//   GET /api/v1/scenarios   列出所有情境
//   GET /api/v1/scenarios/:id  單一情境詳情
//
// W11 D2-W12 規劃：
//   POST /api/v1/instances 建立實例
//   GET /api/v1/instances/:id
//   POST /api/v1/instances/:id/end
//   GET /api/v1/usage

import type { Express } from "express";
import { requireApiKey } from "../../middleware/api-key";
import { rateLimit } from "../../middleware/rate-limit";
import {
  SCENARIO_TEMPLATES,
  SCENARIO_CATEGORY_LABELS,
  getScenarioById,
} from "@shared/scenario-templates";

export function registerPublicApiV1Routes(app: Express) {
  /**
   * GET /api/v1/health
   * 公開健康檢查（不需 API key）
   */
  app.get("/api/v1/health", (_req, res) => {
    res.json({
      status: "ok",
      version: "v1",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /api/v1/scenarios
   * 列出所有情境（需 API key）
   *
   * Query params:
   *   ?status=live  只列 live
   *   ?category=social  過濾分類
   */
  app.get("/api/v1/scenarios", requireApiKey, rateLimit, (req, res) => {
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    let scenarios = SCENARIO_TEMPLATES;

    if (statusFilter) {
      scenarios = scenarios.filter((s) => s.status === statusFilter);
    }
    if (categoryFilter) {
      scenarios = scenarios.filter((s) => s.category === categoryFilter);
    }

    res.json({
      object: "list",
      total: scenarios.length,
      categoryLabels: SCENARIO_CATEGORY_LABELS,
      data: scenarios.map((s) => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline,
        category: s.category,
        icon: s.icon,
        estimatedPlayers: s.estimatedPlayers,
        estimatedDuration: s.estimatedDuration,
        status: s.status,
        componentCount: s.components.length,
        axes: Array.from(new Set(s.components.map((c) => c.axis))),
        valueProposition: s.valueProposition,
      })),
    });
  });

  /**
   * GET /api/v1/scenarios/:id
   * 單一情境詳情（含完整 components）
   */
  app.get("/api/v1/scenarios/:id", requireApiKey, rateLimit, (req, res) => {
    const scenario = getScenarioById(req.params.id);

    if (!scenario) {
      return res.status(404).json({
        error: {
          code: "scenario_not_found",
          message: `找不到 ID 為 ${req.params.id} 的情境`,
        },
      });
    }

    res.json({
      object: "scenario",
      id: scenario.id,
      name: scenario.name,
      tagline: scenario.tagline,
      description: scenario.description,
      category: scenario.category,
      icon: scenario.icon,
      gradient: scenario.gradient,
      estimatedPlayers: scenario.estimatedPlayers,
      estimatedDuration: scenario.estimatedDuration,
      useCases: scenario.useCases,
      components: scenario.components.map((c) => ({
        pageType: c.pageType,
        label: c.label,
        role: c.role,
        axis: c.axis,
      })),
      valueProposition: scenario.valueProposition,
      status: scenario.status,
    });
  });
}
