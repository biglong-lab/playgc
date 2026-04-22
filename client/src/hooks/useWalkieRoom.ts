// 📻 對講機 Room hook
//
// 負責：
//   1. 打 /api/walkie/token 拿 LiveKit JWT
//   2. 連線 LiveKit Room
//   3. 管理 PTT 狀態（按下開麥、放開靜音）
//   4. 追蹤房間成員 + 誰在說話
//   5. 離開頁面時自動斷線
import { useEffect, useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type Participant,
  type LocalParticipant,
  ConnectionState,
} from "livekit-client";
import { apiRequest } from "@/lib/queryClient";

export interface WalkieParticipant {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isLocal: boolean;
  audioLevel: number;
}

export interface UseWalkieRoomOptions {
  /** session ID（玩家模式）*/
  sessionId?: string | null;
  /** 直接傳入 token 模式（管理員廣播）*/
  manualToken?: { token: string; wsUrl: string; roomName: string } | null;
  /** 是否啟用（關閉時不連線）*/
  enabled?: boolean;
  /** 自動加入後預設靜音（PTT 模式必開）*/
  startMuted?: boolean;
}

export interface UseWalkieRoomResult {
  /** 當前 Room 狀態 */
  connectionState: ConnectionState;
  /** 是否已連線可用 */
  isConnected: boolean;
  /** 錯誤訊息 */
  error: string | null;
  /** 房間名稱（連上後才有值） */
  roomName: string | null;
  /** 所有參與者（含自己） */
  participants: WalkieParticipant[];
  /** 是否正在傳送語音（自己開麥中） */
  isTransmitting: boolean;
  /** 按下 PTT（開麥）*/
  startTalking: () => Promise<void>;
  /** 放開 PTT（靜音）*/
  stopTalking: () => Promise<void>;
  /** 手動斷線 */
  disconnect: () => Promise<void>;
}

export function useWalkieRoom(options: UseWalkieRoomOptions): UseWalkieRoomResult {
  const { sessionId, manualToken, enabled = true, startMuted = true } = options;

  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [error, setError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<WalkieParticipant[]>([]);
  const [isTransmitting, setIsTransmitting] = useState(false);

  /** 把 LiveKit Participant 轉成 UI 友善格式 */
  const toWalkieParticipant = useCallback(
    (p: Participant, isLocal: boolean): WalkieParticipant => ({
      identity: p.identity,
      name: p.name || p.identity,
      isSpeaking: p.isSpeaking,
      isLocal,
      audioLevel: p.audioLevel || 0,
    }),
    [],
  );

  /** 重新從 Room 取得所有 participants 更新 state */
  const syncParticipants = useCallback((room: Room) => {
    const list: WalkieParticipant[] = [];
    if (room.localParticipant) {
      list.push(toWalkieParticipant(room.localParticipant, true));
    }
    room.remoteParticipants.forEach((p) => {
      list.push(toWalkieParticipant(p, false));
    });
    setParticipants(list);
  }, [toWalkieParticipant]);

  /** 取 token + 連線 */
  const connect = useCallback(async () => {
    if (!enabled) return;
    if (roomRef.current && roomRef.current.state !== ConnectionState.Disconnected) {
      return; // 已經連線或連線中
    }

    setError(null);
    setConnectionState(ConnectionState.Connecting);

    try {
      // 取 token
      let tokenData: { token: string; wsUrl: string; roomName: string };

      if (manualToken) {
        tokenData = manualToken;
      } else if (sessionId) {
        const res = await apiRequest("POST", "/api/walkie/token", { sessionId });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "取得對講機 token 失敗");
        }
        tokenData = await res.json();
      } else {
        throw new Error("缺少 sessionId 或 token");
      }

      // 建立 Room 並監聽事件
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        // 噪音抑制（內建 RNNoise）
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      room.on(RoomEvent.ConnectionStateChanged, (state) => {
        setConnectionState(state);
      });

      room.on(RoomEvent.ParticipantConnected, () => syncParticipants(room));
      room.on(RoomEvent.ParticipantDisconnected, () => syncParticipants(room));
      room.on(RoomEvent.ActiveSpeakersChanged, () => syncParticipants(room));
      room.on(RoomEvent.TrackMuted, () => syncParticipants(room));
      room.on(RoomEvent.TrackUnmuted, () => syncParticipants(room));

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState(ConnectionState.Disconnected);
        setIsTransmitting(false);
        setParticipants([]);
      });

      // 連線
      await room.connect(tokenData.wsUrl, tokenData.token);

      // PTT 預設靜音
      if (startMuted) {
        await room.localParticipant.setMicrophoneEnabled(false);
      }

      roomRef.current = room;
      setRoomName(tokenData.roomName);
      syncParticipants(room);
    } catch (err) {
      console.error("[walkie] connect failed:", err);
      setError(err instanceof Error ? err.message : "連線失敗");
      setConnectionState(ConnectionState.Disconnected);
    }
  }, [enabled, sessionId, manualToken, startMuted, syncParticipants]);

  /** 斷線 */
  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
      roomRef.current = null;
    }
    setIsTransmitting(false);
    setRoomName(null);
    setParticipants([]);
  }, []);

  /** 按下 PTT → 開麥 */
  const startTalking = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== ConnectionState.Connected) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      setIsTransmitting(true);
    } catch (err) {
      console.error("[walkie] start talking failed:", err);
      setError("無法開啟麥克風（請確認權限）");
    }
  }, []);

  /** 放開 PTT → 關麥 */
  const stopTalking = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
      setIsTransmitting(false);
    } catch (err) {
      console.error("[walkie] stop talking failed:", err);
    }
  }, []);

  /** enabled 切換或 sessionId 改變時重新連線 */
  useEffect(() => {
    if (enabled && (sessionId || manualToken)) {
      connect();
    } else {
      disconnect();
    }

    // 元件 unmount 時斷線
    return () => {
      disconnect();
    };
    // 故意忽略 connect/disconnect 的 deps（它們 useCallback 已穩定）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sessionId, manualToken]);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.Connected,
    error,
    roomName,
    participants,
    isTransmitting,
    startTalking,
    stopTalking,
    disconnect,
  };
}
