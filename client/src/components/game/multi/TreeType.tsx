import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TreeEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  tree: string;
  reason: string;
}

interface TreeTypeState extends Record<string, unknown> {
  entries: TreeEntry[];
  revealed: boolean;
}

interface TreeTypeConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): TreeTypeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const TREES = [
  { id: "oak", label: "橡樹", emoji: "🌳", desc: "穩固強韌長久可靠" },
  { id: "bamboo", label: "竹子", emoji: "🎋", desc: "韌性十足彎而不折" },
  { id: "cherry", label: "櫻花樹", emoji: "🌸", desc: "短暫燦爛活在當下" },
  { id: "pine", label: "松樹", emoji: "🌲", desc: "四季常青意志堅定" },
  { id: "willow", label: "柳樹", emoji: "🌿", desc: "柔軟靈活隨遇而安" },
  { id: "banyan", label: "榕樹", emoji: "🌱", desc: "包容廣納庇護眾人" },
  { id: "maple", label: "楓樹", emoji: "🍁", desc: "優雅轉變情感豐富" },
  { id: "birch", label: "白樺樹", emoji: "🤍", desc: "清新純淨簡約之美" },
  { id: "cactus", label: "仙人掌", emoji: "🌵", desc: "獨立堅強耐得住考驗" },
];

const CARD_COLORS = [
  "border-l-green-600 bg-green-50",
  "border-l-emerald-600 bg-emerald-50",
  "border-l-lime-600 bg-lime-50",
  "border-l-teal-600 bg-teal-50",
  "border-l-cyan-600 bg-cyan-50",
  "border-l-sage-600 bg-green-100",
  "border-l-olive-600 bg-yellow-50",
  "border-l-forest-600 bg-emerald-100",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TreeType({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TreeTypeState>({
    gameId,
    sessionId,
    pageId,
    type: "tree_type",
    defaultState: { entries: [], revealed: false },
  });

  const [tree, setTree] = useState("");
  const [reason, setReason] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="tre-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = (state.entries as TreeEntry[]).find((e) => e.userId === userId);
  const canSubmit = tree !== "" && reason.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entry: TreeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      tree,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...(state.entries as TreeEntry[]), entry] });
    setTree("");
    setReason("");
  };

  const entries = state.entries as TreeEntry[];
  const revealed = state.revealed as boolean;

  const treeCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.tree] = (acc[e.tree] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="tre-title" className="text-xl font-bold text-center">
        {cfg.title ?? "我是哪種樹"}
      </div>
      <div data-testid="tre-prompt" className="text-sm text-muted-foreground text-center">
        {cfg.prompt ?? "如果你是一棵樹，你最像哪種？說說你的樹木個性！"}
      </div>
      <div data-testid="tre-count" className="text-xs text-center text-muted-foreground">
        已選擇 {entries.length} 人
      </div>

      {!myEntry && (
        <div data-testid="tre-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <div className="grid grid-cols-3 gap-2">
            {TREES.map((t) => (
              <button
                key={t.id}
                data-testid={`tre-tree-${t.id}`}
                onClick={() => setTree(t.id)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border text-xs transition-all ${tree === t.id ? "border-green-600 bg-green-50 font-semibold" : "hover:border-green-500"}`}
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="font-medium text-center">{t.label}</div>
                <div className="text-muted-foreground text-[10px] text-center">{t.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="tre-reason-input"
            className="border rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder="為什麼這種樹最像你？（至少5字）"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            data-testid="tre-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40"
          >
            生根！
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="tre-my-entry" className="bg-green-50 rounded-xl p-3 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{TREES.find((t) => t.id === myEntry.tree)?.emoji}</span>
            <span className="text-sm font-semibold">{TREES.find((t) => t.id === myEntry.tree)?.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">{myEntry.reason}</div>
          <div className="text-xs text-muted-foreground mt-1">已落地</div>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="tre-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-green-700 text-white rounded-lg py-2 text-sm font-medium"
        >
          揭曉全隊森林
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="tre-empty" className="text-center text-muted-foreground p-8">
          目前還沒有人選擇樹木類型
        </div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="tre-result" className="flex flex-col gap-3">
          <div data-testid="tre-tree-summary" className="flex flex-wrap gap-2">
            {TREES.filter((t) => treeCounts[t.id] > 0).map((t) => (
              <div
                key={t.id}
                data-testid={`tre-badge-${t.id}`}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold"
              >
                {t.emoji} {t.label}
                <span className="ml-1 bg-green-700 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                  {treeCounts[t.id]}
                </span>
              </div>
            ))}
          </div>
          <div data-testid="tre-card-list" className="flex flex-col gap-2">
            {entries.map((e, i) => {
              const t = TREES.find((x) => x.id === e.tree);
              return (
                <div
                  key={e.entryId}
                  data-testid={`tre-card-${e.entryId}`}
                  className={`rounded-xl p-3 border-l-4 ${CARD_COLORS[i % CARD_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{t?.emoji}</span>
                    <span className="text-sm font-semibold">{t?.label}</span>
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
