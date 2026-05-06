import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LandscapeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  landscape: string;
  reason: string;
}

interface LandscapeTypeState extends Record<string, unknown> {
  entries: LandscapeEntry[];
  revealed: boolean;
}

interface LandscapeTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): LandscapeTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const LANDSCAPES = [
  { id: "mountain", label: "山", emoji: "⛰️", desc: "穩重堅定眼界高遠" },
  { id: "ocean", label: "大海", emoji: "🌊", desc: "寬廣深邃包容一切" },
  { id: "forest", label: "森林", emoji: "🌲", desc: "豐盛多元生生不息" },
  { id: "desert", label: "沙漠", emoji: "🏜️", desc: "耐得住孤獨強韌生存" },
  { id: "prairie", label: "草原", emoji: "🌾", desc: "自由開放隨風而動" },
  { id: "island", label: "島嶼", emoji: "🏝️", desc: "獨立自足悠然自在" },
  { id: "canyon", label: "峽谷", emoji: "🏔️", desc: "深邃神秘歲月刻痕" },
  { id: "glacier", label: "冰川", emoji: "🧊", desc: "純淨冷靜不為所動" },
  { id: "wetland", label: "濕地", emoji: "🦢", desc: "包容多元生態豐富" },
];

const CARD_COLORS = [
  "border-l-green-600 bg-green-50",
  "border-l-blue-500 bg-blue-50",
  "border-l-teal-500 bg-teal-50",
  "border-l-amber-600 bg-amber-50",
  "border-l-lime-500 bg-lime-50",
  "border-l-cyan-500 bg-cyan-50",
  "border-l-stone-500 bg-stone-50",
  "border-l-sky-400 bg-sky-50",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function LandscapeType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LandscapeTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "landscape_type",
    defaultState: { entries: [], revealed: false },
  });

  const [landscape, setLandscape] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="lsc-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as LandscapeEntry[]).find((e) => e.userId === userId);
  const canSubmit = landscape !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: LandscapeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      landscape,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as LandscapeEntry[]), entry] });
    setLandscape("");
    setReason("");
  };

  const entries = state.entries as LandscapeEntry[];
  const revealed = state.revealed as boolean;

  const landscapeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.landscape] = (acc[e.landscape] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="lsc-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種地景"}
      </div>
      <div data-testid="lsc-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一種自然地景，你最像哪種？說說你的地景個性！"}
      </div>
      <div data-testid="lsc-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="lsc-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {LANDSCAPES.map((l) => (
              <button
                key={l.id}
                data-testid={`lsc-landscape-${l.id}`}
                onClick={() => setLandscape(l.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${landscape === l.id ? "border-green-600 bg-green-50 font-semibold" : "hover:border-green-500"}`}
              >
                <span className="text-2xl">{l.emoji}</span>
                <div className="font-medium text-center">{l.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{l.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="lsc-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種地景最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="lsc-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            探索！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="lsc-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{LANDSCAPES.find((l) => l.id === myEntry.landscape)?.emoji}</span>
            <span className="text-sm font-semibold">{LANDSCAPES.find((l) => l.id === myEntry.landscape)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已標記</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="lsc-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊地圖
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="lsc-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇地景類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="lsc-result" className="flex flex-col gap-3">
          <div data-testid="lsc-landscape-summary" className="flex flex-wrap gap-2">
            {LANDSCAPES.filter((l) => landscapeCounts[l.id] > 0).map((l) => (
              <div
                key={l.id}
                data-testid={`lsc-badge-${l.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold"
              >
                {l.emoji} {l.label}
                <span className="ml-1 bg-green-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {landscapeCounts[l.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="lsc-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const l = LANDSCAPES.find((x) => x.id === e.landscape);
              return (
                <div
                  key={e.entryId}
                  data-testid={`lsc-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{l?.emoji}</span>
                    <span className="text-sm font-semibold">{l?.label}</span>
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
