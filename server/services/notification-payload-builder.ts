// 通知 payload 建構器 — 純函式（不依賴 db / fetch）
// 從 notification-dispatcher.ts 抽出，方便單元測試
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §16

// ============================================================================
// LINE Notify message 格式
// ============================================================================
export interface NotificationPayload {
  title: string;
  body: string;
  deepLink?: string;
  imageUrl?: string;
}

/**
 * 組合 LINE Notify 訊息（含標題、本文、連結）
 *
 * 純函式：不發送，只組字串
 */
export function buildLineNotifyMessage(payload: NotificationPayload): string {
  const parts = [`[${payload.title}]`, payload.body];
  if (payload.deepLink) parts.push(payload.deepLink);
  return parts.join("\n");
}

/**
 * 組合 LINE OA push message JSON
 */
export function buildLineOaMessage(payload: NotificationPayload): {
  type: "text";
  text: string;
} {
  return {
    type: "text",
    text: buildLineNotifyMessage(payload),
  };
}

/**
 * 組合 Discord webhook embed 結構
 */
export function buildDiscordEmbed(payload: NotificationPayload): {
  embeds: Array<Record<string, unknown>>;
} {
  return {
    embeds: [
      {
        title: payload.title,
        description: payload.body,
        url: payload.deepLink,
        color: 0x3b82f6, // 藍色
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * 組合通用 webhook payload（給社團 / Slack / Zapier 等）
 */
export function buildGenericWebhookPayload(opts: {
  eventType: string;
  fieldId: string;
  squadId?: string;
  userId?: string;
  payload: NotificationPayload;
}): Record<string, unknown> {
  return {
    event: opts.eventType,
    fieldId: opts.fieldId,
    squadId: opts.squadId,
    userId: opts.userId,
    title: opts.payload.title,
    body: opts.payload.body,
    deepLink: opts.payload.deepLink,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// 召回信內容（依天數）
// ============================================================================
export interface DormancyMessage {
  title: string;
  body: string;
}

/**
 * 依休眠天數產出召回信內容（純函式）
 */
export function buildDormancyMessage(daysSince: number): DormancyMessage {
  if (daysSince <= 3) {
    return {
      title: "🌱 你的隊伍想念你！",
      body: "已經 3 天沒對戰了，再打一場保持新人榜排名！",
    };
  }
  if (daysSince <= 7) {
    return {
      title: "⚡ 限時福利提醒",
      body: "1 週沒回來，回來打 1 場有 +50 體驗點獎勵！",
    };
  }
  if (daysSince <= 14) {
    return {
      title: "💎 最後機會",
      body: `${daysSince} 天沒回來，再不打就要進入休眠了。回來解鎖獎勵吧！`,
    };
  }
  return {
    title: "👋 久違了！",
    body: `${daysSince} 天沒見，回來看看新隊伍排名變化吧！`,
  };
}

// ============================================================================
// 升級通知
// ============================================================================
export function buildTierUpgradeMessage(tier: string): NotificationPayload {
  const labels: Record<string, string> = {
    bronze: "青銅",
    silver: "白銀",
    gold: "黃金",
    diamond: "鑽石",
    master: "名人",
  };
  const label = labels[tier] ?? tier;
  return {
    title: `🎉 升上${label}！`,
    body: `你的隊伍升上「${label}」段位，繼續加油！`,
  };
}

// ============================================================================
// 第一場上榜
// ============================================================================
export function buildFirstGameMessage(rank: number): NotificationPayload {
  return {
    title: "🎊 上榜啦！",
    body: `你的隊伍剛上「新人榜」第 ${rank} 名！再打一場挑戰前 10。`,
  };
}

// ============================================================================
// 獎勵發放
// ============================================================================
export function buildRewardIssuedMessage(rewardName: string): NotificationPayload {
  return {
    title: "🎁 你獲得獎勵了！",
    body: `「${rewardName}」已存入你的錢包，到「我的獎勵」查看。`,
    deepLink: "/me/rewards",
  };
}
