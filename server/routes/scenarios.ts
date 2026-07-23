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
import { publicWriteLimiter } from "../utils/rate-limiters";
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
    case "host_blessing_wall":
      return { title: `${scenarioName} 祝福牆`, subtitle: "掃 QR 匿名留下祝福", maxLength: 30 };
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
    case "shooting_mission":
      return {
        title: `${scenarioName} 打擊挑戰`,
        requiredHits: 10,
        timeLimit: 120,
        targetScore: 500,
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

    case "consensus_scale":
      return {
        title: "📊 共識量表",
        question: "你對這個提案的支持程度？",
        scaleMin: 1,
        scaleMax: 5,
        minLabel: "完全不同意",
        maxLabel: "完全同意",
        showAverage: true,
        showDistribution: true,
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

    case "gratitude_wall":
      return {
        title: "💖 感恩塗鴉牆",
        prompt: "寫下你的感謝，讓溫暖傳遞！",
        placeholder: "感謝…",
        maxLength: 80,
        maxCardsPerPerson: 3,
        showAuthor: true,
        cardColors: ["bg-yellow-100", "bg-pink-100", "bg-blue-100", "bg-green-100", "bg-purple-100", "bg-orange-100"],
      };

    case "bucket_list":
      return {
        title: "⭐ 集體願望清單",
        prompt: "寫下你想在這次活動實現的事！",
        placeholder: "我想要…",
        maxItemsPerPerson: 3,
        maxItemLength: 40,
        allowSupport: true,
      };

    case "challenge_board":
      return {
        title: "⚡ 挑戰公告欄",
        prompt: "發布挑戰，看誰敢接！",
        maxChallengesPerPerson: 2,
        maxChallengeLength: 50,
        rewardEmoji: "⚡",
      };

    case "emoji_battle":
      return {
        title: "🎭 Emoji 表情大戰",
        question: "現在你的心情是？",
        emojis: [
          { emoji: "😄", label: "超開心" },
          { emoji: "😎", label: "很酷" },
          { emoji: "🤔", label: "在想" },
          { emoji: "😴", label: "有點累" },
          { emoji: "🔥", label: "超燃" },
          { emoji: "💪", label: "準備好了" },
        ],
        allowMultiSelect: false,
        showResults: true,
      };

    case "photo_contest":
      return {
        title: "📸 照片競賽",
        prompt: "上傳你的最佳作品，讓大家投票！",
        theme: "",
        maxPhotosPerPerson: 2,
        allowVoteOwn: false,
        showAuthor: true,
        maxCaptionLength: 60,
      };

    case "speed_networking":
      return {
        title: "⚡ 速配社交",
        prompt: "輪流和不同人對話，認識新朋友！",
        roundDurationSeconds: 120,
        questions: [
          "你現在最專注的一件事是什麼？",
          "這次活動你最期待什麼？",
          "用一個詞描述你自己？",
        ],
        showMatchedCount: true,
      };

    case "idea_wall":
      return {
        title: "💡 創意投票牆",
        prompt: "分享你的點子，大家投票選最好的！",
        placeholder: "寫下你的想法…",
        maxLength: 80,
        maxIdeasPerPerson: 3,
        showAuthor: true,
        allowVoteOwn: false,
      };

    case "live_pulse":
      return {
        title: "⚡ 即時活力計",
        subtitle: "一起點擊，感受全場能量！",
        prompt: "點擊提升活力！",
        maxLevel: 200,
      };

    case "team_contract":
      return {
        title: "📜 團隊承諾書",
        contractText: "我們承諾彼此尊重、積極合作，共同達成目標！",
        pledgeLabel: "我承諾！",
        showSigners: true,
        celebrationText: "全員完成簽署！",
      };

    case "priority_rank":
      return {
        title: "🏆 優先順序排名",
        question: "請依重要程度排列以下項目（1 = 最重要）",
        items: [
          { id: "a", label: "項目 A", emoji: "🔵" },
          { id: "b", label: "項目 B", emoji: "🟢" },
          { id: "c", label: "項目 C", emoji: "🟡" },
          { id: "d", label: "項目 D", emoji: "🔴" },
        ],
        showConsensus: true,
      };

    case "hot_seat":
      return {
        title: "🔥 熱烤椅",
        instructions: "一人上場，全場提問！舉手準備好了嗎？",
        durationSeconds: 180,
        maxQuestionsPerRound: 5,
      };

    case "project_showcase":
      return {
        title: "🚀 專案展示",
        prompt: "展示你的成果，讓大家投票！",
        maxProjectsPerPerson: 1,
        maxTitleLength: 30,
        maxDescLength: 150,
        allowVoteOwn: false,
        emojiReactions: ["🔥", "⭐", "💡", "👏", "🏆"],
        showVoteCount: true,
      };

    case "team_health_check":
      return {
        title: "💪 團隊健康評估",
        dimensions: [
          { id: "safety", label: "心理安全感", emoji: "🛡️", description: "可以自由表達意見" },
          { id: "comm", label: "溝通透明度", emoji: "💬", description: "資訊流通順暢" },
          { id: "trust", label: "互相信任", emoji: "🤝", description: "信任彼此的專業" },
          { id: "energy", label: "團隊能量", emoji: "⚡", description: "充滿活力與動力" },
        ],
        scaleMin: 1,
        scaleMax: 5,
        anonymous: true,
        showResults: true,
      };

    case "photo_caption":
      return {
        title: "📸 最佳配文大賽",
        photoUrl: "",
        prompt: "看到這張照片，你的第一個念頭是？",
        maxCaptionLength: 80,
        maxCaptionsPerPerson: 2,
        showVotes: true,
      };

    case "spectrum_line":
      return {
        title: "🎯 你在光譜的哪裡？",
        instructions: "拖動滑桿，告訴大家你的風格",
        questions: [
          { id: "q1", leftLabel: "內向", rightLabel: "外向", leftEmoji: "🤫", rightEmoji: "📢" },
          { id: "q2", leftLabel: "計畫型", rightLabel: "即興型", leftEmoji: "📋", rightEmoji: "🎲" },
          { id: "q3", leftLabel: "細節控", rightLabel: "大方向派", leftEmoji: "🔍", rightEmoji: "🌍" },
          { id: "q4", leftLabel: "獨立作業", rightLabel: "團隊合作", leftEmoji: "🧘", rightEmoji: "🤝" },
        ],
        showResults: true,
        showNames: true,
      };

    case "mad_libs":
      return {
        title: "🎭 我們的故事",
        story: "今天 {hero} 帶著一隻 {animal} 來到 {place}，大家都說這是 {year} 年最 {adj} 的一天！",
        blanks: [
          { id: "hero", label: "主角名字", hint: "填一個人名" },
          { id: "animal", label: "動物", hint: "任意動物" },
          { id: "place", label: "地點", hint: "真實或虛構地點" },
          { id: "year", label: "年份", hint: "數字" },
          { id: "adj", label: "形容詞", hint: "任意形容詞" },
        ],
        revealWhenFull: true,
      };

    case "agreement_matrix":
      return {
        title: "📊 觀點評分",
        instructions: "請對以下陳述表達你的意見",
        statements: [
          { id: "s1", text: "團隊溝通暢通，資訊透明" },
          { id: "s2", text: "工作流程效率高，少有阻礙" },
          { id: "s3", text: "個人成長機會充足" },
          { id: "s4", text: "整體工作環境讓我感到滿意" },
        ],
        showResults: true,
      };

    case "estimation_game":
      return {
        title: "🃏 規劃撲克",
        question: "這個功能需要多少天完成？",
        unit: "天",
        options: ["1", "2", "3", "5", "8", "13", "21", "?"],
        showAverage: true,
        showAllEstimates: true,
      };

    case "hot_take":
      return {
        title: "🔥 熱議話題",
        instructions: "說出你最有爭議的看法，讓大家用 emoji 表態！",
        maxLength: 80,
        maxTakesPerPerson: 2,
        reactions: ["🔥", "💯", "🤔", "❄️", "💀"],
      };

    case "knowledge_check":
      return {
        title: "🧠 知識確認",
        questions: [
          {
            id: "q1",
            text: "今天課程中最重要的概念是什麼？",
            options: ["概念 A", "概念 B", "概念 C", "概念 D"],
            correctIndex: 0,
            explanation: "請依照實際課程內容修改。",
          },
        ],
        showExplanation: true,
        pointsPerCorrect: 10,
      };

    case "open_question":
      return {
        title: "💬 開放提問",
        question: "你今天最大的收穫是什麼？",
        maxLength: 100,
        maxAnswersPerPerson: 1,
        showAuthor: true,
        placeholder: "分享你的想法…",
      };

    case "countdown_challenge":
      return {
        title: "⏱️ 限時挑戰",
        challenge: "在 30 秒內說出 5 種台灣小吃！",
        durationSeconds: 30,
        successLabel: "完成了！",
        failLabel: "放棄",
        showLeaderboard: true,
      };

    case "team_poll":
      return {
        title: "🗳️ 快速投票",
        question: "你最支持哪個方案？",
        options: [
          { id: "o1", label: "方案 A", emoji: "🅰️" },
          { id: "o2", label: "方案 B", emoji: "🅱️" },
          { id: "o3", label: "方案 C", emoji: "🆎" },
        ],
        multiSelect: false,
        showResults: true,
        showVoterNames: true,
      };

    case "scaled_feedback":
      return {
        title: "📊 量表評分",
        instructions: "請為以下項目評分",
        questions: [
          { id: "q1", text: "整體活動滿意度", minLabel: "非常不滿意", maxLabel: "非常滿意" },
          { id: "q2", text: "活動流程順暢程度", minLabel: "非常不順", maxLabel: "非常流暢" },
          { id: "q3", text: "您的參與投入程度", minLabel: "完全沒投入", maxLabel: "完全投入" },
        ],
        scale: 5,
        showResults: true,
      };

    case "would_you_rather":
      return {
        title: "🤔 你選哪個？",
        optionA: "永遠只能在家工作",
        emojiA: "🏠",
        optionB: "永遠只能在辦公室工作",
        emojiB: "🏢",
        showVoterNames: true,
      };

    case "category_sort":
      return {
        title: "🗂️ 卡片分類",
        instructions: "請將每個項目拖放到最合適的分類",
        items: [
          { id: "i1", label: "每日站立會議" },
          { id: "i2", label: "衝刺規劃" },
          { id: "i3", label: "系統架構圖" },
          { id: "i4", label: "程式碼審查" },
          { id: "i5", label: "部署流程" },
          { id: "i6", label: "回顧會議" },
        ],
        categories: [
          { id: "c1", label: "流程", color: "#3B82F6" },
          { id: "c2", label: "技術", color: "#10B981" },
          { id: "c3", label: "團隊", color: "#F59E0B" },
        ],
        showConsensus: true,
      };

    // ─── shared / solo（簡單預設）───
    case "dialogue":
      return {
        character: { name: "主持人" },
        messages: [{ text: `歡迎來到 ${scenarioName}` }],
      };
    case "group_promise":
      return {
        title: "🤝 集體承諾宣言",
        pledgeText: "我承諾將今天學到的知識，落實應用在工作中，並在一個月內回報成果。",
        goalSigners: 20,
      };

    case "card_draw":
      return {
        title: "🎴 抽牌任務",
        cards: [
          { cardId: "c1", label: "破冰發問者", emoji: "🎤", description: "負責提出第一個問題" },
          { cardId: "c2", label: "記錄者", emoji: "📝", description: "負責記錄討論重點" },
          { cardId: "c3", label: "時間守護者", emoji: "⏱️", description: "負責提醒時間" },
          { cardId: "c4", label: "魔鬼代言人", emoji: "😈", description: "負責提出反對意見" },
          { cardId: "c5", label: "總結者", emoji: "🎯", description: "負責最後整理結論" },
        ],
        allowReveal: true,
      };

    case "silent_brainstorm":
      return {
        title: "🧠 靜默腦力激盪",
        question: "如何提升團隊協作效率？",
        maxLength: 100,
        maxIdeasPerPerson: 3,
        showAuthor: false,
      };

    case "group_cheer":
      return {
        title: "💪 集體應援",
        goal: 500,
        tapEmoji: "👏",
        celebrateMessage: "太厲害了！大家一起做到了！",
      };

    case "letter_to_self":
      return {
        title: "✉️ 給未來自己的信",
        prompt: "課程結束了，你想對三個月後的自己說什麼？",
        maxLength: 300,
        showAuthor: false,
      };

    case "presence_map":
      return {
        title: "🗺️ 個性地圖",
        xAxisLeft: "內向",
        xAxisRight: "外向",
        yAxisTop: "理性",
        yAxisBottom: "感性",
        showNames: true,
      };

    case "most_likely":
      return {
        title: "👑 最有可能",
        questions: [
          "最有可能熬夜打遊戲的人？",
          "最有可能在會議上打瞌睡的人？",
          "最有可能帶大家去好吃餐廳的人？",
        ],
        showResults: true,
      };

    case "sentence_completion":
      return {
        title: "💬 句子接龍",
        starter: "我認為這次活動…",
        maxLength: 80,
        maxPerPerson: 1,
        reactions: ["❤️", "😂", "👏"],
        showAuthor: true,
      };

    case "action_pledge":
      return {
        title: "🎯 行動宣誓牆",
        prompt: "這次課程結束後，你最想落實的一件事是什麼？",
        actionLabel: "我承諾會…",
        timelineOptions: ["1週內", "2週內", "1個月內", "3個月內"],
        showAuthor: true,
      };

    case "feedback_sandwich":
      return {
        title: "🥪 三明治反饋",
        targetName: "今天的訓練課程",
        goodPrompt: "最有收穫的是…",
        betterPrompt: "可以做得更好的是…",
        goPrompt: "回去之後我會…",
        maxLength: 150,
        showAuthor: false,
      };

    case "word_association":
      return {
        title: "💭 自由聯想",
        words: ["金門", "海邊", "旅行", "回憶", "美食"],
        maxResponseLength: 20,
        showAuthor: true,
      };

    case "emoji_check_in":
      return {
        title: "😊 表情打卡",
        question: "現在的心情/狀態是？",
        emojiOptions: ["😄", "🙂", "😐", "😴", "🤔", "😤", "🥳", "😰"],
        maxNoteLength: 60,
        noteRequired: false,
        showAuthor: true,
      };

    case "truth_or_myth":
      return {
        title: "🤔 真偽大考驗",
        statements: [
          { stmtId: "s1", text: "章魚有三顆心臟", isTrue: true },
          { stmtId: "s2", text: "人類只使用了大腦的 10%", isTrue: false },
          { stmtId: "s3", text: "蜂鳥是唯一能倒著飛行的鳥類", isTrue: true },
        ],
      };

    case "thinking_hats":
      return {
        title: "🎩 六頂思考帽",
        topic: "今天課程中最讓你印象深刻的一件事",
        hats: [
          { hatId: "white", color: "bg-gray-100 border-gray-300 text-gray-700", emoji: "⚪", name: "白帽", description: "事實與數據" },
          { hatId: "red", color: "bg-red-100 border-red-300 text-red-700", emoji: "🔴", name: "紅帽", description: "情感與直覺" },
          { hatId: "black", color: "bg-gray-800 border-gray-600 text-white", emoji: "⚫", name: "黑帽", description: "批判與風險" },
          { hatId: "yellow", color: "bg-yellow-100 border-yellow-300 text-yellow-700", emoji: "🟡", name: "黃帽", description: "樂觀與優勢" },
          { hatId: "green", color: "bg-green-100 border-green-300 text-green-700", emoji: "🟢", name: "綠帽", description: "創意與可能" },
          { hatId: "blue", color: "bg-blue-100 border-blue-300 text-blue-700", emoji: "🔵", name: "藍帽", description: "流程與總結" },
        ],
        maxLength: 120,
        showAuthor: true,
      };

    case "value_rank":
      return {
        title: "🏆 價值排序",
        prompt: "請依重要性排列以下價值觀（第一名最重要）",
        items: ["創新", "協作", "效率", "誠信", "學習"],
        showAuthor: false,
      };

    case "collective_poem":
      return {
        title: "📜 集體詩",
        prompt: "每人加入一行，共同寫一首詩",
        starter: "在那遙遠的地方，",
        maxLength: 50,
        showAuthor: false,
        maxLinesPerUser: 1,
      };

    case "bottle_letter":
      return {
        title: "🍾 漂流瓶",
        prompt: "寫下一句話或一個心願，讓它漂向陌生人",
        maxLength: 200,
        showAuthor: false,
      };

    case "time_capture":
      return {
        title: "🕰️ 時空膠囊",
        prompt: "寫下你現在的感受，封存給未來的自己",
        maxLength: 200,
        showAuthor: false,
      };

    case "glow_grow":
      return {
        title: "✨🌱 閃光點 & 成長點",
        prompt: "回顧這段時間，寫下你個人的閃光點與想繼續成長的地方",
        glowLabel: "閃光點",
        glowPrompt: "我做得很好的是…",
        growLabel: "成長點",
        growPrompt: "我想繼續改善的是…",
        maxLength: 150,
        showAuthor: false,
      };

    case "word_ladder":
      return {
        title: "🔗 詞語接龍",
        prompt: "每人輪流接龍，下一個詞必須以上一個詞的最後一字開頭",
        startWord: "金門",
        maxWordLength: 10,
      };

    case "hope_fear":
      return {
        title: "🌟⚡ 期待與擔憂",
        topic: "這次活動 / 計畫",
        hopeLabel: "期待",
        hopePrompt: "我希望能…",
        fearLabel: "擔憂",
        fearPrompt: "我擔心…",
        maxLength: 150,
        showAuthor: false,
      };

    case "number_guess":
      return {
        title: "🔢 數字競猜",
        question: "你每週花多少小時在開會上？",
        unit: "小時",
        minValue: 0,
        maxValue: 40,
        showAuthor: false,
      };

    case "never_have_i_ever":
      return {
        title: "🙅 我從來沒有…",
        prompt: "誠實作答，更好玩！",
        statements: [
          "在會議中偷滑手機",
          "把別人的功勞說成自己的",
          "在上班時間追劇",
        ],
        showWhoAdmitted: false,
      };

    case "reaction_wall":
      return {
        title: "🎭 你的反應是？",
        content: `${scenarioName} — 用 emoji 告訴大家你的感受！`,
        emojis: ["😊", "🤔", "😴", "🔥", "😎", "🥰"],
        showNames: false,
      };

    case "desert_island":
      return {
        title: "🏝️ 荒島求生",
        scenario: `如果參加「${scenarioName}」的你被困在荒島，你會帶哪 3 樣東西？`,
        numItems: 3,
        maxItemLength: 20,
        showAuthor: true,
      };

    case "category_challenge":
      return {
        title: "🗂️ 分類大挑戰",
        category: scenarioName,
        prompt: `盡可能列出你覺得屬於「${scenarioName}」的項目！`,
        maxItemsPerPerson: 5,
        maxItemLength: 15,
        showCommon: true,
      };

    case "word_bid":
      return {
        title: "🏷️ 字詞競標",
        topic: scenarioName,
        prompt: `用一個詞代表「${scenarioName}」！大家投票選最佳代言詞。`,
        maxWordLength: 8,
        maxVotesPerPerson: 2,
      };

    case "memory_lane":
      return {
        title: "💭 記憶走廊",
        question: `關於「${scenarioName}」，你最難忘的一個瞬間是什麼？`,
        maxLength: 150,
        showAuthor: true,
      };

    case "emoji_story":
      return {
        title: "🎭 Emoji 故事創作",
        prompt: `用 3 個 Emoji 說出你在「${scenarioName}」的心情或故事`,
        emojiOptions: [],
        maxEmojis: 3,
        captionMaxLength: 30,
        showAuthor: true,
      };

    case "mind_sync":
      return {
        title: "🧠 默契大考驗",
        description: `看看大家在「${scenarioName}」中想法有多一致！`,
        questions: ["最想做的一件事？", "最難忘的瞬間？", "最想感謝誰？"],
        maxAnswerLength: 15,
      };

    case "color_pulse":
      return {
        title: "🎨 色彩心情牆",
        prompt: `選一個最能代表你在「${scenarioName}」心情的顏色`,
        colors: [],
        maxNoteLength: 25,
        showAuthor: true,
      };

    case "celebration_wall":
      return {
        title: "🎉 勝利分享牆",
        prompt: `分享一件你在「${scenarioName}」中想慶祝的事！`,
        maxLength: 80,
        showAuthor: true,
      };

    case "group_contract":
      return {
        title: "📜 共識公約制定",
        prompt: `提出你認為「${scenarioName}」最重要的一條規則`,
        maxRuleLength: 40,
        topN: 3,
      };

    case "silent_debate":
      return {
        title: "🤫 靜默辯論",
        topic: `關於「${scenarioName}」你有什麼看法？`,
        proLabel: "正方",
        conLabel: "反方",
        maxLength: 100,
      };

    case "points_auction":
      return {
        title: "🪙 虛擬競標",
        items: [
          { itemId: "item-1", label: "優先發言權", description: "下一輪優先發言" },
          { itemId: "item-2", label: "題目選擇權", description: "選擇下一道題目" },
          { itemId: "item-3", label: "加分機會", description: "額外加 10 分" },
        ],
        startingCoins: 100,
      };

    case "emoji_reaction":
      return {
        title: "🎭 Emoji 情緒反應",
        prompt: `對於「${scenarioName}」，用一個 Emoji 表達你現在的感受`,
        maxNote: 30,
      };

    case "confirm_it":
      return {
        title: "✅ 信心投票",
        statement: `關於「${scenarioName}」的這個說法，你認為正確嗎？`,
        showConfidence: true,
      };

    case "rate_idea":
      return {
        title: "⭐ 想法評分",
        prompt: `為「${scenarioName}」中的每個想法打星星（1-5 星）`,
        ideas: [
          { ideaId: "idea-1", text: "想法一" },
          { ideaId: "idea-2", text: "想法二" },
          { ideaId: "idea-3", text: "想法三" },
        ],
      };

    case "kudos_wall":
      return {
        title: "💌 感謝牆",
        prompt: `在「${scenarioName}」結束前，向誰說一句感謝？`,
        maxLength: 80,
      };

    case "progress_check":
      return {
        title: "📊 進度確認",
        prompt: `「${scenarioName}」的任務，你完成了多少？`,
        showNotes: true,
      };

    case "freeze_frame":
      return {
        title: "📸 現況快照",
        prompt: `「${scenarioName}」中，你現在在做什麼？進度如何？`,
        maxLength: 80,
      };

    case "two_column":
      return {
        title: "⚖️ 雙欄分類",
        leftLabel: "優點 / 支持",
        rightLabel: "缺點 / 反對",
        maxLength: 60,
      };

    case "group_mood":
      return {
        title: "😊 團隊能量儀表",
        prompt: `「${scenarioName}」開始前，大家的能量如何？`,
        minLabel: "很低落",
        maxLabel: "超亢奮",
      };

    case "daily_intention":
      return {
        title: "🎯 今日意圖",
        prompt: `在「${scenarioName}」中，你最想專注在什麼上面？`,
        maxLength: 60,
      };

    case "clue_reveal":
      return {
        title: "🔍 解謎線索",
        clues: ["第一條線索", "第二條線索", "第三條線索"],
        minCluesBeforeGuess: 1,
      };

    case "table_group":
      return {
        title: "🪑 桌組分配",
        tableCount: 4,
        tableNames: ["桌 A", "桌 B", "桌 C", "桌 D"],
      };

    case "feedback_form":
      return {
        title: "📋 活動回饋單",
        prompt: `請對「${scenarioName}」的各項進行評分`,
        dimensions: ["內容品質", "主持引導", "互動體驗", "整體滿意"],
      };

    case "quote_wall":
      return {
        title: "📜 名言牆",
        prompt: `在「${scenarioName}」中，分享一句你最喜歡的話`,
        maxLength: 100,
        placeholder: "例如：凡走過，必留下痕跡",
      };

    case "action_item":
      return {
        title: "✅ 行動承諾",
        prompt: `完成「${scenarioName}」後，你打算採取什麼行動？`,
        maxLength: 60,
        timeOptions: ["今天", "本週", "本月"],
      };

    case "role_play_card":
      return {
        title: "🎭 角色扮演卡",
        roles: ["領導者", "觀察者", "挑戰者", "支持者", "記錄者"],
      };

    case "group_decision":
      return {
        title: "🗳️ 群體決策",
        question: `在「${scenarioName}」中，你支持哪個方向？`,
        options: ["繼續推進", "暫時觀望", "重新討論"],
      };

    case "heat_map":
      return {
        title: "🔥 熱區投票",
        rowLabels: ["重要", "不重要"],
        colLabels: ["緊急", "不緊急"],
      };

    case "energy_boost":
      return {
        title: "⚡ 能量加速器",
        prompt: `在「${scenarioName}」中，送出你的能量鼓勵給某人！`,
        maxLength: 40,
        emojis: ["⚡", "🔥", "💪", "🌟", "❤️"],
      };

    case "aha_board":
      return {
        title: "💡 啊哈時刻牆",
        prompt: `在「${scenarioName}」中，你最大的啊哈頓悟是什麼？`,
        maxLength: 80,
      };

    case "one_line_story":
      return {
        title: "✍️ 一句故事",
        prompt: `用一句話，說出你對「${scenarioName}」的感受或故事`,
        maxLength: 60,
      };

    case "speed_typing":
      return {
        title: "⌨️ 競速打字",
        phrase: `快速輸入這段關於${scenarioName}的文字`,
        maxSeconds: 30,
      };

    case "skill_swap":
      return {
        title: "🔄 技能交換牆",
        offerPrompt: `在「${scenarioName}」中我能提供什麼？`,
        wantPrompt: `我想向大家學什麼？`,
        maxLength: 20,
        showAuthor: true,
      };

    case "anonymous_voice":
      return {
        title: "🗣️ 匿名心聲",
        prompt: `關於「${scenarioName}」，你有什麼話想匿名說出來？`,
        maxLength: 120,
      };

    case "pitch_vote":
      return {
        title: "💡 創意提案評分",
        prompt: `為「${scenarioName}」提出一個創意點子，讓大家來評分！`,
        maxLength: 60,
        showAuthor: true,
      };

    case "prediction_poll":
      return {
        title: "🔮 預測投票",
        question: `你覺得「${scenarioName}」中，大家最常選哪個？`,
        options: [
          { optionId: "a", label: "選項 A" },
          { optionId: "b", label: "選項 B" },
          { optionId: "c", label: "選項 C" },
        ],
      };

    case "audience_q":
      return {
        title: "🎤 現場提問",
        prompt: `有關於「${scenarioName}」想問的問題嗎？`,
        maxLength: 100,
        showAuthor: true,
      };

    case "tasting_notes":
      return {
        title: "🍷 品鑑筆記",
        prompt: `分享你對這次「${scenarioName}」品項的感受`,
        itemLabel: "品項名稱",
        showItemName: true,
        maxNotesLength: 100,
        showAuthor: true,
      };

    case "time_vault":
      return {
        title: "⏳ 時光膠囊",
        prompt: `寫下你想在「${scenarioName}」結束後回頭看的話`,
        revealLabel: "活動結束後開封",
        maxLength: 150,
        showAuthor: true,
      };

    case "idea_market":
      return {
        title: "💡 創意市集",
        prompt: `用一句話說出你在「${scenarioName}」中想到的點子`,
        tokenBudget: 5,
        maxIdeaLength: 60,
        showAuthor: true,
      };

    case "personal_fact":
      return {
        title: "🎭 趣味自我揭秘",
        prompt: `說一個關於你自己、讓大家驚訝的小事`,
        maxLength: 80,
        showAuthor: true,
      };

    case "quiz_blitz":
      return {
        title: "⚡ 快問快答",
        prompt: `關於「${scenarioName}」的趣味問答`,
        questions: [],
        showLeaderboard: true,
      };

    case "word_cloud":
      return {
        title: "💬 文字雲",
        prompt: `用一到三個詞描述你在「${scenarioName}」的感受`,
        maxWords: 3,
        maxWordLength: 10,
        showAuthor: false,
      };

    case "spin_wheel":
      return {
        title: "🎡 幸運轉盤",
        prompt: `把你的名字加入「${scenarioName}」轉盤，看誰幸運被選中！`,
        allowPlayerAdd: true,
      };

    case "open_mic":
      return {
        title: "🎤 開放麥克風",
        prompt: `在「${scenarioName}」尾聲，有什麼話想說嗎？`,
        maxTopicLength: 60,
      };

    case "fast_buzz":
      return {
        title: "🔔 搶答競賽",
        questions: [`${scenarioName}相關知識問答第一題？`, `${scenarioName}相關知識問答第二題？`],
      };

    case "crowd_answer":
      return {
        title: "🔢 猜猜看",
        question: `你猜「${scenarioName}」相關的數字是多少？`,
        unit: "",
        correctAnswer: 0,
      };

    case "emoji_slider":
      return {
        title: "😊 情緒滑桿",
        question: `參加「${scenarioName}」，你現在的感受是？`,
        leftEmoji: "😞",
        rightEmoji: "😄",
        leftLabel: "很低落",
        rightLabel: "很開心",
      };

    case "scene_vote":
      return {
        title: "🎭 你是哪種人",
        question: `在「${scenarioName}」中，你最像哪種角色？`,
        scenes: [
          { sceneId: "s1", label: "積極型", emoji: "🚀", description: "衝第一個報名" },
          { sceneId: "s2", label: "觀望型", emoji: "🔭", description: "先看看再說" },
          { sceneId: "s3", label: "享樂型", emoji: "🎉", description: "只要好玩就對了" },
        ],
      };

    case "timed_challenge":
      return {
        title: "⏱️ 限時挑戰",
        challengeText: `「${scenarioName}」限時挑戰：完成任務後按下按鈕！`,
        durationSeconds: 60,
      };

    case "rank_choice":
      return {
        title: "📊 優先排序",
        question: `請依重要性排列「${scenarioName}」的關鍵要素`,
        items: [
          { itemId: "r1", label: "第一選項" },
          { itemId: "r2", label: "第二選項" },
          { itemId: "r3", label: "第三選項" },
        ],
      };

    case "story_branch":
      return {
        title: "📖 故事分支",
        segments: [
          {
            segmentId: "s1",
            text: `「${scenarioName}」的冒險開始了！你面臨第一個選擇。`,
            choices: [
              { choiceId: "s1a", label: "選項 A", nextSegmentId: null },
              { choiceId: "s1b", label: "選項 B", nextSegmentId: null },
            ],
          },
        ],
      };

    case "mood_map":
      return {
        title: "🗺️ 心情地圖",
        prompt: `在「${scenarioName}」中，點擊地圖標記你現在的心情位置`,
        xLow: "低能量",
        xHigh: "高能量",
        yLow: "負面",
        yHigh: "正面",
      };

    case "pair_share":
      return {
        title: "🤝 配對分享",
        prompt: `在「${scenarioName}」中加入配對，系統會隨機幫你找一位夥伴分享`,
        pairingMode: "random",
      };

    case "brain_dump":
      return {
        title: "💡 腦力傾瀉",
        prompt: `盡量多寫！每行一個和「${scenarioName}」相關的想法`,
        maxItems: 5,
        maxLength: 40,
      };

    case "checkbox_vote":
      return {
        title: "☑️ 複選投票",
        question: `在「${scenarioName}」中，請選擇所有符合你想法的選項`,
        options: ["非常同意", "同意", "中立", "不同意", "有待討論"],
        maxChoices: 3,
      };

    case "song_wall":
      return {
        title: "🎵 歌曲牆",
        prompt: `選一首代表你在「${scenarioName}」心情的歌`,
        maxLength: 50,
        songPlaceholder: "歌曲名稱",
        artistPlaceholder: "歌手 / 樂團",
      };

    case "personal_compass":
      return {
        title: "🧭 個人指南針",
        northLabel: "N 優勢",
        southLabel: "S 挑戰",
        eastLabel: "E 機會",
        westLabel: "W 障礙",
      };

    case "team_snapshot":
      return {
        title: "📸 團隊快照",
        fields: ["開心的事", "擔心的事", "需要支援"],
        maxLength: 50,
      };

    case "success_story":
      return {
        title: "🏆 成功故事牆",
        prompt: `分享一個在「${scenarioName}」中讓你感到驕傲的成就`,
        achievementLabel: "成就名稱",
        detailLabel: "故事細節（可選）",
        maxLength: 150,
      };

    case "future_idea":
      return {
        title: "🔭 未來願景",
        prompt: `想像「${scenarioName}」結束後的一年，描述你看到的改變`,
        horizon: "一年後",
        maxLength: 200,
      };

    case "value_card":
      return {
        title: "🃏 價值卡選單",
        prompt: `在「${scenarioName}」中，選出最能代表你的核心價值`,
        cardPool: ["誠信", "創新", "團隊合作", "顧客導向", "卓越", "學習成長", "責任", "多元包容", "永續發展", "服務精神"],
        maxSelect: 3,
      };

    case "thank_you_note":
      return {
        title: "💌 感謝便條",
        prompt: `「${scenarioName}」結束前，寫一張感謝便條給最支持你的夥伴`,
        recipientLabel: "感謝誰",
        messageLabel: "感謝的話",
        maxLength: 150,
        anonymous: false,
      };

    case "skill_map":
      return {
        title: "🗺️ 技能地圖",
        prompt: `在「${scenarioName}」中，告訴夥伴你能提供什麼、你需要什麼`,
        offerLabel: "我能提供",
        needLabel: "我需要幫助",
        maxLength: 80,
      };

    case "mood_board":
      return {
        title: "🎨 情緒看板",
        prompt: `「${scenarioName}」開始，選一個 emoji 代表你現在的心情`,
        emojiPool: ["😊", "😌", "🤔", "😤", "😴", "🥳", "😰", "🔥", "💪", "🌈", "⚡", "🫶"],
        notePlaceholder: "說說為什麼...",
        maxLength: 60,
      };

    case "learning_check":
      return {
        title: "📊 學習確認",
        prompt: `「${scenarioName}」結束，評估自己對各主題的掌握程度`,
        topics: ["概念理解", "實作能力", "應用情境"],
        selfRateLabel: "掌握度 1-5",
        maxLength: 100,
      };

    case "stand_point":
      return {
        title: "🗣️ 立場陳述",
        issue: `關於「${scenarioName}」的核心議題，你的立場是？`,
        stances: ["支持", "中立", "反對"],
        reasonLabel: "說明你的理由",
        maxLength: 150,
      };

    case "idea_market":
      return {
        title: "💡 創意市場",
        prompt: `為「${scenarioName}」提交你的點子，並為最喜歡的點子投票`,
        voteLabel: "投票",
        votesPerPlayer: 3,
        maxLength: 80,
        submissionLabel: "提交你的點子",
      };

    case "consensus_map":
      return {
        title: "🗺️ 共識地圖",
        prompt: `評估「${scenarioName}」中各選項的可行性與重要性`,
        topics: ["選項 A", "選項 B", "選項 C"],
        xLabel: "可行性",
        yLabel: "重要性",
        axisMin: 1,
        axisMax: 5,
      };

    case "speed_round":
      return {
        title: "⚡ 限時搶答",
        question: `關於「${scenarioName}」的搶答題目（請 admin 編輯）`,
        correctAnswer: "（請 admin 設定正確答案）",
        answerLabel: "輸入你的答案",
        maxLength: 60,
        hint: "",
      };

    case "scale_vote":
      return {
        title: "📊 滑桿投票",
        question: `你對「${scenarioName}」這個議題的支持程度？`,
        minLabel: "完全不支持",
        maxLabel: "完全支持",
        scaleMin: 0,
        scaleMax: 100,
        defaultValue: 50,
      };

    case "wish_bucket":
      return {
        title: "🌟 許願桶",
        prompt: `把你對「${scenarioName}」的期望投入桶中`,
        placeholder: "寫下你的願望或期望...",
        maxLength: 150,
        anonymous: false,
      };

    case "quick_poll":
      return {
        title: "📊 快速民調",
        question: `關於「${scenarioName}」，你的選擇是？`,
        options: ["非常同意", "同意", "不確定", "不同意", "非常不同意"],
        maxLength: 40,
      };

    case "token_vote":
      return {
        title: "🪙 代幣投票",
        question: `請將 10 枚代幣分配給「${scenarioName}」的重點項目`,
        options: ["第一優先", "第二優先", "第三優先"],
        totalTokens: 10,
      };

    case "gallery_vote":
      return {
        title: "🖼 作品票選",
        prompt: `提交你對「${scenarioName}」的創意答案，並為最喜歡的投票`,
        galleryLabel: "作品內容",
        placeholder: "輸入你的創意答案...",
        maxLength: 100,
      };

    case "personal_score":
      return {
        title: "⭐ 個人自評",
        prompt: `請針對「${scenarioName}」相關項目進行自我評分`,
        criteria: ["溝通能力", "團隊合作", "問題解決", "創意思維"],
        maxScore: 5,
      };

    case "time_check":
      return {
        title: "📍 進度回報",
        question: "你目前在哪個階段？",
        milestones: ["剛開始", "進行中", "快完成", "已完成"],
      };

    case "emoji_wall":
      return {
        title: "😊 表情牆",
        prompt: `用一個表情代表你對「${scenarioName}」的感受`,
        emojis: ["😊", "😎", "🤔", "😅", "🔥", "💪", "😴", "🤩", "😰", "🥳"],
        reasonLabel: "為什麼選這個？（選填）",
        askReason: true,
      };

    case "random_pick":
      return {
        title: "🎲 隨機抽選",
        prompt: "點擊下方按鈕參加抽選",
        pickCount: 1,
        joinLabel: "我要參加",
        pickLabel: "開始抽選",
      };

    case "collab_canvas":
      return {
        title: "📋 協作畫布",
        prompt: `將你對「${scenarioName}」的想法貼在對應的區域`,
        zones: ["Keep（保留）", "Drop（捨棄）", "Improve（改善）"],
        maxPerUser: 3,
        maxLength: 40,
      };

    case "number_line":
      return {
        title: "📍 數字定位",
        question: `關於「${scenarioName}」，你有幾分把握？`,
        min: 1,
        max: 10,
        unit: "分",
        lowLabel: "完全不確定",
        highLabel: "完全有把握",
      };

    case "two_by_two":
      return {
        title: "⊞ 2×2 優先矩陣",
        prompt: `關於「${scenarioName}」，請將你的想法放到最合適的位置`,
        xLowLabel: "難以執行",
        xHighLabel: "容易執行",
        yLowLabel: "低影響",
        yHighLabel: "高影響",
        itemLabel: "想法 / 計畫名稱",
      };

    case "countdown_pledge":
      return {
        title: "⏱️ 倒數承諾挑戰",
        challengeText: `挑戰：在時間內完成你的「${scenarioName}」承諾！`,
        durationMinutes: 5,
        pledgePrompt: "我在這個活動中承諾要...",
      };

    case "star_map":
      return {
        title: "⭐ 團隊星圖評估",
        prompt: `請針對「${scenarioName}」為每個維度評分`,
        dimensions: [
          { id: "comm", label: "溝通" },
          { id: "trust", label: "信任" },
          { id: "eff", label: "效率" },
          { id: "morale", label: "士氣" },
        ],
        max: 5,
      };

    case "flash_card":
      return {
        title: "🃏 閃卡測驗",
        cards: [
          { cardId: "c1", front: `${scenarioName}的核心是什麼？`, back: "請主持人填入正確答案" },
          { cardId: "c2", front: `說出一個關於「${scenarioName}」的重要概念`, back: "請主持人填入正確答案" },
        ],
      };

    case "speed_brainstorm":
      return {
        title: "⚡ 快速腦力激盪",
        prompt: `關於「${scenarioName}」，在時限內盡量提出你的想法！`,
        timerSeconds: 60,
        maxIdeas: 5,
        maxLength: 40,
      };

    case "signal_map":
      return {
        title: "🚦 交通燈狀態確認",
        prompt: `你對「${scenarioName}」的準備程度是？`,
        greenLabel: "準備好了 🟢",
        yellowLabel: "還需要確認 🟡",
        redLabel: "還沒準備好 🔴",
      };

    case "team_time_capsule":
      return {
        title: "📦 團隊時光膠囊",
        prompt: `關於「${scenarioName}」，寫下你想留給未來的話語或心情...`,
        openingDate: "活動結束後一個月",
      };

    case "warm_cool":
      return {
        title: "🔥❄️ 暖涼回饋",
        target: scenarioName,
        warmPrompt: "🔥 暖：什麼做得很好？",
        coolPrompt: "❄️ 涼：什麼可以改善？",
        maxLength: 100,
      };

    case "give_get":
      return {
        title: "🤝 技能交換板",
        givePrompt: "💪 我可以提供...",
        getPrompt: "🙏 我需要幫助...",
        maxLength: 80,
      };

    case "ask_me_anything":
      return {
        title: "🙋 Ask Me Anything",
        prompt: `關於「${scenarioName}」，有什麼想問的嗎？`,
        maxLength: 120,
      };

    case "rose_bud_thorn":
      return {
        title: "🌹 Rose Bud Thorn 回顧",
        rosePrompt: "🌹 Rose：值得慶祝的事",
        budPrompt: "🌱 Bud：值得期待的潛力",
        thornPrompt: "🌵 Thorn：遇到的困難或阻礙",
        maxLength: 80,
      };

    case "event_timeline":
      return {
        title: "📅 共享時間軸",
        prompt: `關於「${scenarioName}」，寫下一個你認為重要的時間點與事件`,
        timePlaceholder: "例：2024年、第3個月、Q2...",
        maxLength: 80,
      };

    case "yes_no_maybe":
      return {
        title: "✅ 快速共識確認",
        question: `關於「${scenarioName}」，你同意這個方向嗎？`,
      };

    case "group_norm":
      return {
        title: "📜 團隊工作約定",
        prompt: `針對「${scenarioName}」，提出一條你希望團隊遵守的工作約定`,
        maxLength: 80,
      };

    case "hope_fear":
      return {
        title: "🌟 希望與恐懼",
        hopePrompt: `🌟 希望：關於「${scenarioName}」，我期待...`,
        fearPrompt: `😨 恐懼：關於「${scenarioName}」，我擔心...`,
        maxLength: 100,
      };

    case "story_wall":
      return {
        title: "📖 故事牆",
        prompt: `關於「${scenarioName}」，分享一段你的親身經歷或故事`,
        maxTitleLength: 40,
        maxLength: 200,
      };

    case "quick_reaction":
      return {
        title: "⚡ 快速反應",
        prompt: `對於「${scenarioName}」，用一個 emoji 表達你的感受！`,
      };

    case "personal_highlight":
      return {
        title: "⭐ 個人亮點",
        prompt: `在「${scenarioName}」這個主題上，分享你最值得驕傲的成就或亮點`,
        detailLabel: "補充說明（選填）",
      };

    case "kpt_retro":
      return {
        title: "🔄 KPT 回顧",
        keepLabel: "Keep（繼續保持）",
        problemLabel: "Problem（遇到問題）",
        tryLabel: "Try（下次嘗試）",
      };

    case "confidence_vote":
      return {
        title: "⭐ 信心投票",
        question: `對於「${scenarioName}」這個決定，你的信心程度是？`,
        maxScore: 5,
      };

    case "team_goal":
      return {
        title: "🎯 團隊目標",
        prompt: `關於「${scenarioName}」，你認為最重要的一個團隊目標是什麼？`,
        placeholder: "輸入你的目標...",
      };

    case "start_stop_continue":
      return {
        title: "🔁 Start / Stop / Continue",
        startLabel: "Start（開始做）",
        stopLabel: "Stop（停止做）",
        continueLabel: "Continue（繼續做）",
      };

    case "plus_even_better":
      return {
        title: "➕ Plus / Even Better",
        plusLabel: "➕ Plus（做得好的地方）",
        evenBetterLabel: "💡 Even Better（可以更好的地方）",
      };

    case "meeting_check":
      return {
        title: "✅ 會議結束確認",
        prompt: `關於「${scenarioName}」這次活動，你的評分是？`,
        takeawayLabel: "你最大的收穫是什麼？",
      };

    case "headline_news":
      return {
        title: "📰 未來頭條",
        prompt: `想像六個月後，你希望看到什麼關於「${scenarioName}」的新聞標題？`,
        timeframe: "6 個月後",
      };

    case "risk_radar":
      return {
        title: "⚠️ 風險雷達",
        prompt: `關於「${scenarioName}」，你認為最大的風險是什麼？`,
      };

    case "two_words":
      return {
        title: "✌️ 兩個字",
        prompt: `用兩個字描述「${scenarioName}」這次活動`,
        wordALabel: "第一個字",
        wordBLabel: "第二個字",
      };

    case "win_win":
      return {
        title: "🏆 雙贏回顧",
        prompt: `關於「${scenarioName}」，團隊贏了什麼？你個人贏了什麼？`,
        teamWinLabel: "🏆 團隊贏了…",
        myWinLabel: "⭐ 我個人贏了…",
      };

    case "impact_card":
      return {
        title: "⭐ 影響力卡片",
        prompt: `在「${scenarioName}」中，你帶來什麼影響？`,
        achievementLabel: "🏅 你的一個成就",
        skillLabel: "💪 你帶來的技能/特質",
      };

    case "open_quiz":
      return {
        title: "❓ 開放問答",
        prompt: `關於「${scenarioName}」，提一個問題並給出你自己的答案`,
        questionLabel: "你的問題",
        answerLabel: "你的答案",
      };

    case "micro_bio":
      return {
        title: "👤 迷你履歷",
        prompt: `在「${scenarioName}」中，用三個關鍵詞介紹自己！`,
        superpowerLabel: "⚡ 我的超能力",
        funFactLabel: "🎲 一個冷知識",
        goalLabel: "🎯 今天的目標",
      };

    case "after_action":
      return {
        title: "🔍 事後覆盤",
        prompt: `「${scenarioName}」結束後——哪些做對了？哪些出了問題？學到了什麼？`,
        wellLabel: "✅ 做得好的",
        wrongLabel: "❌ 出了問題的",
        lessonsLabel: "💡 學到的教訓",
      };

    case "team_animal":
      return {
        title: "🦁 團隊隱喻",
        prompt: `如果「${scenarioName}」的團隊是一種動物（電影/歌曲/食物），會是什麼？`,
        subjectLabel: "🦁 你選的隱喻",
        reasonLabel: "💬 理由（30 字以內）",
      };

    case "reverse_brainstorm":
      return {
        title: "🙃 反向腦力激盪",
        prompt: `關於「${scenarioName}」——如何讓它變得更糟？提出一個反向觀點！`,
        placeholder: "最糟糕的做法是...",
      };

    case "four_ls":
      return {
        title: "🔄 四 L 覆盤",
        prompt: `從四個角度反思「${scenarioName}」，至少填寫一項`,
        likedLabel: "👍 Liked（喜歡的）",
        learnedLabel: "💡 Learned（學到的）",
        lackedLabel: "❓ Lacked（缺少的）",
        longedLabel: "🌟 Longed for（期待的）",
      };

    case "wonder_board":
      return {
        title: "🤔 好奇探索板",
        prompt: `關於「${scenarioName}」，說一件你好奇的事——用「我好奇...」開頭`,
        placeholder: "我好奇...",
      };

    case "obstacle_map":
      return {
        title: "🚧 障礙地圖",
        prompt: `在「${scenarioName}」中，說出一件正在阻礙你或我們前進的事`,
        placeholder: "我被...卡住了",
      };

    case "common_ground":
      return {
        title: "🤝 共同點地圖",
        prompt: `在「${scenarioName}」中，說一件你和這個團隊有共同點的事！`,
        placeholder: "我和大家的共同點是...",
      };

    case "survey_block":
      return {
        title: "📋 快速問卷",
        prompt: `完成「${scenarioName}」後，請回答以下問題`,
        questions: ["整體體驗如何？", "團隊合作順暢嗎？", "有什麼想改善的地方？"],
        options: ["非常好", "還不錯", "有待改善"],
      };

    case "thought_bubble":
      return {
        title: "💭 思緒泡泡",
        prompt: `在「${scenarioName}」的此刻，你腦海中最想說的一句話是什麼？`,
        placeholder: "說出你的想法...",
      };

    case "energy_level":
      return {
        title: "⚡ 能量值",
        prompt: `現在你在「${scenarioName}」中的能量值是幾分？（1 = 很低，5 = 很高）`,
      };

    case "team_vision":
      return {
        title: "🌟 團隊願景",
        prompt: `用一個關鍵詞描述你對「${scenarioName}」的期望或願景？`,
        maxLength: 20,
      };

    case "future_me":
      return {
        title: "🚀 給未來的我",
        prompt: `寫一段話給在「${scenarioName}」結束後的未來自己，一個提醒或一個承諾。`,
        horizons: ["1 年後", "3 年後", "5 年後"],
      };

    case "growth_edge":
      return {
        title: "📈 成長邊界",
        prompt: `透過「${scenarioName}」，你發現自己最想成長的一個領域是什麼？打算採取什麼行動？`,
      };

    case "values_card":
      return {
        title: "💎 價值觀卡",
        prompt: `從以下選項中，選出最能代表你在「${scenarioName}」中展現的 3 個核心價值觀。`,
        maxSelect: 3,
      };

    case "opinion_slider":
      return {
        title: "📊 意見滑桿",
        question: `對於「${scenarioName}」的核心理念，你的立場在哪裡？`,
        leftLabel: "完全不同意",
        rightLabel: "完全同意",
      };

    case "strength_spot":
      return {
        title: "⭐ 優勢聚焦",
        prompt: `在「${scenarioName}」的情境中，你最能發揮的一個優勢是什麼？`,
      };

    case "challenge_flag":
      return {
        title: "🚩 挑戰旗幟",
        prompt: `在「${scenarioName}」的過程中，你目前面臨的最大挑戰是什麼？`,
        placeholder: "說出你的挑戰，讓團隊知道...",
      };

    case "question_jar":
      return {
        title: "🫙 問題罐",
        prompt: `關於「${scenarioName}」，把你最想問的問題投進罐子裡！`,
        placeholder: "你的問題（匿名送出）...",
        anonymous: true,
      };

    case "work_style":
      return {
        title: "💼 工作風格",
        prompt: `拖曳滑桿，定位你在「${scenarioName}」中的工作風格偏好。`,
        collabLow: "獨立作業",
        collabHigh: "協作共創",
        structureLow: "彈性自由",
        structureHigh: "結構清晰",
      };

    case "reflection_card":
      return {
        title: "💡 回顧反思",
        workedLabel: "✅ 做得好的地方",
        improveLabel: "💡 可以改善的地方",
        actionLabel: "🚀 下一步行動",
        workedPlaceholder: `在「${scenarioName}」中做得不錯的是...`,
        improvePlaceholder: "如果重來，我會...",
        actionPlaceholder: "我接下來要做的是...",
      };

    case "peak_moment":
      return {
        title: "🏔️ 最高光時刻",
        prompt: `在「${scenarioName}」中，你印象最深刻的一個高光時刻是什麼？`,
        momentPlaceholder: "最難忘的一個時刻...",
        feelingPlaceholder: "當時的感受（一個詞或一句話）",
      };

    case "safety_check":
      return {
        title: "🛡️ 心理安全感",
        prompt: `評估你目前在「${scenarioName}」這個團隊中的感受（1=非常低，5=非常高）`,
      };

    case "expectation_board":
      return {
        title: "🎯 期望看板",
        expectLabel: "🎯 我對這次活動的期望",
        contributeLabel: "🤝 我可以貢獻的是",
        expectPlaceholder: `我希望「${scenarioName}」能夠...`,
        contributePlaceholder: "我可以帶來...",
      };

    case "satisfaction_meter":
      return {
        title: "📊 滿意度量表",
        question: `你有多大可能向朋友推薦「${scenarioName}」這樣的活動？（0 = 完全不會，10 = 非常會）`,
        lowLabel: "完全不會",
        highLabel: "非常會",
        commentPlaceholder: "有什麼想說的嗎？（選填）",
      };

    case "team_flag":
      return {
        title: "🏴 團隊旗幟",
        prompt: `選或輸入最多 3 個詞，代表「${scenarioName}」這個團隊的文化或精神：`,
      };

    case "learning_objective":
      return {
        title: "📚 學習目標",
        prompt: `在「${scenarioName}」這次活動中，你最想達成的一個學習目標是什麼？`,
        placeholder: "我想要學會 / 理解 / 體驗...",
      };

    case "appreciation_note":
      return {
        title: "💌 感謝便條",
        prompt: `在「${scenarioName}」結束前，寫一張感謝便條給一位讓你印象深刻的隊友：`,
        placeholder: "謝謝你的...",
      };

    case "meeting_rating":
      return {
        title: "📋 會議評分",
        meetingName: scenarioName,
        feedbackPlaceholder: "有什麼想補充的嗎？（選填）",
      };

    case "skill_showcase":
      return {
        title: "⭐ 技能交流",
        offerLabel: "我能教大家",
        learnLabel: "我想學習",
      };

    case "habit_tracker":
      return {
        title: "🔄 習慣追蹤",
        prompt: `在「${scenarioName}」中，你最想建立的一個新習慣是什麼？`,
        habitPlaceholder: "例如：每天閱讀 30 分鐘",
        whyPlaceholder: "為什麼這個習慣對你重要？（選填）",
      };

    case "career_highlight":
      return {
        title: "🏆 職涯亮點",
        prompt: `在「${scenarioName}」中，分享你職涯中最自豪的一個成就：`,
        achievementPlaceholder: "例如：主導首次跨部門整合，成功讓三個團隊協作…",
        impactPlaceholder: "這個成就帶來什麼影響？（選填）",
      };

    case "superpower_card":
      return {
        title: "⚡ 超能力卡片",
        prompt: `在「${scenarioName}」中，如果你是超級英雄，你的超能力是什麼？`,
      };

    case "origin_story":
      return {
        title: "📖 起源故事",
        prompt: `在「${scenarioName}」中，分享一個讓你成為現在這個人的關鍵轉折點：`,
        turningPlaceholder: "那個改變你的時刻或事件是什麼？（≥5字）",
        lessonPlaceholder: "你從中學到了什麼？（選填）",
      };

    case "wisdom_pool":
      return {
        title: "💡 智慧池",
        prompt: `在「${scenarioName}」中，分享一句改變你思維或行動的智慧話語：`,
        wisdomPlaceholder: "這句話是什麼？（≥5字）",
        sourcePlaceholder: "來源：書籍、前輩、親身體驗…（選填）",
      };

    case "blind_spot":
      return {
        title: "👁 盲點揭示",
        prompt: `在「${scenarioName}」中，你的一個可能影響表現的盲點或習慣是什麼？`,
        blindPlaceholder: "我的盲點是…（≥5字）",
        actionPlaceholder: "我打算怎麼改善？（選填）",
      };

    case "life_line":
      return {
        title: "📈 人生時間軸",
        prompt: `在「${scenarioName}」中，哪 3 個時刻對你影響最深？`,
        theme: "關鍵時刻",
        maxEvents: 3,
      };

    case "talent_swap":
      return {
        title: "🔄 技能交換市集",
        teachPrompt: `在「${scenarioName}」中，你可以教哪位隊友什麼技能？`,
        learnPrompt: `你最想向哪位隊友學習什麼？`,
      };

    case "gift_box":
      return {
        title: "🎁 禮物盒",
        prompt: `在「${scenarioName}」中，你在哪位隊友身上看見了什麼珍貴特質？`,
        giftPlaceholder: "禮物名稱（如：傾聽的力量…）",
        messagePlaceholder: "給對方的一句話（選填）",
      };

    case "time_capsule":
      return {
        title: "⏳ 時光膠囊",
        prompt: `在「${scenarioName}」旅程結束時，寫下對未來團隊的期望與個人承諾`,
        openLabel: "下次聚會時",
      };

    case "team_pact":
      return {
        title: "📜 隊伍公約",
        prompt: `為「${scenarioName}」的隊伍提出一條共同遵守的規則或精神`,
        pactTitle: `${scenarioName} 公約`,
      };

    case "energy_map":
      return {
        title: "⚡ 能量地圖",
        prompt: `在「${scenarioName}」中，你現在的能量和意願各在哪個象限？`,
      };

    case "challenge_map":
      return {
        title: "🗺️ 挑戰地圖",
        prompt: `在「${scenarioName}」中，你目前面對的最大挑戰是什麼？`,
        placeholder: "描述你的挑戰…（≥5字）",
      };

    case "action_plan":
      return {
        title: "✅ 行動計畫",
        prompt: `完成「${scenarioName}」後，你打算採取的第一個具體行動是什麼？`,
      };

    case "vision_board":
      return {
        title: "🌟 願景板",
        prompt: `在「${scenarioName}」的脈絡下，你對未來的願景是什麼？`,
      };

    case "conflict_style":
      return {
        title: "⚡ 衝突風格",
        prompt: `在「${scenarioName}」情境中，面對意見分歧你最常用哪種應對方式？`,
      };

    case "peer_mirror":
      return {
        title: "🔮 同伴之鏡",
        prompt: `在「${scenarioName}」裡，你觀察到哪位隊友的哪個優點讓你印象深刻？`,
      };

    case "motivation_map":
      return {
        title: "⚡ 動力地圖",
        prompt: `在「${scenarioName}」的旅程中，最驅動你前進的核心動力是什麼？`,
      };

    case "hero_story":
      return {
        title: "⭐ 英雄故事",
        prompt: `在「${scenarioName}」的脈絡下，分享一個你克服困難、讓自己引以為傲的小故事`,
      };

    case "learning_style":
      return {
        title: "📚 學習風格",
        prompt: `在「${scenarioName}」中，你最容易吸收知識的方式是哪一種？`,
      };

    case "stress_signal":
      return {
        title: "📊 壓力信號",
        prompt: `在「${scenarioName}」進行中，現在的你壓力狀態如何？主要來自哪裡？`,
      };

    case "decision_style":
      return {
        title: "⚖️ 決策風格",
        prompt: `在「${scenarioName}」中面對重要決定時，你最傾向哪種方式？`,
      };

    case "three_words":
      return {
        title: "✍️ 三個字",
        prompt: `用三個詞語描述你對「${scenarioName}」此刻的感受或期待。`,
      };

    case "team_radar":
      return {
        title: "📡 團隊雷達",
        prompt: `請對「${scenarioName}」中的團隊五個面向各給一個分數（1-5），讓大家看見整體狀態！`,
      };

    case "today_feel":
      return {
        title: "💫 今天感覺",
        prompt: `參與「${scenarioName}」時，用一個詞語＋一個 emoji 描述你現在的感受！`,
      };

    case "speed_fact":
      return {
        title: "⚡ 閃速事實",
        prompt: `在「${scenarioName}」的大家面前，分享一個讓人意想不到的關於你的小事實！`,
      };

    case "color_vibe":
      return {
        title: "🎨 顏色心情",
        prompt: `參與「${scenarioName}」的你，現在的心情是什麼顏色？選一個最貼近的！`,
      };

    case "good_news":
      return {
        title: "🎉 好消息分享",
        prompt: `在「${scenarioName}」的大家庭裡，分享一個最近讓你開心的好消息或美好事物！`,
      };

    case "love_advice":
      return {
        title: "💕 愛的建議",
        prompt: `給「${scenarioName}」的主角，送上你最真摯的一句話建議或祝福！`,
      };

    case "fav_memory":
      return {
        title: "📸 最愛回憶",
        prompt: `關於「${scenarioName}」，分享一個你最珍惜、最難忘的共同回憶！`,
      };

    case "dream_trip":
      return {
        title: "✈️ 夢想旅行",
        prompt: `如果可以去任何地方，你最想去的夢想旅遊目的地是哪裡？`,
      };

    case "book_rec":
      return {
        title: "📚 好物推薦",
        prompt: `推薦一本書、一部電影或任何讓你收穫滿滿的好內容給「${scenarioName}」的夥伴！`,
      };

    case "motto_board":
      return {
        title: "💬 人生座右銘",
        prompt: `在「${scenarioName}」的場合，分享一句支撐你前行的座右銘或人生信條！`,
      };

    case "time_capacity":
      return {
        title: "⏰ 時間分配",
        prompt: `在「${scenarioName}」的主題下，分享你理想中的一週 168 小時時間分配！`,
      };

    case "wish_list":
      return {
        title: "✨ 願望清單",
        prompt: `在「${scenarioName}」的場合，許下一個你最想實現的願望，讓大家見證你的夢想！`,
      };

    case "strength_map":
      return {
        title: "💪 強項地圖",
        prompt: `在「${scenarioName}」的場合，選出你最核心的強項，並分享一個發揮它的真實故事！`,
      };

    case "secret_talent":
      return {
        title: "🎭 隱藏才能大揭密",
        prompt: `在「${scenarioName}」的場合，揭曉你的隱藏才能，讓大家大吃一驚！`,
      };

    case "life_lesson":
      return {
        title: "🌿 人生一堂課",
        prompt: `在「${scenarioName}」的場合，分享一個你從人生經歷中學到的寶貴功課！`,
      };

    case "animal_spirit":
      return {
        title: "🦁 精神動物",
        prompt: `在「${scenarioName}」的場合，如果你今天是一隻動物，你會是哪一隻？說說原因！`,
      };

    case "childhood_game":
      return {
        title: "🎮 童年遊戲記憶",
        prompt: `在「${scenarioName}」的場合，說說你童年最喜歡的遊戲，勾起大家的美好回憶！`,
      };

    case "mood_weather":
      return {
        title: "🌤️ 今日心情天氣",
        prompt: `在「${scenarioName}」的場合，如果你今天的心情是一種天氣，你會是哪種？`,
      };

    case "movie_genre":
      return {
        title: "🎬 我是哪種電影",
        prompt: `在「${scenarioName}」的場合，如果今天的你是一部電影，會是哪個類型？說說為什麼！`,
      };

    case "food_mood":
      return {
        title: "🍜 今天我是哪道料理",
        prompt: `在「${scenarioName}」的場合，如果今天的你是一道料理，你會是哪種？說說原因！`,
      };

    case "dream_job":
      return {
        title: "🚀 童年夢想職業",
        prompt: `在「${scenarioName}」的場合，你小時候最想成為什麼？說說當時的夢想故事！`,
      };

    case "travel_style":
      return {
        title: "✈️ 我的旅行風格",
        prompt: `在「${scenarioName}」的場合，你是哪種旅行者？說說你的夢想旅行地！`,
      };

    case "season_person":
      return {
        title: "🌸 我是哪個季節的人",
        prompt: `在「${scenarioName}」的場合，如果你是一個季節，你最像哪一個？說說原因！`,
      };

    case "color_personality":
      return {
        title: "🎨 我是哪種顏色",
        prompt: `在「${scenarioName}」的場合，哪個顏色最代表你今天的狀態？說說原因！`,
      };

    case "hero_type":
      return {
        title: "⚔️ 我的英雄職業",
        prompt: `在「${scenarioName}」的冒險中，你會選哪種英雄職業？說說為什麼！`,
      };

    case "pet_personality":
      return {
        title: "🐾 我是哪種寵物",
        prompt: `在「${scenarioName}」的場合，如果你是一隻寵物，你最像哪一種？說說你的個性！`,
      };

    case "music_genre":
      return {
        title: "🎵 我今天的音樂風格",
        prompt: `在「${scenarioName}」的今天，哪種音樂風格最符合你的狀態？說說感受！`,
      };

    case "elemental_type":
      return {
        title: "⚡ 我是哪種元素",
        prompt: `在「${scenarioName}」的場合，如果你是一種自然元素，你最像哪個？說說原因！`,
      };

    case "coffee_order":
      return {
        title: "☕ 我今天的飲料訂單",
        prompt: `在「${scenarioName}」的今天，哪杯飲料最像你的狀態？說說感覺！`,
      };

    case "plant_type":
      return {
        title: "🌿 我是哪種植物",
        prompt: `在「${scenarioName}」的場合，如果你是一種植物，你最像哪一種？說說你的個性！`,
      };

    case "city_type":
      return {
        title: "🌏 我是哪種城市",
        prompt: `在「${scenarioName}」的場合，如果你是一座城市，你最像哪個？說說你的氣質！`,
      };

    case "sport_vibes":
      return {
        title: "🏃 我今天的運動感",
        prompt: `在「${scenarioName}」的今天，哪種運動最符合你的狀態或個性？說說感受！`,
      };

    case "movie_role":
      return {
        title: "⭐ 我在故事中的角色",
        prompt: `在「${scenarioName}」的場合，如果你是故事裡的角色，你最像哪一種？說說原因！`,
      };

    case "gem_stone":
      return {
        title: "💎 我是哪種寶石",
        prompt: `在「${scenarioName}」的場合，如果你是一種寶石，你最像哪一種？說說你代表的特質！`,
      };

    case "myth_animal":
      return {
        title: "🐉 我是哪種神話神獸",
        prompt: `在「${scenarioName}」的場合，如果你是一種神話神獸，你最像哪一種？說說你的神獸特質！`,
      };

    case "tea_type":
      return {
        title: "🍵 我是哪種茶",
        prompt: `在「${scenarioName}」的場合，如果你是一種茶，你最像哪一種？說說你的茶道個性！`,
      };

    case "planet_type":
      return {
        title: "🪐 我是哪顆星球",
        prompt: `在「${scenarioName}」的場合，如果你是太陽系的一顆星球，你最像哪一顆？說說你的星球特質！`,
      };

    case "vehicle_type":
      return {
        title: "🚂 我是哪種交通工具",
        prompt: `在「${scenarioName}」的場合，如果你是一種交通工具，你最像哪一種？說說你的移動風格！`,
      };

    case "weather_type":
      return {
        title: "⛅ 我是哪種天氣",
        prompt: `在「${scenarioName}」的場合，如果你是一種天氣，你最像哪一種？說說你的天氣個性！`,
      };

    case "book_genre":
      return {
        title: "📚 我是哪種書",
        prompt: `在「${scenarioName}」的場合，如果你是一本書，你最像哪種類型？說說你的閱讀個性！`,
      };

    case "flower_type":
      return {
        title: "🌸 我是哪種花",
        prompt: `在「${scenarioName}」的場合，如果你是一朵花，你最像哪種？說說你的花語個性！`,
      };

    case "coffee_type":
      return {
        title: "☕ 我是哪種咖啡",
        prompt: `在「${scenarioName}」的場合，如果你是一杯咖啡，你最像哪種？說說你的咖啡個性！`,
      };

    case "tree_type":
      return {
        title: "🌳 我是哪種樹",
        prompt: `在「${scenarioName}」的場合，如果你是一棵樹，你最像哪種？說說你的樹木個性！`,
      };

    case "ocean_creature":
      return {
        title: "🐬 我是哪種海洋生物",
        prompt: `在「${scenarioName}」的場合，如果你是一種海洋生物，你最像哪種？說說你的海洋個性！`,
      };

    case "candy_type":
      return {
        title: "🍬 我是哪種糖果",
        prompt: `在「${scenarioName}」的場合，如果你是一種糖果，你最像哪種？說說你的甜蜜個性！`,
      };

    case "spice_type":
      return {
        title: "🌶️ 我是哪種香料",
        prompt: `在「${scenarioName}」的場合，如果你是一種香料，你最像哪種？說說你的香料個性！`,
      };

    case "board_game":
      return {
        title: "♟️ 我是哪種桌遊",
        prompt: `在「${scenarioName}」的場合，如果你是一種桌遊，你最像哪種？說說你的遊戲個性！`,
      };

    case "landscape_type":
      return {
        title: "🏔️ 我是哪種地景",
        prompt: `在「${scenarioName}」的場合，如果你是一種地景，你最像哪種？說說你的地景個性！`,
      };

    case "art_style":
      return {
        title: "🎨 我是哪種藝術風格",
        prompt: `在「${scenarioName}」的場合，如果你是一種藝術風格，你最像哪種？說說你的藝術個性！`,
      };

    case "insect_type":
      return {
        title: "🦋 我是哪種昆蟲",
        prompt: `在「${scenarioName}」的場合，如果你是一種昆蟲，你最像哪種？說說你的昆蟲個性！`,
      };

    case "gemstone_type":
      return {
        title: "💎 我是哪種寶石",
        prompt: `在「${scenarioName}」的場合，如果你是一種寶石，你最像哪種？說說你的珠寶個性！`,
      };

    case "mythical_creature":
      return {
        title: "🐉 我是哪種神話生物",
        prompt: `在「${scenarioName}」的場合，如果你是一種神話生物，你最像哪種？說說你的神話個性！`,
      };

    case "dance_style":
      return {
        title: "💃 我是哪種舞蹈",
        prompt: `在「${scenarioName}」的場合，如果你是一種舞蹈，你最像哪種？說說你的舞蹈個性！`,
      };

    case "architecture_style":
      return {
        title: "🏛️ 我是哪種建築風格",
        prompt: `在「${scenarioName}」的場合，如果你是一種建築風格，你最像哪種？說說你的建築個性！`,
      };

    case "cheese_type":
      return {
        title: "🧀 我是哪種起司",
        prompt: `在「${scenarioName}」的場合，如果你是一種起司，你最像哪種？說說你的起司個性！`,
      };

    case "mushroom_type":
      return {
        title: "🍄 我是哪種菇類",
        prompt: `在「${scenarioName}」的場合，如果你是一種菇類，你最像哪種？說說你的菇菇個性！`,
      };

    case "pasta_type":
      return {
        title: "🍝 我是哪種義大利麵",
        prompt: `在「${scenarioName}」的場合，如果你是一種義大利麵，你最像哪種？說說你的義麵個性！`,
      };

    case "sushi_type":
      return {
        title: "🍣 我是哪種壽司",
        prompt: `在「${scenarioName}」的場合，如果你是一種壽司，你最像哪種？說說你的壽司個性！`,
      };

    case "material_type":
      return {
        title: "🪵 我是哪種材質",
        prompt: `在「${scenarioName}」的場合，如果你是一種材質，你最像哪種？說說你的材質個性！`,
      };

    case "fruit_type":
      return {
        title: "🍎 我是哪種水果",
        prompt: `在「${scenarioName}」的場合，如果你是一種水果，你最像哪種？說說你的水果個性！`,
      };

    case "chocolate_type":
      return {
        title: "🍫 我是哪種巧克力",
        prompt: `在「${scenarioName}」的場合，如果你是一種巧克力，你最像哪種？說說你的巧克力個性！`,
      };

    case "bird_type":
      return {
        title: "🦅 我是哪種鳥類",
        prompt: `在「${scenarioName}」的場合，如果你是一種鳥類，你最像哪種？說說你的鳥類個性！`,
      };

    case "fish_type":
      return {
        title: "🐟 我是哪種魚",
        prompt: `在「${scenarioName}」的場合，如果你是一種魚，你最像哪種？說說你的魚類個性！`,
      };

    case "ice_cream_type":
      return {
        title: "🍦 我是哪種冰淇淋",
        prompt: `在「${scenarioName}」的場合，如果你是一種冰淇淋，你最像哪種？說說你的冰淇淋個性！`,
      };

    case "pizza_type":
      return {
        title: "🍕 我是哪種披薩",
        prompt: `在「${scenarioName}」的場合，如果你是一種披薩，你最像哪種？說說你的披薩個性！`,
      };

    case "curiosity_map":
      return {
        title: "🗺️ 好奇心地圖",
        prompt: `關於「${scenarioName}」，你最想深入了解或探索的問題是什麼？`,
        placeholder: "輸入你的好奇心問題...",
        maxLength: 80,
      };

    case "vibe_check":
      return {
        title: "🌡️ 氛圍感測",
        prompt: `請感受一下你對「${scenarioName}」的狀態`,
        dimensions: [
          { id: "energy", label: "能量", lowEmoji: "😴", highEmoji: "⚡" },
          { id: "focus", label: "專注", lowEmoji: "🌀", highEmoji: "🎯" },
          { id: "connect", label: "連結", lowEmoji: "🤐", highEmoji: "🤝" },
          { id: "confidence", label: "信心", lowEmoji: "😟", highEmoji: "💪" },
        ],
      };

    case "cascade_vote":
      return {
        title: "🗳️ 連續投票",
        questions: [
          {
            questionId: "q1",
            text: `你對「${scenarioName}」的整體感受？`,
            options: ["非常好", "還不錯", "有待改進"],
          },
          {
            questionId: "q2",
            text: `你認為「${scenarioName}」最需要加強的是？`,
            options: ["溝通", "合作", "創意", "執行力"],
          },
        ],
      };

    case "team_manifesto":
      return {
        title: "📜 團隊宣言",
        stem: `「${scenarioName}」的我們是...`,
        placeholder: "輸入一個關鍵詞",
        maxLength: 20,
        maxPerUser: 3,
      };

    case "sentence_stem":
      return {
        title: "✍️ 句子接龍",
        stemText: `「${scenarioName}」讓我想到...`,
        placeholder: "繼續這個句子...",
        maxLength: 80,
      };

    case "pixel_mood":
      return {
        title: "🎨 心情馬賽克",
        prompt: `用一個顏色代表你對「${scenarioName}」的心情`,
        moods: [
          { id: "happy", emoji: "😊", label: "開心", color: "#FFD700" },
          { id: "excited", emoji: "🚀", label: "興奮", color: "#FF6B35" },
          { id: "calm", emoji: "😌", label: "平靜", color: "#4ECDC4" },
          { id: "tired", emoji: "😴", label: "疲倦", color: "#95A5A6" },
          { id: "curious", emoji: "🤔", label: "好奇", color: "#9B59B6" },
          { id: "nervous", emoji: "😬", label: "緊張", color: "#E74C3C" },
        ],
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
            isDemo: games.isDemo,
          })
          .from(games);

        // 過濾：排除 demo + 場域隔離 + 含 [scenario:] 標記 + 最近 30 天
        const scenarioGames = allGames.filter((g) => {
          if (g.isDemo) return false; // 🆕 2026-07-05：demo 不計入正式統計
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
            isDemo: games.isDemo,
          })
          .from(games);

        const monthGames = allGames.filter((g) => {
          if (g.isDemo) return false; // 🆕 2026-07-05：demo 不佔配額
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

  /**
   * 🆕 2026-07-05：訪客 demo 沙盒 — 免登入一鍵體驗
   * POST /api/scenarios/:scenarioId/demo（公開、無 admin）
   *
   * 只開放「全 host 情境」（host 元件免登入即玩）；建臨時 demo 遊戲（isDemo + 2h TTL）、
   * fieldId=null（不綁場域、不污染統計），導訪客到大螢幕端 hostUrl 體驗。
   * 防濫用：publicWriteLimiter（每 IP 每小時 10 次）。過期由 demo-cleanup-cron 清理。
   */
  app.post(
    "/api/scenarios/:scenarioId/demo",
    publicWriteLimiter,
    async (req, res) => {
      try {
        const scenario = getScenarioById(req.params.scenarioId);
        if (!scenario) {
          return res.status(404).json({ error: "情境不存在" });
        }
        // 只允許全 host 情境（免登入即玩）；含 multi/shared 需登入組隊
        const allHost = scenario.components.every((c) => c.axis === "host");
        if (!allHost) {
          return res.status(400).json({
            error: "not_demoable",
            message: "此情境含需登入組隊的元件，不支援免登入體驗，請登入後於後台建場",
          });
        }

        const displayName = `[體驗] ${scenario.name}`.slice(0, 100);
        const now = Date.now();
        const DEMO_TTL_MS = 2 * 60 * 60 * 1000; // 2 小時
        const demoExpiresAt = new Date(now + DEMO_TTL_MS);
        // host session 的 token 效期與 demo 一致（2h），確保體驗期間可用
        const expiresAt = demoExpiresAt;

        const instances: ScenarioInstance[] = [];
        for (const component of scenario.components) {
          await instantiateComponent({
            scenarioId: scenario.id,
            scenarioDisplayName: displayName,
            component,
            fieldId: null, // demo 不綁場域
            expiresAt,
            collector: instances,
            isDemo: true,
            demoExpiresAt,
          });
        }

        const first = instances[0];
        res.status(201).json({
          scenario: { id: scenario.id, name: scenario.name, tagline: scenario.tagline },
          displayName,
          expiresAt: demoExpiresAt.toISOString(),
          instances,
          totalCreated: instances.length,
          // 訪客導向：第一個 host 元件的大螢幕（含常駐加入 QR）
          hostUrl: first?.hostUrl ?? null,
          playUrl: first?.playUrl ?? null,
        });
      } catch (err) {
        console.error("[scenarios] demo 建立失敗:", err);
        res.status(500).json({ error: "建立體驗失敗" });
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
  /** 🆕 2026-07-05：訪客 demo 沙盒（免登入臨時遊戲、到期自動清理）*/
  isDemo?: boolean;
  /** demo 遊戲到期時間（isDemo=true 時設）*/
  demoExpiresAt?: Date | null;
}

async function instantiateComponent(params: InstantiateComponentParams): Promise<void> {
  const { scenarioId, scenarioDisplayName, component, fieldId, expiresAt, collector, aiConfig } = params;
  const isDemo = params.isDemo ?? false;
  const demoExpiresAt = params.demoExpiresAt ?? null;

  const isHost = component.axis === "host";
  const gameMode = getGameModeForComponent(component);
  const slug = isHost ? null : generateSlug();
  // 🆕 軟分流階段 1：依 axis 自動推導 editorMode
  // host 軸 → 活動現場（不登入）/ 其他 → 遊戲（要登入）
  const editorMode = isHost ? "activity" : "game";

  // config 優先序（2026-06-13）：
  //   1. AI 生成（aiConfig）— admin 用 AI 客製
  //   2. 情境主題化（component.config）— 每個情境元件的 default 呈現內容
  //   3. pageType 通用 default — 最後 fallback
  const config =
    aiConfig ?? component.config ?? getDefaultConfigForPageType(component.pageType, scenarioDisplayName);

  const [game] = await db
    .insert(games)
    .values({
      title: `${scenarioDisplayName} - ${component.label}`,
      description: `情境模板實例：${component.role} [scenario:${scenarioId}]`,
      fieldId,
      maxPlayers: 100,
      status: "published",
      gameMode,
      editorMode,
      publicSlug: slug,
      isDemo,
      demoExpiresAt,
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
