// 內部通知 service — Phase δ W3 D1
//
// 統一封裝「內部通知」事件：部署 / 系統錯誤 / 付款 / 玩家活動 / 預約 / 每日早報
//
// 收件人：admin / Hung 自己 / 內部團隊
// 通道：Telegram bot（免費、即時）
// 未來可擴：Slack、Discord、Email
//
// 設計：
//   - 每個事件 = 一個高層 function
//   - 內部用 markdown / 簡潔 emoji
//   - fire-and-forget：不 block 主流程
//   - rate limit：同一事件 30 秒內冷卻（防同類事件爆量）

import { sendMessage, isTelegramEnabled, getFieldGroupChatIds } from "./telegram-bot";

// ============================================================================
// 顧客向「場域群組」通知（2026-06-13）
// 與內部 ops chat 分流：群組(如賈村)只收顧客事件（預約 / 今日預約 / 賈村遊戲），
// 不收部署/錯誤/付款等 ops 訊息（那些留 TELEGRAM_NOTIFY_CHAT_IDS 個人 chat）。
// ============================================================================

/** 發送到所有場域群組 chat_id（沒設則 no-op） */
export function sendToFieldGroup(text: string, silent = false): void {
  const groups = getFieldGroupChatIds();
  if (groups.length === 0) return;
  for (const chatId of groups) {
    fireForget(sendMessage({ chatId, text, parseMode: "Markdown", silent }));
  }
}

const recentEvents = new Map<string, number>();
const COOLDOWN_MS = 30_000;

function shouldSend(eventKey: string): boolean {
  const last = recentEvents.get(eventKey);
  if (last && Date.now() - last < COOLDOWN_MS) return false;
  recentEvents.set(eventKey, Date.now());
  // 清過期
  recentEvents.forEach((t, k) => {
    if (Date.now() - t > COOLDOWN_MS * 4) recentEvents.delete(k);
  });
  return true;
}

function fireForget(promise: Promise<unknown>): void {
  promise.catch((err) =>
    console.error("[internal-notifier] send failed:", err),
  );
}

// ============================================================================
// 事件 1：部署完成
// ============================================================================

export function notifyDeploy(opts: {
  commit: string;
  status: "success" | "failed";
  duration?: number;
  errorDetail?: string;
}): void {
  if (!isTelegramEnabled()) return;
  const emoji = opts.status === "success" ? "🚀" : "❌";
  const lines = [
    `${emoji} *部署${opts.status === "success" ? "完成" : "失敗"}*`,
    `\`${opts.commit.slice(0, 8)}\``,
  ];
  if (opts.duration) lines.push(`耗時：${Math.round(opts.duration / 1000)} 秒`);
  if (opts.errorDetail) lines.push(`原因：\`${opts.errorDetail.slice(0, 200)}\``);
  fireForget(
    sendMessage({
      text: lines.join("\n"),
      parseMode: "Markdown",
      silent: opts.status === "success",
    }),
  );
}

// ============================================================================
// 事件 2：系統錯誤（5xx 飆升 / 容器 crash）
// ============================================================================

export function notifySystemError(opts: {
  source: string; // "express" / "container" / "db" 等
  message: string;
  stack?: string;
  silent?: boolean;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`sys-error-${opts.source}-${opts.message.slice(0, 50)}`)) return;
  const text = `🚨 *系統錯誤* (${opts.source})\n\n\`${opts.message.slice(0, 400)}\``;
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: opts.silent }));
}

// ============================================================================
// 事件 3：新客戶付款成功
// ============================================================================

export function notifyPaymentReceived(opts: {
  amount: number;
  currency: string;
  customer: string;
  plan?: string;
  paymentMethod?: string;
}): void {
  if (!isTelegramEnabled()) return;
  const text =
    `💰 *新付款* ${opts.currency} ${opts.amount.toLocaleString()}\n` +
    `客戶：${opts.customer}\n` +
    (opts.plan ? `方案：${opts.plan}\n` : "") +
    (opts.paymentMethod ? `方式：${opts.paymentMethod}` : "");
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

// ============================================================================
// 事件 4：玩家進入遊戲
// ============================================================================

export function notifyPlayerJoined(opts: {
  fieldId: string;
  gameTitle: string;
  playerName?: string;
  sessionId: string;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`player-join-${opts.sessionId}`)) return;
  const text =
    `🎮 玩家進入\n` +
    `場域：${opts.fieldId} · ${opts.gameTitle}\n` +
    `玩家：${opts.playerName || "(匿名)"}\n` +
    `session：\`${opts.sessionId.slice(0, 8)}\``;
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: true }));
}

// ============================================================================
// 事件 5：玩家完成遊戲
// ============================================================================

export function notifyPlayerCompleted(opts: {
  fieldId: string;
  gameTitle: string;
  playerName?: string;
  score?: number;
  durationMin?: number;
  sessionId: string;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`player-complete-${opts.sessionId}`)) return;
  const text =
    `🏁 玩家完成\n` +
    `場域：${opts.fieldId} · ${opts.gameTitle}\n` +
    `玩家：${opts.playerName || "(匿名)"}\n` +
    (opts.score !== undefined ? `分數：${opts.score}\n` : "") +
    (opts.durationMin !== undefined ? `用時：${opts.durationMin} 分` : "");
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

// ============================================================================
// 事件 6：新預約 / 取消
// ============================================================================

export function notifyBookingCreated(opts: {
  fieldId: string;
  bookingCode: string;
  displayName?: string;
  slotStart: Date;
  partySize: number;
  amountCents: number;
}): void {
  if (!isTelegramEnabled()) return;
  const slotStr = opts.slotStart.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lines = [
    `📅 新預約 · ${opts.fieldId}`,
    `\`${opts.bookingCode}\``,
    `${slotStr} · ${opts.partySize} 人`,
    opts.displayName ? `客戶：${opts.displayName}` : "",
  ].filter(Boolean);
  if (opts.amountCents > 0) {
    lines.push(`金額：NT$${(opts.amountCents / 100).toLocaleString()}`);
  }
  const text = lines.join("\n");
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
  // 🆕 2026-06-13 也通報到場域群組（賈村群組等）
  sendToFieldGroup(text);
}

// ============================================================================
// 事件 6.5：賈村遊戲開玩（2026-06-13）— 只通報場域群組
// 需求：時間 + 遊戲名稱 + 帳號；只針對指定場域（賈村）
// ============================================================================

export function notifyFieldGamePlay(opts: {
  gameTitle: string;
  playerName?: string;
  startedAt?: Date;
}): void {
  const groups = getFieldGroupChatIds();
  if (groups.length === 0) return;
  const timeStr = (opts.startedAt ?? new Date()).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text =
    `🎮 有人玩賈村遊戲\n` +
    `時間：${timeStr}\n` +
    `遊戲：${opts.gameTitle}\n` +
    `帳號：${opts.playerName || "(匿名)"}`;
  sendToFieldGroup(text, true);
}

// ============================================================================
// 事件 6.6：今日預約晨報（2026-06-13）— 每天早上通報場域群組
// ============================================================================

export function notifyTodayBookings(opts: {
  dateLabel: string;
  bookings: Array<{ timeStr: string; displayName: string; partySize: number; activityName?: string }>;
}): void {
  const groups = getFieldGroupChatIds();
  if (groups.length === 0) return;
  if (opts.bookings.length === 0) {
    sendToFieldGroup(`☀️ *今日預約 · ${opts.dateLabel}*\n\n今天目前沒有預約`, true);
    return;
  }
  const totalGroups = opts.bookings.length;
  const totalPeople = opts.bookings.reduce((s, b) => s + (b.partySize ?? 0), 0);
  const lines = [`☀️ *今日預約 · ${opts.dateLabel}*`, `共 ${totalGroups} 組 / ${totalPeople} 人`, ``];
  for (const b of opts.bookings) {
    lines.push(
      `• ${b.timeStr} · ${b.displayName} · ${b.partySize} 人` +
        (b.activityName ? ` · ${b.activityName}` : ""),
    );
  }
  // 📊 各項目統計（依活動名分組，未掛活動歸「其他/定點」）
  const byActivity = new Map<string, { groups: number; people: number }>();
  for (const b of opts.bookings) {
    const key = b.activityName || "其他/定點";
    const cur = byActivity.get(key) ?? { groups: 0, people: 0 };
    cur.groups += 1;
    cur.people += b.partySize ?? 0;
    byActivity.set(key, cur);
  }
  if (byActivity.size > 0) {
    lines.push(``, `📊 *項目統計*`);
    for (const [name, s] of byActivity) {
      lines.push(`· ${name}：${s.groups} 組 / ${s.people} 人`);
    }
  }
  sendToFieldGroup(lines.join("\n"));
}

export function notifyBookingCancelled(opts: {
  fieldId: string;
  bookingCode: string;
  displayName?: string;
  slotStart: Date;
  byAdmin: boolean;
  reason?: string;
}): void {
  if (!isTelegramEnabled()) return;
  const slotStr = opts.slotStart.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text =
    `🚫 預約取消${opts.byAdmin ? "（admin）" : ""}\n` +
    `\`${opts.bookingCode}\` · ${opts.fieldId}\n` +
    `${slotStr}\n` +
    (opts.displayName ? `客戶：${opts.displayName}\n` : "") +
    (opts.reason ? `原因：${opts.reason}` : "");
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: true }));
}

// ============================================================================
// 事件 7：smoke test 失敗
// ============================================================================

export function notifySmokeFail(opts: {
  passed: number;
  total: number;
  failures: string[];
}): void {
  if (!isTelegramEnabled()) return;
  const text =
    `❌ Smoke test 失敗 (${opts.passed}/${opts.total})\n\n` +
    opts.failures.slice(0, 10).map((f) => `· ${f}`).join("\n");
  fireForget(sendMessage({ text }));
}

// ============================================================================
// 事件 8：每日早報
// ============================================================================

export function notifyDailyReport(opts: {
  date: string;
  activeFields: number;
  totalPlayers: number;
  completedSessions: number;
  newBookings: number;
  revenueCents: number;
  topFields?: Array<{ name: string; players: number }>;
}): void {
  if (!isTelegramEnabled()) return;
  const lines = [
    `📊 *每日早報 · ${opts.date}*`,
    ``,
    `活躍場域：${opts.activeFields}`,
    `玩家數：${opts.totalPlayers}`,
    `完成 session：${opts.completedSessions}`,
    `新預約：${opts.newBookings}`,
    `營收：NT$${(opts.revenueCents / 100).toLocaleString()}`,
  ];
  if (opts.topFields && opts.topFields.length > 0) {
    lines.push("", "*TOP 場域*");
    opts.topFields.slice(0, 3).forEach((f, i) => {
      lines.push(`${i + 1}. ${f.name} — ${f.players} 人`);
    });
  }
  fireForget(sendMessage({ text: lines.join("\n"), parseMode: "Markdown" }));
}

// ============================================================================
// 事件 8.5：活動結束報告（Phase 3 / 2026-05-10）
// ============================================================================

export function notifySessionReport(opts: {
  sessionId: string;
  gameId?: string | null;
  totalPlayers: number;
  completedPlayers: number;
  completionRate: number | null;
  graceStartCount: number;
  autoLeaveCount: number;
  wsConnects: number;
  configChangeCloses: number;
  anomalyScore: number;
  anomaliesCount: number;
  topAnomalyMessage?: string;
  baselineCompletionRate?: number;
  reportUrl?: string;
}): void {
  if (!isTelegramEnabled()) return;

  const completionPct = opts.completionRate ?? 0;
  const gracePct = opts.wsConnects > 0 ? Math.round((opts.graceStartCount / opts.wsConnects) * 100) : 0;
  const autoLeavePct = opts.wsConnects > 0 ? Math.round((opts.autoLeaveCount / opts.wsConnects) * 100) : 0;
  const configPct = opts.wsConnects > 0 ? Math.round((opts.configChangeCloses / opts.wsConnects) * 100) : 0;

  const healthEmoji =
    opts.anomalyScore === 0 ? "🟢" : opts.anomalyScore < 30 ? "🟡" : opts.anomalyScore < 60 ? "🟠" : "🔴";

  const lines = [
    `${healthEmoji} *活動結束報告* (anomaly=${opts.anomalyScore})`,
    `\`session:${opts.sessionId.slice(0, 12)}\``,
    ``,
    `👥 完成 ${opts.completedPlayers}/${opts.totalPlayers} (${completionPct}%)`,
    `📡 grace ${gracePct}% · auto_leave ${autoLeavePct}% · config_change ${configPct}%`,
  ];

  if (opts.anomaliesCount > 0 && opts.topAnomalyMessage) {
    lines.push(``, `⚠️ ${opts.anomaliesCount} 項異常`);
    lines.push(`首要：${opts.topAnomalyMessage.slice(0, 100)}`);
  }

  if (opts.baselineCompletionRate !== undefined && opts.completionRate !== null) {
    const diff = opts.completionRate - opts.baselineCompletionRate;
    if (Math.abs(diff) >= 5) {
      lines.push(``, `📈 vs 基準（前 5 場平均 ${opts.baselineCompletionRate}%）：${diff > 0 ? "+" : ""}${diff}%`);
    }
  }

  if (opts.reportUrl) {
    lines.push(``, `詳情：${opts.reportUrl}`);
  }

  fireForget(
    sendMessage({
      text: lines.join("\n"),
      parseMode: "Markdown",
      silent: opts.anomalyScore < 30, // 健康無異常靜音、異常才響
    }),
  );
}

// ============================================================================
// 事件 9：LINE / Cloudinary 額度告警
// ============================================================================

export function notifyQuotaAlert(opts: {
  service: "line_push" | "cloudinary" | "ai_tokens";
  used: number;
  limit: number;
  percentage: number;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`quota-${opts.service}`)) return;
  const serviceName: Record<typeof opts.service, string> = {
    line_push: "LINE 推播",
    cloudinary: "Cloudinary",
    ai_tokens: "AI tokens",
  };
  const text =
    `⚠️ *${serviceName[opts.service]} 額度告警*\n` +
    `已用：${opts.used.toLocaleString()} / ${opts.limit.toLocaleString()} (${opts.percentage.toFixed(1)}%)`;
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

// ============================================================================
// 事件 10：LINE bot @chito 收建場
// ============================================================================

export function notifyLineBotCreated(opts: {
  scenarioName: string;
  adminName?: string;
  fieldId?: string;
}): void {
  if (!isTelegramEnabled()) return;
  const text =
    `✨ LINE @chito 建場\n` +
    `情境：${opts.scenarioName}\n` +
    (opts.fieldId ? `場域：${opts.fieldId}\n` : "") +
    (opts.adminName ? `admin：${opts.adminName}` : "");
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: true }));
}

// ============================================================================
// 事件 11-13：水彈對戰（Battle）
// ============================================================================

export function notifyBattleRegistered(opts: {
  slotId: string;
  venueName: string;
  slotDateTime: Date;
  playerName?: string;
  squadName?: string;
  isPremade?: boolean;
}): void {
  if (!isTelegramEnabled()) return;
  const slotStr = opts.slotDateTime.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text =
    `🎯 水彈報名\n` +
    `${opts.venueName} · ${slotStr}\n` +
    (opts.playerName ? `玩家：${opts.playerName}\n` : "") +
    (opts.squadName ? `戰隊：${opts.squadName}\n` : "") +
    (opts.isPremade ? `（預組隊伍）` : `（散客）`);
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: true }));
}

export function notifyBattleSlotConfirmed(opts: {
  slotId: string;
  venueName: string;
  slotDateTime: Date;
  registeredCount: number;
  minPlayers: number;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`battle-confirmed-${opts.slotId}`)) return;
  const slotStr = opts.slotDateTime.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text =
    `✅ *水彈場次成局*\n` +
    `${opts.venueName} · ${slotStr}\n` +
    `已報名 ${opts.registeredCount} 人（最低 ${opts.minPlayers}）`;
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

export function notifyBattleSlotFull(opts: {
  slotId: string;
  venueName: string;
  slotDateTime: Date;
  maxPlayers: number;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`battle-full-${opts.slotId}`)) return;
  const slotStr = opts.slotDateTime.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "narrow",
    hour: "2-digit",
    minute: "2-digit",
  });
  const text =
    `🔥 *水彈場次額滿*\n` +
    `${opts.venueName} · ${slotStr}\n` +
    `${opts.maxPlayers}/${opts.maxPlayers} 人滿`;
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

export function notifyBattleCompleted(opts: {
  slotId: string;
  venueName: string;
  winnerTeam?: string;
  participantCount?: number;
}): void {
  if (!isTelegramEnabled()) return;
  if (!shouldSend(`battle-completed-${opts.slotId}`)) return;
  const text =
    `🏆 *水彈對戰結束*\n` +
    `${opts.venueName}\n` +
    (opts.winnerTeam ? `勝隊：${opts.winnerTeam}\n` : "") +
    (opts.participantCount ? `${opts.participantCount} 人參戰` : "");
  fireForget(sendMessage({ text, parseMode: "Markdown" }));
}

// ============================================================================
// 啟動通知（server boot）
// ============================================================================

export function notifyServerBoot(): void {
  if (!isTelegramEnabled()) return;
  // 白話版：給業主看的「系統更新上線」確認，不放工程術語（commit）
  const time = new Date().toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const text =
    `🟢 系統已更新上線\n` +
    `賈村遊戲平台服務正常運作中\n` +
    `時間：${time}`;
  fireForget(sendMessage({ text, parseMode: "Markdown", silent: true }));
}
