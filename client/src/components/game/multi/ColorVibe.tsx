import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface VibeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  colorId: string;
}

interface ColorVibeState extends Record<string, unknown> {
  entries: VibeEntry[];
  revealed: boolean;
}

interface ColorVibeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ColorVibeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const COLORS = [
  { id: "red", label: "熱情積極", hex: "#ef4444" },
  { id: "orange", label: "充滿活力", hex: "#f97316" },
  { id: "yellow", label: "開心輕鬆", hex: "#eab308" },
  { id: "green", label: "平靜穩定", hex: "#22c55e" },
  { id: "blue", label: "專注理性", hex: "#3b82f6" },
  { id: "purple", label: "創意靈感", hex: "#a855f7" },
  { id: "pink", label: "溫暖關懷", hex: "#ec4899" },
  { id: "gray", label: "沉著冷靜", hex: "#6b7280" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ColorVibe({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ColorVibeState>({
    gameId,
    sessionId,
    pageId,
    type: "color_vibe",
    defaultState: { entries: [], revealed: false },
  });

  const [colorId, setColorId] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="cv-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as VibeEntry[]).find((e) => e.userId === userId);
  const canSubmit = colorId !== "";

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: VibeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      colorId,
    };
    updateState({ ...state, entries: [...(state.entries as VibeEntry[]), entry] });
    setColorId("");
  };

  const entries = state.entries as VibeEntry[];
  const revealed = state.revealed as boolean;

  const countByColor = COLORS.reduce<Record<string, number>>((acc, c) => {
    acc[c.id] = entries.filter((e) => e.colorId === c.id).length;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="cv-title" className="text-xl font-bold text-center">
        {cfg.title ?? "顏色心情"}
      </div>
      <div data-testid="cv-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "選一個顏色代表你現在的心情狀態！"}
      </div>
      <div data-testid="cv-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="cv-form" className="grid grid-cols-4 gap-3">
          {COLORS.map((c) => (
            <button
              key={c.id}
              data-testid={`cv-color-${c.id}`}
              onClick={() => setColorId(c.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${colorId === c.id ? "border-gray-900 scale-105" : "border-transparent hover:border-gray-300"}`}
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{ backgroundColor: c.hex }}
              />
              <span className="text-xs text-center leading-tight">{c.label}</span>
            </button>
          ))}
          <div className="col-span-4">
            <button
              data-testid="cv-submit-btn"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full bg-primary text-primary-foreground rounded-lg py-2 text-sm font-medium disabled:opacity-40"
            >
              確認選擇
            </button>
          </div>
        </div>
      )}

      {myEntry && (
        <div data-testid="cv-my-entry" className="flex items-center gap-3 bg-muted rounded-xl p-3 border">
          <div
            className="w-8 h-8 rounded-full flex-shrink-0"
            style={{ backgroundColor: COLORS.find((c) => c.id === myEntry.colorId)?.hex }}
          />
          <div>
            <div className="text-sm font-semibold">{COLORS.find((c) => c.id === myEntry.colorId)?.label}</div>
            <div className="text-xs text-muted-foreground">已提交</div>
          </div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="cv-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-amber-500 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊顏色
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="cv-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇顏色
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="cv-result" className="flex flex-col gap-4">
          <div data-testid="cv-palette" className="flex flex-wrap gap-2 justify-center">
            {COLORS.filter((c) => countByColor[c.id] > 0).map((c) => (
              <div
                key={c.id}
                data-testid={`cv-bubble-${c.id}`}
                className="flex flex-col items-center gap-1"
              >
                <div
                  className="rounded-full flex items-center justify-center text-white font-bold"
                  style={{
                    backgroundColor: c.hex,
                    width: `${Math.max(40, countByColor[c.id] * 20)}px`,
                    height: `${Math.max(40, countByColor[c.id] * 20)}px`,
                    fontSize: `${Math.max(12, countByColor[c.id] * 6)}px`,
                  }}
                >
                  {countByColor[c.id]}
                </div>
                <span className="text-xs">{c.label}</span>
              </div>
            ))}
          </div>
          <div data-testid="cv-member-list" className="flex flex-col gap-2">
            {entries.map((e) => {
              const color = COLORS.find((c) => c.id === e.colorId);
              return (
                <div
                  key={e.entryId}
                  data-testid={`cv-card-${e.entryId}`}
                  className="bg-card rounded-lg p-3 border flex items-center gap-3"
                >
                  <div
                    className="w-6 h-6 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color?.hex }}
                  />
                  <div>
                    <div className="text-sm font-semibold">{e.userName}</div>
                    <div className="text-xs text-muted-foreground">{color?.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
