// 🎯 Scenario Instantiator for LINE Admin（W15 D5）
//
// 用途：LINE admin 透過 @chito 指令觸發建場
//
// 範圍（W15 D5 簡化版）：
//   - 只建情境的第 1 個 host 元件（最小可用，admin 拿到 hostUrl 試水溫）
//   - 預設 config（不接 AI 生成）
//   - W16 擴充支援多元件 + multi/solo + AI config
//
// 為什麼不重用 scenarios.ts 的邏輯？
//   - scenarios.ts 內的 instantiateComponent 是 file-private function、未 export
//   - 重構需動 scenarios.ts，違反「不破壞現有 endpoint」原則
//   - W15 D5 範圍只要驗證流程（admin 認證 → 真建場 → reply hostUrl）
//   - W16 規劃會評估是否抽 lib 統一邏輯
//
// 對比 scenarios.ts:
//   - scenarios.ts: admin endpoint 完整版（多元件 + AI config + 多軸線）
//   - 本 lib: LINE admin 簡化版（單一 host 元件 + 預設 config）

import { db } from "../db";
import { games, pages, gameSessions } from "@shared/schema";
import { getScenarioById } from "@shared/scenario-templates";
import { randomBytes } from "crypto";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

/** 取最小預設 config（避免空 page）*/
function getMinimalConfig(pageType: string, scenarioName: string): Record<string, unknown> {
  switch (pageType) {
    case "host_polaroid_collage":
      return { title: `${scenarioName} 紀念牆`, subtitle: "請來賓留下祝福" };
    case "host_guestbook_digital":
      return { title: `${scenarioName} 簽名簿`, subtitle: "歡迎留言" };
    case "host_emoji_react":
      return { title: `${scenarioName} 情緒池` };
    case "host_trivia_showdown":
      return {
        title: `${scenarioName} 搶答`,
        questions: [
          {
            id: "q1",
            prompt: "範例題目：1+1=?",
            options: ["1", "2", "3", "4"],
            correctIdx: 1,
            timeLimitSec: 15,
          },
        ],
      };
    case "host_poll_live":
      return {
        title: `${scenarioName} 即時投票`,
        question: "範例：你最想看哪個橋段？",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
        ],
      };
    default:
      return { title: scenarioName };
  }
}

export interface LineInstantiateResult {
  ok: true;
  scenarioId: string;
  scenarioName: string;
  displayName: string;
  sessionId: string;
  gameId: string;
  hostUrl: string; // 含 token、給大螢幕
  playUrl: string; // 不含 token、給玩家
  expiresAt: string;
  hostToken: string;
}

export interface LineInstantiateError {
  ok: false;
  error: string;
  code: "scenario_not_found" | "no_host_component" | "db_error";
}

/**
 * 為 LINE admin 建立情境實例（最小可用版）
 *
 * @example
 *   const result = await instantiateScenarioForLine({
 *     scenarioId: "wedding",
 *     displayName: "Hung & Anita 5/15 婚禮",
 *     fieldId: null, // 或 admin 的 fieldId
 *   });
 *   if (result.ok) {
 *     console.log("hostUrl:", result.hostUrl);
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

  // 找第一個 host 元件（W15 D5 簡化、W16 擴充全部元件）
  const hostComponent = scenario.components.find((c) => c.axis === "host");
  if (!hostComponent) {
    return {
      ok: false,
      error: "此情境無 host 元件（W15 D5 暫只支援含 host 軸的情境、W16 補 multi/solo）",
      code: "no_host_component",
    };
  }

  try {
    const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);
    const config = getMinimalConfig(hostComponent.pageType, displayName);

    const [game] = await db
      .insert(games)
      .values({
        title: `${displayName} - ${hostComponent.label}`,
        description: `LINE admin 建場 [scenario:${scenarioId}] [via:line/admin]`,
        fieldId,
        maxPlayers: 100,
        status: "published",
        gameMode: "individual",
      })
      .returning();

    if (!game) throw new Error("建立 game 失敗");

    await db.insert(pages).values({
      gameId: game.id,
      pageOrder: 1,
      pageType: hostComponent.pageType,
      customName: hostComponent.label,
      config,
    });

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
      ok: true,
      scenarioId,
      scenarioName: scenario.name,
      displayName,
      sessionId: session.id,
      gameId: game.id,
      hostUrl: `/host/${session.id}?token=${hostToken}`,
      playUrl: `/play/${session.id}`,
      expiresAt: expiresAt.toISOString(),
      hostToken,
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
