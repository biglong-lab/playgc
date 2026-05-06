import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ColorEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  color: string;
  reason: string;
}

interface ColorPersonalityState extends Record<string, unknown> {
  entries: ColorEntry[];
  revealed: boolean;
}

interface ColorPersonalityConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ColorPersonalityConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const COLORS = [
  { id: "red", label: "紅色", emoji: "🔴", desc: "熱情行動領導力強", bg: "bg-red-100", border: "border-red-400", text: "text-red-700" },
  { id: "orange", label: "橙色", emoji: "🟠", desc: "活潑創意充滿活力", bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-700" },
  { id: "yellow", label: "黃色", emoji: "🟡", desc: "陽光開朗樂觀積極", bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-700" },
  { id: "green", label: "綠色", emoji: "🟢", desc: "平和成長重視和諧", bg: "bg-green-100", border: "border-green-400", text: "text-green-700" },
  { id: "blue", label: "藍色", emoji: "🔵", desc: "沉穩理性值得信賴", bg: "bg-blue-100", border: "border-blue-400", text: "text-blue-700" },
  { id: "purple", label: "紫色", emoji: "🟣", desc: "神秘直覺創意豐富", bg: "bg-purple-100", border: "border-purple-400", text: "text-purple-700" },
  { id: "pink", label: "粉紅", emoji: "🩷", desc: "溫柔關懷重視情感", bg: "bg-pink-100", border: "border-pink-400", text: "text-pink-700" },
  { id: "white", label: "白色", emoji: "⚪", desc: "純粹清晰追求完美", bg: "bg-gray-100", border: "border-gray-300", text: "text-gray-700" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ColorPersonality({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ColorPersonalityState>({
    gameId,
    sessionId,
    pageId,
    type: "color_personality",
    defaultState: { entries: [], revealed: false },
  });

  const [color, setColor] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cp-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as ColorEntry[]).find((e) => e.userId === userId);
  const canSubmit = color !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: ColorEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      color,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as ColorEntry[]), entry] });
    setColor("");
    setReason("");
  };

  const entries = state.entries as ColorEntry[];
  const revealed = state.revealed as boolean;

  const colorCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.color] = (acc[e.color] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cp-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種顏色"}
      </div>
      <div data-testid="cp-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種顏色，你最像哪一個？說說為什麼！"}
      </div>
      <div data-testid="cp-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cp-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-2 gap-2">
            {COLORS.map((c) => (
              <button
                key={c.id}
                data-testid={`cp-color-${c.id}`}
                onClick={() => setColor(c.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs transition-all ${color === c.id ? `${c.border} ${c.bg} font-semibold` : "hover:border-gray-300"}`}
              >
                <span className="text-xl shrink-0">{c.emoji}</span>
                <div className="text-left">
                  <div className="font-medium">{c.label}</div>
                  <div className="text-muted-foreground text-[10px]">{c.desc}</div>
                </div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="cp-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼你是這個顏色？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="cp-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            染色！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="cp-my-entry" className="bg-violet-50 rounded-xl p-3 border border-violet-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{COLORS.find((c) => c.id === myEntry.color)?.emoji}</span>
            <span className="text-sm font-semibold">{COLORS.find((c) => c.id === myEntry.color)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已選定</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cp-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊調色盤
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cp-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇顏色
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cp-result" className="flex flex-col gap-3">
          <div data-testid="cp-color-summary" className="flex flex-wrap gap-2">
            {COLORS.filter((c) => colorCounts[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`cp-badge-${c.id}`}
                className={`flex items-center gap-1 px-3 py-1 rounded-full ${c.bg} ${c.text} text-xs font-semibold`}
              >
                {c.emoji} {c.label}
                <span className={`ml-1 ${c.border.replace("border-", "bg-")} text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]`}>
                  {colorCounts[c.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="cp-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const c = COLORS.find((x) => x.id === e.color);
              const cardColors = ["border-l-red-400 bg-red-50","border-l-orange-400 bg-orange-50","border-l-yellow-400 bg-yellow-50","border-l-green-400 bg-green-50","border-l-blue-400 bg-blue-50","border-l-purple-400 bg-purple-50","border-l-pink-400 bg-pink-50","border-l-gray-300 bg-gray-50"];
              return (
                <div
                  key={e.entryId}
                  data-testid={`cp-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${cardColors[COLORS.findIndex((x) => x.id === e.color) % cardColors.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{c?.emoji}</span>
                    <span className="text-sm font-semibold">{c?.label}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{e.userName}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{e.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
