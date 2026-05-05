// 🎯 Scenario Instantiate — 一鍵套用情境模板（W6 D2 + D3）
//
// 端點：
//   POST /api/admin/scenarios/:scenarioId/instantiate
//     一鍵建立情境實例
//
// W6 D2：支援 pure-host 情境
// W6 D3：擴充支援含 multi/solo 元件的混合情境
//
// 邏輯：
//   - host 元件 → 建 game + page + host_session（hostMode=true，hostToken 12h）
//     → 玩家透過 /play/:sessionId 進入、大螢幕透過 /host/:sessionId?token=xxx
//   - multi 元件 → 建 game (gameMode=team) + page + publicSlug
//     → 玩家透過 /g/:slug 進入（隊伍流程）
//   - solo 元件 → 建 game (gameMode=individual) + page + publicSlug
//     → 玩家透過 /g/:slug 進入
//   - shared 元件（如 dialogue/text_card）→ 視為 solo 處理
//
// 為什麼要分開建多個 game？
//   - 每個元件都是一個獨立場次/任務，可分時段啟用
//   - 街區走讀：先 GpsCascade（multi）解鎖點，再 KnowledgeMap（host）總覽

import type { Express } from "express";
import { db } from "../db";
import { games, pages, gameSessions, fields, parseFieldSettings } from "@shared/schema";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import {
  getScenarioById,
  type ScenarioComponent,
} from "@shared/scenario-templates";
import { generateSlug } from "../qrCodeService";
import { generateScenarioContent } from "../lib/scenario-content-generator";
import { decryptApiKey } from "../lib/crypto";
import {
  pushActivityCreated,
  pushActivityReminder,
  pushActivityEnded,
} from "../lib/line-pusher";

const HOST_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時

function generateHostToken(): string {
  return randomBytes(16).toString("hex");
}

/** 為每個元件提供預設 page config（最小可玩內容）— W16 D1 export 給 LINE instantiator 複用 */
export function getDefaultConfigForPageType(pageType: string, scenarioName: string): Record<string, unknown> {
  switch (pageType) {
    // ─── host 軸線 ───
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
    case "host_live_leaderboard":
      return { title: `${scenarioName} 排行榜`, topN: 10 };
    case "host_wave_response":
      return { title: `${scenarioName} 應援` };
    case "host_crowd_gather":
      return { title: `${scenarioName} 簽到`, targetCount: 30 };
    case "host_scoreboard_announcement":
      return { title: `${scenarioName} 即時播報` };
    case "host_knowledge_map":
      return { title: `${scenarioName} 場域地圖` };
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
    case "host_lottery_wheel":
      return {
        title: `${scenarioName} 抽獎`,
        subtitle: "報名加入轉盤、等大螢幕轉",
        items: [], // 預設空、玩家報名
        spinDurationMs: 5000,
        allowJoin: true,
      };
    case "host_progress_quest":
      return {
        title: `${scenarioName} 全場進度`,
        subtitle: "一起完成 100 個任務、達標慶祝",
        totalTasks: 100,
        milestones: [25, 50, 75, 100],
        celebrationLevel: "auto",
      };
    case "host_word_cloud":
      return {
        title: `${scenarioName} 字雲`,
        subtitle: "一人一詞、字雲即時長出來",
        maxWordsPerUser: 3,
        maxLength: 10,
      };
    case "host_team_battle_score":
      return {
        title: `${scenarioName} 紅藍對抗`,
        subtitle: "雙隊即時計分、先達標獲勝",
        teams: [
          { id: "red", name: "紅隊", color: "#ef4444", emoji: "🔴" },
          { id: "blue", name: "藍隊", color: "#3b82f6", emoji: "🔵" },
        ],
        targetScore: 50,
        mode: "first_to_target",
        showRecentEvents: true,
        acceptPlayerPulse: false,
      };
    case "quest_chain":
      return {
        title: `${scenarioName} 任務鏈`,
        subtitle: "依序解鎖每一站",
        stations: [
          { id: "s1", label: "第 1 站", puzzle: "範例題：請輸入「開始」", answer: "開始" },
          { id: "s2", label: "第 2 站", puzzle: "範例題：請輸入「下一步」", answer: "下一步" },
          { id: "s3", label: "第 3 站", puzzle: "範例題：請輸入「終點」", answer: "終點" },
        ],
        rewardOnComplete: "🏆 隊伍榮譽勳章",
        hintAfterFailures: 2,
      };
    case "memory_match":
      return {
        title: `${scenarioName} 記憶配對`,
        subtitle: "翻牌找出全部配對",
        size: "4x4",
        showFirstNSeconds: 3,
        rewardPoints: 100,
      };

    // ─── multi 軸線 ───
    case "gps_cascade":
      return {
        title: `${scenarioName} 連鎖點`,
        points: [
          { id: "p1", name: "起點", hint: "第一站集合" },
          { id: "p2", name: "中繼站", hint: "依指引前往" },
          { id: "p3", name: "終點", hint: "完成所有任務" },
        ],
      };
    case "treasure_hunt":
      return {
        title: `${scenarioName} 尋寶`,
        finalReward: "🏆 完成獎勵",
        clues: [
          { id: "c1", prompt: "第一道線索（請 admin 編輯）", answer: "答案 1" },
          { id: "c2", prompt: "第二道線索", answer: "答案 2" },
        ],
      };
    case "jigsaw_puzzle":
      return {
        title: `${scenarioName} 拼圖`,
        rows: 2,
        cols: 2,
        prompts: ["紅色方塊", "藍色方塊", "綠色方塊", "黃色方塊"],
      };
    case "collective_score":
      return { title: `${scenarioName} 累計分`, targetScore: 1000 };
    case "role_assign":
      return {
        title: `${scenarioName} 角色分派`,
        subtitle: "你扮演誰？",
        roles: [
          { id: "r1", name: "角色 A", emoji: "🎭", description: "請 admin 編輯角色說明", color: "#3b82f6" },
          { id: "r2", name: "角色 B", emoji: "🕵️", description: "請 admin 編輯角色說明", color: "#10b981" },
          { id: "r3", name: "角色 C", emoji: "👁", description: "請 admin 編輯角色說明", color: "#f59e0b" },
        ],
      };
    case "photo_team":
      return {
        title: `${scenarioName} 團體合影`,
        prompts: ["請大家擺出歡樂的姿勢"],
      };
    case "vote_team":
      return {
        title: `${scenarioName} 隊伍投票`,
        question: "請決定：",
        options: [
          { id: "a", label: "選項 A" },
          { id: "b", label: "選項 B" },
        ],
        mode: "majority",
      };
    case "shooting_team":
      return { title: `${scenarioName} 隊伍射擊累計` };
    case "gps_team_mission":
      return {
        title: `${scenarioName} 隊伍 GPS`,
        triggerMode: "any",
        targetLocation: { lat: 24.4321, lng: 118.317 },
        radius: 50,
      };
    case "lock_coop":
      return {
        title: `${scenarioName} 協作解鎖`,
        clues: ["線索 1（admin 編輯）", "線索 2", "線索 3"],
        password: "ADMIN_EDIT",
      };
    case "relay_mission":
      return {
        title: `${scenarioName} 接力任務`,
        segments: [
          { id: "s1", description: "第一棒：請 admin 編輯", solverPrompt: "完成這個任務" },
          { id: "s2", description: "第二棒", solverPrompt: "完成這個任務" },
        ],
      };
    case "territory_capture":
      return {
        title: `${scenarioName} 地盤戰`,
        points: [{ id: "t1", name: "據點 A", lat: 24.43, lng: 118.31, radius: 30 }],
      };
    case "choice_verify_race":
      return {
        title: `${scenarioName} 隊伍搶答`,
        question: "範例題目：請編輯",
        options: ["A", "B", "C", "D"],
        correctIdx: 0,
        timeLimitSec: 20,
      };

    case "shared_board":
      return {
        title: `${scenarioName} 共識牆`,
        prompt: "寫下一件關於你的有趣事實，讓大家認識你！",
        maxCardsPerPerson: 3,
      };
    case "bingo":
      return {
        title: `${scenarioName} 賓果`,
        subtitle: "點格子，連成一線就 BINGO！",
        items: [
          "去過日本", "有養寵物", "是長子女", "喜歡咖啡", "會騎機車",
          "喜歡唱歌", "有學過樂器", "最近看過電影", "喜歡健行", "會游泳",
          "有出國旅遊", "喜歡下廚", "是夜貓子", "有運動習慣", "喜歡閱讀",
          "喜歡看漫畫",
        ],
        gridSize: 4,
        winCondition: "line",
        celebrationText: "🎉 恭喜完成賓果！",
      };
    case "mood_meter":
      return {
        title: "🌡️ 活力確認",
        question: "你現在的狀態是？",
        allowChange: true,
      };
    case "team_checklist":
      return {
        title: `${scenarioName} 任務清單`,
        items: ["完成第一項任務", "完成第二項任務", "完成第三項任務"],
        winOnComplete: true,
        celebrationText: "🎉 全隊任務全部完成！",
      };
    case "feedback_star":
      return {
        title: "⭐ 活動評分",
        question: "你對這次活動的評分？",
        allowComment: true,
      };
    case "team_word_cloud":
      return {
        title: "🌐 團隊詞雲",
        question: "一個詞描述你現在的感受？",
        maxWordsPerPerson: 3,
        maxWordLength: 15,
      };
    case "check_in":
      return {
        title: "✅ 活動簽到",
        message: "點擊簽到，讓主持人知道你已到場！",
        showNames: true,
      };
    case "group_timer":
      return {
        title: "⏱️ 限時倒數",
        durationSeconds: 300,
        completedText: "時間到，請回到集合點！",
      };
    case "quick_question":
      return {
        title: "💬 快問快答",
        question: "用一句話描述你現在的心情？",
        maxLength: 40,
        anonymous: true,
      };

    case "wish_wall":
      return {
        title: "💌 祝福牆",
        prompt: "寫下你的祝福…",
        maxLength: 100,
        showAuthor: true,
      };

    case "rating_wall":
      return {
        title: "⭐ 作品評分",
        subtitle: "為每個作品評 1-5 顆星",
        items: [
          { id: "i1", label: "第一組", emoji: "🔵" },
          { id: "i2", label: "第二組", emoji: "🔴" },
          { id: "i3", label: "第三組", emoji: "🟢" },
        ],
        maxStars: 5,
        showResults: true,
      };

    case "name_card":
      return {
        title: "🏷️ 自我介紹牌",
        subtitle: "填寫你的名牌，讓大家認識你",
        fields: [
          { key: "name", label: "姓名", placeholder: "你的名字", maxLength: 20 },
          { key: "role", label: "角色 / 職位", placeholder: "如：工程師、學生…", maxLength: 30 },
          { key: "fact", label: "一件有趣的事", placeholder: "如：我養了一隻貓…（選填）", maxLength: 40 },
        ],
      };

    case "seat_draw":
      return {
        title: "🎲 抽籤分組",
        slots: [
          { id: "g1", label: "A 組", emoji: "🔵" },
          { id: "g2", label: "B 組", emoji: "🔴" },
          { id: "g3", label: "C 組", emoji: "🟢" },
          { id: "g4", label: "D 組", emoji: "🟡" },
        ],
        shuffleText: "我要抽！",
      };

    case "countdown_reveal":
      return {
        title: "🎯 倒數揭曉",
        revealText: "🎉 恭喜！",
        revealEmoji: "🎉",
        durationSeconds: 5,
        suspenseMessage: "準備好了嗎？倒數即將開始…",
      };

    case "photo_wall":
      return {
        title: "📸 活動照片牆",
        prompt: "上傳一張今天的照片！",
        allowCaption: true,
        showAuthor: true,
      };

    case "multi_vote":
      return {
        title: "🗳️ 即時投票",
        question: "你的選擇是？",
        options: [
          { id: "a", label: "選項 A", emoji: "🔵" },
          { id: "b", label: "選項 B", emoji: "🟢" },
          { id: "c", label: "選項 C", emoji: "🔴" },
        ],
        showResultsAfterVote: true,
        showVoterCount: true,
      };

    case "stamp_card":
      return {
        title: "🎴 集點卡",
        slots: [
          { id: "s1", label: "任務一", emoji: "⭐" },
          { id: "s2", label: "任務二", emoji: "⭐" },
          { id: "s3", label: "任務三", emoji: "⭐" },
          { id: "s4", label: "任務四", emoji: "⭐" },
          { id: "s5", label: "任務五", emoji: "⭐" },
          { id: "s6", label: "任務六", emoji: "⭐" },
        ],
        rewardText: "集滿兌換獎勵",
        celebrationText: "恭喜集滿！",
      };

    case "random_team":
      return {
        title: "🎲 隨機分組",
        subtitle: "加入等待，一鍵隨機分配隊伍！",
        teams: [
          { id: "t1", name: "A 組", emoji: "🔵", color: "blue" },
          { id: "t2", name: "B 組", emoji: "🔴", color: "red" },
          { id: "t3", name: "C 組", emoji: "🟢", color: "green" },
          { id: "t4", name: "D 組", emoji: "🟡", color: "yellow" },
        ],
        startText: "開始分組！",
      };

    case "story_chain":
      return {
        title: "📖 接龍故事",
        opening: "從前從前，有一個很特別的地方…",
        maxWordsPerContribution: 20,
        maxContributions: 10,
        finishText: "感謝所有創作者！",
      };

    case "question_box":
      return {
        title: "📬 提問箱",
        prompt: "你有什麼問題想問？",
        allowAnonymous: true,
        maxQuestionsPerPerson: 3,
        maxQuestionLength: 100,
      };

    case "lucky_draw":
      return {
        title: "🎰 幸運抽獎",
        subtitle: "期待您的大獎！",
        prizes: [
          { id: "p1", name: "一等獎", emoji: "🏆", quantity: 1 },
          { id: "p2", name: "二等獎", emoji: "🎁", quantity: 2 },
          { id: "p3", name: "三等獎", emoji: "🎀", quantity: 3 },
        ],
        drawText: "抽！",
        suspenseText: "幸運兒是…",
      };

    case "pop_quiz":
      return {
        title: "🧠 快問快答",
        questions: [
          { id: "q1", prompt: "問題一：（請 admin 修改）", options: ["A", "B", "C", "D"], correctIdx: 0, timeLimitSec: 20 },
          { id: "q2", prompt: "問題二：（請 admin 修改）", options: ["A", "B", "C", "D"], correctIdx: 1, timeLimitSec: 20 },
          { id: "q3", prompt: "問題三：（請 admin 修改）", options: ["A", "B", "C", "D"], correctIdx: 2, timeLimitSec: 20 },
        ],
      };

    case "pledge_wall":
      return {
        title: "🤝 承諾牆",
        prompt: "許下你的承諾，讓大家一起見證",
        placeholder: "我承諾…",
        maxLength: 80,
        showSupport: true,
        emojiOptions: ["🌱", "♻️", "🤝", "💪", "🌍", "❤️", "✨", "🎯", "📚", "🏃"],
      };

    case "retro_board":
      return {
        title: "📋 回顧版",
        prompt: "分享你對這次活動的想法",
        columns: [
          { id: "keep", label: "繼續做", emoji: "✅", color: "green" },
          { id: "stop", label: "停止做", emoji: "🛑", color: "red" },
          { id: "start", label: "開始做", emoji: "🚀", color: "blue" },
        ],
        maxCardsPerColumn: 3,
        allowVoting: true,
      };

    case "two_truths":
      return {
        title: "🤥 兩真一假",
        instructions: "寫下 2 個真實陳述和 1 個謊言，讓大家猜哪個是假的！",
        showScores: true,
      };

    case "timeline_wall":
      return {
        title: "📅 集體時間軸",
        prompt: "寫下你的回憶，一起拼出共同的故事",
        placeholder: "描述這一年發生了什麼…",
        maxEntriesPerPerson: 2,
        maxTextLength: 60,
        showAuthor: true,
      };

    case "dot_vote":
      return {
        title: "🔵 點點投票",
        question: "把你的點數分給最重要的選項",
        options: [
          { id: "o1", label: "選項 A", emoji: "🅰️" },
          { id: "o2", label: "選項 B", emoji: "🅱️" },
          { id: "o3", label: "選項 C", emoji: "🆑" },
        ],
        dotsPerPerson: 3,
        showResultsLive: true,
      };

    case "peer_recognition":
      return {
        title: "🌟 同伴表揚牆",
        prompt: "寫下你想感謝的人",
        placeholder: "感謝你在這次活動中…",
        maxLength: 100,
        allowAnonymous: true,
        emojiOptions: ["🌟", "🙌", "💪", "❤️", "👏", "🎉", "🔥", "💡", "🤝", "✨"],
      };

    case "debate_vote":
      return {
        title: "🗳️ 即時辯論投票",
        topic: `${scenarioName} — 你的立場是？`,
        proLabel: "正方：同意",
        conLabel: "反方：不同意",
        proEmoji: "👍",
        conEmoji: "👎",
        showVoterCount: true,
        allowSwitch: true,
      };

    case "live_pulse":
      return {
        title: "⚡ 即時活力計",
        subtitle: "一起點擊，感受全場能量！",
        prompt: "點擊提升活力！",
        maxLevel: 200,
      };

    // ─── shared / solo（簡單預設）───
    case "dialogue":
      return {
        character: { name: "主持人" },
        messages: [{ text: `歡迎來到 ${scenarioName}` }],
      };
    case "text_card":
      return { title: scenarioName, content: "請 admin 編輯內容" };
    case "video":
      return { url: "" };

    default:
      return { title: scenarioName };
  }
}

/** 依 axis 推導 gameMode — W16 D1 export 給 LINE instantiator 複用 */
export function getGameModeForComponent(component: ScenarioComponent): "individual" | "team" {
  if (component.axis === "multi") return "team";
  return "individual";
}

export function registerScenarioRoutes(app: Express) {
  /**
   * GET /api/admin/scenarios/stats
   * 回傳目前場域的情境使用統計（最近 30 天）
   *
   * 來源：games.description 含 `[scenario:<id>]` 標記
   */
  app.get(
    "/api/admin/scenarios/stats",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const fieldId = req.admin.fieldId;
        const isSuperAdmin = req.admin.systemRole === "super_admin";

        // 取最近 30 天
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // 用 description LIKE 找情境實例
        const allGames = await db
          .select({
            id: games.id,
            title: games.title,
            description: games.description,
            fieldId: games.fieldId,
            createdAt: games.createdAt,
          })
          .from(games);

        // 過濾：場域隔離 + 含 [scenario:] 標記 + 最近 30 天
        const scenarioGames = allGames.filter((g) => {
          if (!g.description?.includes("[scenario:")) return false;
          if (!isSuperAdmin && g.fieldId !== fieldId) return false;
          if (g.createdAt && new Date(g.createdAt) < thirtyDaysAgo) return false;
          return true;
        });

        // 抽 scenario id
        const scenarioCounts: Record<string, number> = {};
        for (const g of scenarioGames) {
          const match = g.description?.match(/\[scenario:([^\]]+)\]/);
          if (match) {
            const sid = match[1];
            scenarioCounts[sid] = (scenarioCounts[sid] ?? 0) + 1;
          }
        }

        // 加上情境名稱
        const breakdown = Object.entries(scenarioCounts)
          .map(([scenarioId, count]) => {
            const scenario = getScenarioById(scenarioId);
            return {
              scenarioId,
              scenarioName: scenario?.name ?? scenarioId,
              category: scenario?.category ?? "unknown",
              count,
            };
          })
          .sort((a, b) => b.count - a.count);

        res.json({
          windowDays: 30,
          totalGamesCreated: scenarioGames.length,
          totalScenariosUsed: Object.keys(scenarioCounts).length,
          breakdown,
        });
      } catch (err) {
        console.error("[scenarios] stats 失敗:", err);
        res.status(500).json({ error: "統計查詢失敗" });
      }
    },
  );

  /**
   * POST /api/admin/scenarios/notify-line
   * Body: {
   *   userId, displayName, activityName, playUrl,
   *   type: "created" | "reminder-24h" | "reminder-1h" | "ended",
   *   recapUrl?, closingMessage?
   * }
   *
   * 觸發 LINE 推播給單一玩家（W15 D2）
   */
  app.post(
    "/api/admin/scenarios/notify-line",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
          return res.status(503).json({
            error: "LINE Bot 未啟用（LINE_CHANNEL_ACCESS_TOKEN 缺）",
            code: "LINE_BOT_NOT_CONFIGURED",
          });
        }

        const { userId, displayName, activityName, playUrl, type, recapUrl, closingMessage } = req.body ?? {};
        if (!userId || !displayName || !activityName) {
          return res.status(400).json({ error: "缺少必填欄位（userId / displayName / activityName）" });
        }

        switch (type) {
          case "created":
            if (!playUrl) return res.status(400).json({ error: "created 類型需 playUrl" });
            await pushActivityCreated({ userId, displayName, activityName, playUrl });
            break;
          case "reminder-24h":
          case "reminder-1h":
            if (!playUrl) return res.status(400).json({ error: "reminder 類型需 playUrl" });
            await pushActivityReminder({
              userId,
              displayName,
              activityName,
              playUrl,
              remindType: type === "reminder-24h" ? "24h" : "1h",
            });
            break;
          case "ended":
            await pushActivityEnded({ userId, displayName, activityName, recapUrl, closingMessage });
            break;
          default:
            return res.status(400).json({
              error: "type 必須為 created / reminder-24h / reminder-1h / ended",
            });
        }

        res.json({ ok: true, type, dispatched: true, to: userId });
      } catch (err) {
        console.error("[scenarios] notify-line 失敗:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "推播失敗" });
      }
    },
  );

  /**
   * GET /api/admin/scenarios/quota
   * 回傳本月用量 + 配額（W10 D4）
   *
   * 配額來源（優先序）：
   * 1. 環境變數 `SCENARIO_QUOTA_FIELD_<fieldId>`（指定場域配額）
   * 2. 環境變數 `SCENARIO_QUOTA_DEFAULT`（全域 default）
   * 3. 預設 50（無設定時）
   */
  app.get(
    "/api/admin/scenarios/quota",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const fieldId = req.admin.fieldId;
        const isSuperAdmin = req.admin.systemRole === "super_admin";

        // 取本月（從本月 1 號 0:00 起）
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // 抓所有 scenario 實例 game
        const allGames = await db
          .select({
            id: games.id,
            description: games.description,
            fieldId: games.fieldId,
            createdAt: games.createdAt,
          })
          .from(games);

        const monthGames = allGames.filter((g) => {
          if (!g.description?.includes("[scenario:")) return false;
          if (!isSuperAdmin && g.fieldId !== fieldId) return false;
          if (g.createdAt && new Date(g.createdAt) < monthStart) return false;
          return true;
        });

        const used = monthGames.length;

        // 解析配額
        let quota = 50; // default
        const fieldQuotaEnv = fieldId ? process.env[`SCENARIO_QUOTA_FIELD_${fieldId}`] : null;
        const defaultQuotaEnv = process.env.SCENARIO_QUOTA_DEFAULT;
        if (fieldQuotaEnv && /^\d+$/.test(fieldQuotaEnv)) {
          quota = parseInt(fieldQuotaEnv, 10);
        } else if (defaultQuotaEnv && /^\d+$/.test(defaultQuotaEnv)) {
          quota = parseInt(defaultQuotaEnv, 10);
        }

        const remaining = Math.max(0, quota - used);
        const percent = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

        // 下個重置時間（下個月 1 號 0:00）
        const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        res.json({
          windowMonth: monthStart.toISOString().slice(0, 7), // YYYY-MM
          quota,
          used,
          remaining,
          percent,
          nextResetAt: nextReset.toISOString(),
          source: fieldQuotaEnv ? "field-env" : defaultQuotaEnv ? "default-env" : "hardcoded",
        });
      } catch (err) {
        console.error("[scenarios] quota 失敗:", err);
        res.status(500).json({ error: "配額查詢失敗" });
      }
    },
  );

  /**
   * POST /api/admin/scenarios/:scenarioId/ai-preview
   * Body: { context: string }
   *
   * 用 OpenRouter（DeepSeek）為情境的所有元件生成客製化 config 預覽
   * 不寫入 DB、純 preview，admin 可決定是否套用
   *
   * 需要場域已設定 OpenRouter API key（settings.geminiApiKey 為 sk-or-* 格式）
   */
  app.post(
    "/api/admin/scenarios/:scenarioId/ai-preview",
    requireAdminAuth,
    requirePermission("game:create"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const scenario = getScenarioById(req.params.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "情境不存在" });
        }

        const context = (req.body?.context ?? "").toString().trim().slice(0, 500);
        if (!context) {
          return res.status(400).json({ error: "請提供 context（活動描述）" });
        }

        // 取場域 OpenRouter API key
        const fieldId = req.admin.fieldId;
        if (!fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "您的帳號未綁定場域、無法使用 AI 服務" });
        }

        if (!fieldId) {
          return res.status(503).json({
            error: "super_admin 暫不支援 AI 預覽（需要綁定場域 API key）",
          });
        }

        const [field] = await db.select().from(fields).where(eq(fields.id, fieldId)).limit(1);
        if (!field) return res.status(404).json({ error: "場域不存在" });

        const settings = parseFieldSettings(field.settings);
        const fieldApiKey = settings.geminiApiKey;
        if (!fieldApiKey) {
          return res.status(503).json({
            error: "此場域尚未設定 OpenRouter API key",
            code: "FIELD_AI_NOT_CONFIGURED",
          });
        }

        let apiKey: string;
        try {
          apiKey = decryptApiKey(fieldApiKey);
        } catch {
          return res.status(500).json({ error: "場域 API key 解密失敗" });
        }

        if (!apiKey.startsWith("sk-or-")) {
          return res.status(400).json({
            error: "AI 預覽功能僅支援 OpenRouter API key",
            code: "REQUIRES_OPENROUTER",
          });
        }

        const generated = await generateScenarioContent({
          apiKey,
          scenarioName: scenario.name,
          context,
          components: scenario.components,
        });

        res.json({
          scenario: {
            id: scenario.id,
            name: scenario.name,
            tagline: scenario.tagline,
          },
          context,
          configs: generated.configs,
          rationale: generated.rationale,
          components: scenario.components.map((c) => ({
            pageType: c.pageType,
            label: c.label,
            role: c.role,
            axis: c.axis,
            hasAiConfig: !!generated.configs[c.pageType],
          })),
        });
      } catch (err) {
        console.error("[scenarios] ai-preview 失敗:", err);
        res.status(500).json({
          error: err instanceof Error ? err.message : "AI 內容生成失敗",
        });
      }
    },
  );

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

        const fieldId = req.admin.fieldId;
        if (!fieldId && req.admin.systemRole !== "super_admin") {
          return res.status(400).json({ error: "您的帳號未綁定場域、無法建立 game" });
        }

        const displayName = (req.body?.displayName || scenario.name).slice(0, 100);
        const expiresAt = new Date(Date.now() + HOST_TOKEN_TTL_MS);

        // W9 D2: 接受 AI 預覽過的客製 configs（可選）
        // 結構：{ "<pageType>": { ...config } }
        const aiConfigs = (req.body?.aiConfigs ?? null) as Record<string, Record<string, unknown>> | null;

        const instances: ScenarioInstance[] = [];

        for (const component of scenario.components) {
          await instantiateComponent({
            scenarioId: scenario.id,
            scenarioDisplayName: displayName,
            component,
            fieldId: fieldId ?? null,
            expiresAt,
            collector: instances,
            aiConfig: aiConfigs?.[component.pageType] ?? null,
          });
        }

        const hostCount = instances.filter((i) => i.axis === "host").length;
        const multiCount = instances.filter((i) => i.axis === "multi").length;
        const otherCount = instances.length - hostCount - multiCount;

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
          breakdown: { host: hostCount, multi: multiCount, other: otherCount },
        });
      } catch (err) {
        console.error("[scenarios] instantiate 失敗:", err);
        res.status(500).json({ error: "建立情境實例失敗" });
      }
    },
  );
}

interface ScenarioInstance {
  axis: "host" | "multi" | "solo" | "shared";
  gameId: string;
  pageType: string;
  label: string;
  /** host 模式才有：大螢幕端 URL（含 token） */
  hostUrl?: string;
  /** host 模式才有：玩家手機端 URL（用 sessionId） */
  playUrl?: string;
  /** host 模式才有：12h 有效 token */
  hostToken?: string;
  /** host 模式才有：session id */
  sessionId?: string;
  /** multi/solo/shared：玩家入口 URL（用 publicSlug） */
  gameUrl?: string;
  /** multi/solo/shared：public slug */
  publicSlug?: string;
  /** 元件作用描述 */
  role: string;
}

interface InstantiateComponentParams {
  scenarioId: string;
  scenarioDisplayName: string;
  component: ScenarioComponent;
  fieldId: string | null;
  expiresAt: Date;
  collector: ScenarioInstance[];
  /** W9 D2: 若有 AI 生成的客製 config，優先使用 */
  aiConfig?: Record<string, unknown> | null;
}

async function instantiateComponent(params: InstantiateComponentParams): Promise<void> {
  const { scenarioId, scenarioDisplayName, component, fieldId, expiresAt, collector, aiConfig } = params;

  const isHost = component.axis === "host";
  const gameMode = getGameModeForComponent(component);
  const slug = isHost ? null : generateSlug();

  // W9 D2: AI 生成的 config 優先、fallback 到 default
  const config = aiConfig ?? getDefaultConfigForPageType(component.pageType, scenarioDisplayName);

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `情境模板實例：${component.role} [scenario:${scenarioId}]`,
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

    collector.push({
      axis: "host",
      sessionId: session.id,
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      hostUrl: `/host/${session.id}?token=${hostToken}`,
      playUrl: `/play/${session.id}`,
      hostToken,
      role: component.role,
    });
  } else {
    collector.push({
      axis: component.axis === "shared" ? "shared" : (component.axis as "multi" | "solo"),
      gameId: game.id,
      pageType: component.pageType,
      label: component.label,
      gameUrl: `/g/${slug}`,
      publicSlug: slug ?? undefined,
      role: component.role,
    });
  }
}
