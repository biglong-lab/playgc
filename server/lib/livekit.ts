// 📻 LiveKit Server SDK 封裝
//
// 用途：生成 access token 給前端連線 LiveKit（對講機）
// 玩家 token：room=team-{teamId}、canPublish+canSubscribe
// 管理者 broadcast token：指定 room、canPublish、**不給 subscribe**（避免監聽爭議）
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
  type VideoGrant,
} from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://livekit:7880";

// 公開給前端的 wss URL（前端連 nginx 反代過來）
export const LIVEKIT_PUBLIC_URL =
  process.env.LIVEKIT_PUBLIC_URL ||
  (process.env.NODE_ENV === "production"
    ? "wss://game.homi.cc/livekit"
    : "ws://localhost:7880");

export function isLiveKitConfigured(): boolean {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

/**
 * 玩家端 token：加入自己隊伍 room 雙向對講
 */
export async function createPlayerToken(options: {
  roomName: string;
  identity: string;       // userId
  displayName: string;    // 名字
  /** TTL 秒數，預設 2 小時（遊戲時長 + buffer） */
  ttl?: number;
}): Promise<string> {
  if (!isLiveKitConfigured()) {
    throw new Error("LiveKit 未設定 API Key");
  }

  const at = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity: options.identity,
    name: options.displayName,
    ttl: options.ttl || 7200, // 2h
  });

  const grant: VideoGrant = {
    room: options.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,         // 純語音，不開 data channel
    canPublishSources: ["microphone"] as never, // 只能開麥，不能開鏡頭/螢幕分享
  };
  at.addGrant(grant);

  return at.toJwt();
}

/**
 * 管理者廣播 token：只 publish 不 subscribe（避免監聽嫌疑）
 */
export async function createBroadcasterToken(options: {
  roomName: string;
  identity: string;        // 例：「admin-broadcast-{adminId}-{room}」
  displayName: string;     // 例：「場地管理員 Hung」
  ttl?: number;
}): Promise<string> {
  if (!isLiveKitConfigured()) {
    throw new Error("LiveKit 未設定 API Key");
  }

  const at = new AccessToken(LIVEKIT_API_KEY!, LIVEKIT_API_SECRET!, {
    identity: options.identity,
    name: options.displayName,
    ttl: options.ttl || 1800, // 30 min 廣播 session
  });

  const grant: VideoGrant = {
    room: options.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: false,                      // 🔒 關鍵：不允許訂閱（不聽玩家對話）
    canPublishData: false,
    canPublishSources: ["microphone"] as never,
  };
  at.addGrant(grant);

  return at.toJwt();
}

/**
 * Admin Client（列出 room / participant 等管理操作）
 */
let _roomService: RoomServiceClient | null = null;
export function getRoomService(): RoomServiceClient {
  if (_roomService) return _roomService;
  if (!isLiveKitConfigured()) {
    throw new Error("LiveKit 未設定");
  }
  // 內部 API 走 http://livekit:7880（Docker network）
  const apiUrl = LIVEKIT_URL.replace(/^ws/, "http").replace(/^wss/, "https");
  _roomService = new RoomServiceClient(
    apiUrl,
    LIVEKIT_API_KEY!,
    LIVEKIT_API_SECRET!,
  );
  return _roomService;
}

/**
 * 查詢某 room 目前有幾個 participant（for 儀表板）
 */
export async function getRoomParticipantCount(
  roomName: string,
): Promise<number> {
  try {
    const svc = getRoomService();
    const participants = await svc.listParticipants(roomName);
    return participants.length;
  } catch {
    return 0; // room 不存在 = 0 人
  }
}

/**
 * 列出所有正在進行的 room（for 儀表板）
 * 回傳 [{ name, numParticipants, creationTime }, ...]
 */
export async function listActiveRooms(): Promise<
  Array<{ name: string; numParticipants: number; creationTime: number }>
> {
  try {
    const svc = getRoomService();
    const rooms = await svc.listRooms();
    return rooms.map((r) => ({
      name: r.name,
      numParticipants: r.numParticipants,
      creationTime: Number(r.creationTime),
    }));
  } catch (err) {
    console.error("[livekit] listActiveRooms failed:", err);
    return [];
  }
}

/**
 * 產生 room name
 */
export function getTeamRoomName(teamId: string): string {
  return `team-${teamId}`;
}

export function getSessionRoomName(sessionId: string): string {
  return `session-${sessionId}`;
}
