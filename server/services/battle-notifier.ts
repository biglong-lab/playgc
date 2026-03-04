// 水彈對戰 PK 擂台 — 統一通知發送服務
// 負責建構通知內容、呼叫 storage 寫入、未來擴充 push/email

import { battleStorageMethods } from "../storage/battle-storage";
import type {
  NotificationType,
  NotificationContent,
  InsertBattleNotification,
  BattleSlot,
} from "@shared/schema";

/** 通知建構參數 */
interface NotifyParams {
  userIds: string[];
  type: NotificationType;
  content: NotificationContent;
  slotId?: string;
  /** 排程時間（預設為立即） */
  scheduledAt?: Date;
  channel?: "in_app" | "push" | "email";
}

/**
 * 發送通知給多位使用者
 * 目前只支援 in_app，預留 push/email 擴充點
 */
export async function sendNotification(params: NotifyParams): Promise<void> {
  const {
    userIds,
    type,
    content,
    slotId,
    scheduledAt = new Date(),
    channel = "in_app",
  } = params;

  if (userIds.length === 0) return;

  const notifications: InsertBattleNotification[] = userIds.map((userId) => ({
    userId,
    type,
    channel,
    status: "sent" as const,
    content,
    slotId: slotId ?? null,
    scheduledAt,
    sentAt: new Date(),
  }));

  await battleStorageMethods.createNotificationsBatch(notifications);

  // TODO: push notification（Firebase Cloud Messaging）
  // TODO: email notification（Resend）
}

// ============================================================================
// 便利函式 — 各種通知類型的內容建構
// ============================================================================

/** 格式化日期時間為中文 */
function formatDateTime(dateStr: string, startTime: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day} ${startTime}`;
}

/** 場次成局通知 */
export function buildSlotConfirmedContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "場次成局！",
    body: `${venueName} ${dt} 的場次已成局，請確認出席。`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt },
  };
}

/** 24 小時提醒 */
export function buildReminder24hContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "明日對戰提醒",
    body: `${venueName} ${dt} 的水彈對戰明天開打，別忘了出席！`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt },
  };
}

/** 2 小時提醒 */
export function buildReminder2hContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "即將開始！",
    body: `${venueName} ${dt} 的對戰即將在 2 小時後開始，請準備出發。`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt },
  };
}

/** 確認出席請求 */
export function buildConfirmRequestContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "請確認出席",
    body: `${venueName} ${dt} 的場次需要您確認出席，請儘速回覆。`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt },
  };
}

/** 分隊結果通知 */
export function buildTeamAssignedContent(
  slot: BattleSlot,
  venueName: string,
  teamName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "分隊結果公布",
    body: `${venueName} ${dt}：您被分配到 ${teamName}！`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt, teamName },
  };
}

/** 報到開放通知 */
export function buildCheckInOpenContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "報到開放",
    body: `${venueName} ${dt} 的對戰已開放報到，請於現場完成報到。`,
    actionUrl: `/battle/slot/${slot.id}`,
    meta: { venueName, dateTime: dt },
  };
}

/** 場次取消通知 */
export function buildSlotCancelledContent(
  slot: BattleSlot,
  venueName: string,
  reason?: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  const reasonText = reason ? `原因：${reason}` : "";
  return {
    title: "場次取消",
    body: `${venueName} ${dt} 的場次已取消。${reasonText}`,
    actionUrl: `/battle`,
    meta: { venueName, dateTime: dt },
  };
}

/** 對戰結果公布通知 */
export function buildResultPublishedContent(
  slot: BattleSlot,
  venueName: string,
): NotificationContent {
  const dt = formatDateTime(slot.slotDate, slot.startTime);
  return {
    title: "對戰結果公布",
    body: `${venueName} ${dt} 的對戰結果已公布，快來查看！`,
    actionUrl: `/battle/slot/${slot.id}/result`,
    meta: { venueName, dateTime: dt },
  };
}

/** 戰隊邀請通知 */
export function buildClanInviteContent(
  clanName: string,
  clanTag: string,
  clanId: string,
): NotificationContent {
  return {
    title: "戰隊邀請",
    body: `您收到來自 [${clanTag}] ${clanName} 的入隊邀請！`,
    actionUrl: `/battle/clan/${clanId}`,
    meta: { clanName, clanTag },
  };
}
