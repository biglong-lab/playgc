// 🎯 Scenario Instantiator for LINE Admin（W15 D5 → W16 D1 完整版）
//
// 用途：LINE admin 透過 @chito 指令觸發建場
//
// 範圍演進：
//   - W15 D5：只建情境的第 1 個 host 元件（最小可用）
//   - W16 D1：擴充支援所有 components（host + multi + solo + shared）
//
// 實作策略：複用 scenarios.ts 的 default config helper（W16 D1 改 export）
// 不接 AI config（給 LINE 的 reply 維持簡單；admin 要 AI 客製可走 admin UI）

import { db } from "../db";
import { games, pages, gameSessions } from "@shared/schema";
import {
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";
import {
  getDefaultConfigForPageType,
  getGameModeForComponent,
} from "../routes/scenarios";
import { generateSlug } from "../qrCodeService";
import { randomBytes } from "crypto";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

export interface LineInstance {
  axis: "host" | "multi" | "solo" | "shared";
  pageType: string;
  label: string;
  role: string;
  /** host 軸：大螢幕 URL（含 token）*/
  hostUrl?: string;
  /** host 軸：玩家手機 URL */
  playUrl?: string;
  /** host 軸：session id */
  sessionId?: string;
  /** multi/solo/shared：玩家入口 URL（用 publicSlug）*/
  gameUrl?: string;
}

export interface LineInstantiateResult {
  ok: true;
  scenarioId: string;
  scenarioName: string;
  displayName: string;
  expiresAt: string;
  /** 所有元件 instance（可能含 host + multi + solo + shared 混合）*/
  instances: LineInstance[];
  /** 主入口 URL（host 元件第一個 → hostUrl；無 host → 第一個 gameUrl）*/
  primaryHostUrl?: string;
  primaryPlayUrl?: string;
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
  expiresAt: Date;
}): Promise<LineInstance> {
  const { scenarioId, scenarioDisplayName, component, fieldId, expiresAt } = input;
  const isHost = component.axis === "host";
  const gameMode = getGameModeForComponent(component);
  const slug = isHost ? null : generateSlug();
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

  if (isHost) {
    const hostToken = generateHostToken();
    const [session] = await db
      .insert(gameSessions)
      .values({
        gameId: game.id,
        status: "playing",
        hostMode: true,
        hostToken,
        hostTokenExpiresAt: expiresAt,
      })
      .returning();

    if (!session) throw new Error("建立 host session 失敗");

    return {
      axis: "host",
      pageType: component.pageType,
      label: component.label,
      role: component.role,
      hostUrl: `/host/${session.id}?token=${hostToken}`,
      playUrl: `/play/${session.id}`,
      sessionId: session.id,
    };
  }

  return {
    axis: component.axis === "shared" ? "shared" : (component.axis as "multi" | "solo"),
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
 *     scenarioId: "wedding",
 *     displayName: "Hung & Anita 5/15 婚禮",
 *     fieldId: null,
 *   });
 *   if (result.ok) {
 *     console.log("instances:", result.instances.length);
 *     console.log("primary host:", result.primaryHostUrl);
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
    const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);
    const instances: LineInstance[] = [];

    // 序列建立（避免 DB 連線壓力、且方便 debug）
    for (const component of scenario.components) {
      const instance = await instantiateOneComponent({
        scenarioId,
        scenarioDisplayName: displayName,
        component,
        fieldId,
        expiresAt,
      });
      instances.push(instance);
    }

    const firstHost = instances.find((i) => i.axis === "host");
    const firstNonHost = instances.find((i) => i.axis !== "host");

    return {
      ok: true,
      scenarioId,
      scenarioName: scenario.name,
      displayName,
      expiresAt: expiresAt.toISOString(),
      instances,
      primaryHostUrl: firstHost?.hostUrl,
      primaryPlayUrl: firstHost?.playUrl,
      primaryGameUrl: firstNonHost?.gameUrl,
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
