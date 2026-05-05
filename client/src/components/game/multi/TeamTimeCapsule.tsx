import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface CapsuleMessage extends Record<string, unknown> {
  msgId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface TeamTimeCapsuleConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  openingDate: string;
}

export interface TeamTimeCapsuleState extends Record<string, unknown> {
  messages: CapsuleMessage[];
  opened: boolean;
}

function extractConfig(raw: Record<string, unknown>): TeamTimeCapsuleConfig {
  return {
    title: (raw.title as string) || "團隊時光膠囊",
    prompt: (raw.prompt as string) || "寫下你想留給未來的話語...",
    openingDate: (raw.openingDate as string) || "未來某天",
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamTimeCapsule({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: TeamTimeCapsuleState = { messages: [], opened: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamTimeCapsuleState>({
    gameId,
    sessionId,
    pageId,
    type: "team_time_capsule",
    defaultState,
  });

  const [text, setText] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="ttc-loading" />
      </div>
    );
  }

  const myMessage = state.messages.find((m) => m.userId === userId);

  function handleSubmit() {
    if (!text.trim() || myMessage) return;
    const msgId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      messages: [...state.messages, { msgId, userId, userName, text: text.trim() }],
    });
    setText("");
  }

  function handleOpen() {
    updateState({ ...state, opened: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-bold" data-testid="ttc-title">{cfg.title}</h2>
        <p className="text-gray-500 text-sm mt-1" data-testid="ttc-opening-date">
          📅 開啟日期：{cfg.openingDate}
        </p>
      </div>

      <p className="text-gray-600 italic text-center" data-testid="ttc-prompt">{cfg.prompt}</p>

      <p className="text-sm text-gray-400 text-center" data-testid="ttc-count">
        已投入 {state.messages.length} 封信
      </p>

      {!state.opened && (
        <div className="flex justify-center">
          <div className="relative w-48 h-36 bg-amber-100 border-4 border-amber-300 rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-5xl">📦</span>
            <div className="absolute bottom-2 right-2 text-xs text-amber-600 font-semibold">
              {state.messages.length} 封
            </div>
          </div>
        </div>
      )}

      {!myMessage && !state.opened && (
        <div className="space-y-2">
          <textarea
            className="w-full border rounded px-3 py-2 h-24"
            placeholder="寫下你的留言給未來..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="ttc-input"
            maxLength={300}
          />
          <button
            className="w-full py-2 bg-amber-500 text-white rounded font-semibold disabled:opacity-50"
            disabled={!text.trim()}
            onClick={handleSubmit}
            data-testid="ttc-submit-btn"
          >
            📩 投入膠囊
          </button>
        </div>
      )}

      {myMessage && !state.opened && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded text-center" data-testid="ttc-my-message">
          <p className="text-amber-700 text-sm">✅ 你的信已投入膠囊，等待開啟...</p>
        </div>
      )}

      {isTeamLead && !state.opened && (
        <button
          className="w-full py-2 bg-red-500 text-white rounded font-bold"
          onClick={handleOpen}
          data-testid="ttc-open-btn"
        >
          🔓 開啟時光膠囊！
        </button>
      )}

      {state.opened && (
        <div data-testid="ttc-result">
          <h3 className="font-semibold text-center text-lg mb-4">💌 膠囊已開啟！</h3>
          {state.messages.length === 0 ? (
            <p className="text-gray-400 text-center py-4" data-testid="ttc-empty">膠囊裡是空的...</p>
          ) : (
            <div className="space-y-3">
              {state.messages.map((m) => (
                <div
                  key={m.msgId}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-sm"
                  data-testid={`ttc-msg-${m.msgId}`}
                >
                  <p className="text-gray-800">{m.text}</p>
                  <p className="text-xs text-amber-600 mt-2 text-right">— {m.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamTimeCapsule;
