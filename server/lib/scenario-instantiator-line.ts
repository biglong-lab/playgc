// 🎯 Scenario Instantiator for LINE Admin（W15 D5 → W16 D1 完整版）
//
// 用途：LINE admin 透過 @chito 指令觸發建場
//
// 範圍演進：
//   - W15 D5：只建情境的第 1 個元件（最小可用）
//   - W16 D1：擴充支援所有 components（multi + solo + shared）
//   - 2026-09-25：大螢幕互動（host 軸）整條移交 PhotoGo，不再建 host 場次；
//     主入口改為第一個 gameUrl
//
// 實作策略：複用 scenarios.ts 的 default config helper（W16 D1 改 export）
// 不接 AI config（給 LINE 的 reply 維持簡單；admin 要 AI 客製可走 admin UI）

import { db } from "../db";
import { games, pages } from "@shared/schema";
import {
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";
import {
  getDefaultConfigForPageType,
  getGameModeForComponent,
} from "../routes/scenarios";
import { generateSlug } from "../qrCodeService";

export interface LineInstance {
  axis: "multi" | "solo" | "shared";
  pageType: string;
  label: string;
  role: string;
  /** 玩家入口 URL（用 publicSlug）*/
  gameUrl: string;
}

export interface LineInstantiateResult {
  ok: true;
  scenarioId: string;
  scenarioName: string;
  displayName: string;
  /** 所有元件 instance（multi + solo + shared 混合）*/
  instances: LineInstance[];
  /** 主入口 URL（第一個 gameUrl）*/
  primaryGameUrl?: string;
}

export interface LineInstantiateError {
  ok: false;
  error: string;
  code: "scenario_not_found" | "no_components" | "db_error";
}

async function instantiateOneComponent(input: {
  scenarioId: string;
  scenarioDisplayName: string;
  component: ScenarioComponent;
  fieldId: string | null;
}): Promise<LineInstance> {
  const { scenarioId, scenarioDisplayName, component, fieldId } = input;
  const gameMode = getGameModeForComponent(component);
  const slug = generateSlug();
  const config = getDefaultConfigForPageType(component.pageType, scenarioDisplayName);

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `LINE admin 建場 [scenario:${scenarioId}] [via:line/admin]`,
      fieldId,
      maxPlayers: 100,
      status: "published",
      gameMode,
      publicSlug: slug,
    })
    .returning();

  if (!game) throw new Error("建立 game 失敗");

  await db.insert(pages).values({
    gameId: game.id,
    pageOrder: 1,
    pageType: component.pageType,
    customName: component.label,
    config,
  });

  return {
    axis: component.axis,
    pageType: component.pageType,
    label: component.label,
    role: component.role,
    gameUrl: `/g/${slug}`,
  };
}

/**
 * 為 LINE admin 建立情境完整實例（W16 D1 完整版）
 *
 * 不同於 W15 D5：建所有元件（不只第一個）
 *
 * @example
 *   const result = await instantiateScenarioForLine({
 *     scenarioId: "street-walk",
 *     displayName: "後浦老街走讀 10/5",
 *     fieldId: null,
 *   });
 *   if (result.ok) {
 *     console.log("instances:", result.instances.length);
 *     console.log("primary:", result.primaryGameUrl);
 *   }
 */
export async function instantiateScenarioForLine(input: {
  scenarioId: string;
  displayName: string;
  fieldId: string | null;
}): Promise<LineInstantiateResult | LineInstantiateError> {
  const { scenarioId, displayName, fieldId } = input;

  const scenario = getScenarioById(scenarioId);
  if (!scenario) {
    return { ok: false, error: "情境不存在", code: "scenario_not_found" };
  }

  if (scenario.components.length === 0) {
    return {
      ok: false,
      error: "此情境無元件",
      code: "no_components",
    };
  }

  try {
    const instances: LineInstance[] = [];

    // 序列建立（避免 DB 連線壓力、且方便 debug）
    for (const component of scenario.components) {
      const instance = await instantiateOneComponent({
        scenarioId,
        scenarioDisplayName: displayName,
        component,
        fieldId,
      });
      instances.push(instance);
    }

    return {
      ok: true,
      scenarioId,
      scenarioName: scenario.name,
      displayName,
      instances,
      primaryGameUrl: instances[0]?.gameUrl,
    };
  } catch (err) {
    console.error("[scenario-instantiator-line] DB error:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "DB 失敗",
      code: "db_error",
    };
  }
}
