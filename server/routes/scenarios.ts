// 🎯 Scenario Instantiate — 一鍵套用情境模板（W6 D2）
//
// 端點：
//   POST /api/admin/scenarios/:scenarioId/instantiate
//     一鍵建立情境實例（為每個 host_* 元件建 game + page + host_session）
//
// 設計範圍（W6 D2）：
//   - 僅支援 pure-host 情境（所有 components.axis === "host"）
//   - 為每個元件建一個獨立的 game（含對應的 page 與 host_session）
//   - 不建立隊伍、不需要 multi/solo 元件處理
//
// 為什麼要分開建多個 game？
//   - 每個 host 元件就是一個獨立大螢幕場次（一個 hostUrl）
//   - 婚禮場景：拍立得牆 + 簽名簿 + emoji 池可以同時投影或分時段切換
//   - 各自獨立可結束、不互相影響

import type { Express } from "express";
import { db } from "../db";
import { games, pages, gameSessions } from "@shared/schema";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { randomBytes } from "crypto";
import {
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

/** 為每個 host 元件提供預設 page config（最小可玩內容）*/
function getDefaultConfigForPageType(pageType: string, scenarioName: string): Record<string, unknown> {
  switch (pageType) {
    case "host_polaroid_collage":
      return {
        title: `${scenarioName} 紀念牆`,
        subtitle: "請來賓留下祝福",
      };
    case "host_guestbook_digital":
      return {
        title: `${scenarioName} 簽名簿`,
        subtitle: "歡迎留言",
      };
    case "host_emoji_react":
      return {
        title: `${scenarioName} 情緒池`,
      };
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
    case "host_live_leaderboard":
      return {
        title: `${scenarioName} 排行榜`,
        topN: 10,
      };
    case "host_wave_response":
      return {
        title: `${scenarioName} 應援`,
      };
    case "host_crowd_gather":
      return {
        title: `${scenarioName} 簽到`,
        targetCount: 30,
      };
    case "host_scoreboard_announcement":
      return {
        title: `${scenarioName} 即時播報`,
      };
    case "host_knowledge_map":
      return {
        title: `${scenarioName} 場域地圖`,
      };
    case "host_poll_live":
      return {
        title: `${scenarioName} 即時投票`,
        question: "範例：你最想看哪個橋段？",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
          { id: "c", label: "選項 C" },
        ],
      };
    default:
      return { title: scenarioName };
  }
}

export function registerScenarioRoutes(app: Express) {
  /**
   * POST /api/admin/scenarios/:scenarioId/instantiate
   * Body: { displayName?: string }
   *
   * 為情境的每個 host_* component 建立一個獨立 game + page + host_session
   * 回傳所有建立的實例 + URLs
   */
  app.post(
    "/api/admin/scenarios/:scenarioId/instantiate",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const scenario = getScenarioById(req.params.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "情境不存在" });
        }

        // W6 D2 限制：只接受 pure-host 情境
        const nonHostComponents = scenario.components.filter((c) => c.axis !== "host");
        if (nonHostComponents.length > 0) {
          return res.status(400).json({
            error: "目前僅支援純 host 情境一鍵建立（含 multi/solo 元件需待 W7）",
            nonHostComponents: nonHostComponents.map((c) => c.label),
          });
        }

        const fieldId = req.admin.fieldId;
        if (!fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "您的帳號未綁定場域、無法建立 game" });
        }

        const displayName = (req.body?.displayName || scenario.name).slice(0, 100);
        const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);

        const instances: Array<{
          sessionId: string;
          gameId: string;
          pageType: string;
          label: string;
          hostUrl: string;
          playUrl: string;
          hostToken: string;
        }> = [];

        for (const component of scenario.components) {
          await instantiateComponent({
            scenarioId: scenario.id,
            scenarioDisplayName: displayName,
            component,
            fieldId: fieldId ?? null,
            expiresAt,
            collector: instances,
          });
        }

        res.status(201).json({
          scenario: {
            id: scenario.id,
            name: scenario.name,
            tagline: scenario.tagline,
          },
          displayName,
          expiresAt: expiresAt.toISOString(),
          instances,
          totalCreated: instances.length,
        });
      } catch (err) {
        console.error("[scenarios] instantiate 失敗:", err);
        res.status(500).json({ error: "建立情境實例失敗" });
      }
    },
  );
}

interface InstantiateComponentParams {
  scenarioId: string;
  scenarioDisplayName: string;
  component: ScenarioComponent;
  fieldId: string | null;
  expiresAt: Date;
  collector: Array<{
    sessionId: string;
    gameId: string;
    pageType: string;
    label: string;
    hostUrl: string;
    playUrl: string;
    hostToken: string;
  }>;
}

async function instantiateComponent(params: InstantiateComponentParams): Promise<void> {
  const { scenarioDisplayName, component, fieldId, expiresAt, collector } = params;

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `情境模板實例：${component.role}`,
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
    pageType: component.pageType,
    customName: component.label,
    config: getDefaultConfigForPageType(component.pageType, scenarioDisplayName),
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

  collector.push({
    sessionId: session.id,
    gameId: game.id,
    pageType: component.pageType,
    label: component.label,
    hostUrl: `/host/${session.id}?token=${hostToken}`,
    playUrl: `/play/${session.id}`,
    hostToken,
  });
}
