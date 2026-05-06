import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface SoupEntry {
  entryId: string;
  userId: string;
  userName: string;
  ingredient: string;
  description: string;
}

interface SoupIngredientState extends Record<string, unknown> {
  entries: SoupEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SoupIngredientState = { entries: [], revealed: false };

const INGREDIENTS = [
  { id: "salt", label: "鹽", icon: "🧂", desc: "穩定的基礎" },
  { id: "sugar", label: "糖", icon: "🍬", desc: "帶來歡笑" },
  { id: "chili", label: "辣椒", icon: "🌶️", desc: "點燃創意" },
  { id: "ginger", label: "薑", icon: "🫚", desc: "注入活力" },
  { id: "garlic", label: "蒜", icon: "🧄", desc: "凝聚力量" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SoupIngredient({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<SoupIngredientState>({
    gameId,
    sessionId,
    pageId,
    type: "soup_ingredient",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [selectedIngredient, setSelectedIngredient] = useState("salt");
  const [description, setDescription] = useState("");

  if (!isLoaded) return <div data-testid="sip-loading" className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  const title = config?.title ?? "湯底配方";
  const prompt = config?.prompt ?? "你為團隊這鍋湯帶來什麼味道？選一種食材說說你的貢獻";
  const entries = (state.entries ?? []) as SoupEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = entries.find((e) => e.userId === user?.id);
  const canSubmit = description.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const newEntry: SoupEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      ingredient: selectedIngredient,
      description: description.trim(),
    };
    updateState({ ...state, entries: [...entries, newEntry] });
    setDescription("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="sip-title" className="text-xl font-bold text-center text-orange-700">{title}</h2>
      <p data-testid="sip-prompt" className="text-center text-gray-600 text-sm">{prompt}</p>
      <p data-testid="sip-count" className="text-center text-xs text-gray-400">已加料：{entries.length} 人</p>

      {!myEntry && !revealed && (
        <div data-testid="sip-form" className="space-y-3">
          <div data-testid="sip-ingredient-grid" className="grid grid-cols-5 gap-2">
            {INGREDIENTS.map((i) => (
              <button
                key={i.id}
                data-testid={`sip-ingredient-${i.id}`}
                onClick={() => setSelectedIngredient(i.id)}
                className={`flex flex-col items-center p-2 rounded-lg border transition-colors ${selectedIngredient === i.id ? "bg-orange-100 border-orange-400" : "bg-white border-gray-200"}`}
              >
                <span className="text-2xl">{i.icon}</span>
                <p className="text-xs font-medium mt-0.5">{i.label}</p>
                <p className="text-xs text-gray-400 text-center leading-tight">{i.desc}</p>
              </button>
            ))}
          </div>
          <textarea
            data-testid="sip-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="說說你為團隊帶來什麼具體貢獻（至少 5 字）"
            rows={3}
            className="w-full border rounded-lg p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            data-testid="sip-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-orange-500 text-white font-medium disabled:opacity-40"
          >
            加入湯底
          </button>
        </div>
      )}

      {myEntry && !revealed && (
        <div data-testid="sip-my-entry" className="bg-orange-50 border border-orange-200 rounded-lg p-3">
          <p className="text-sm font-medium text-orange-700">我的食材已加入</p>
          <p className="text-xs text-gray-500 mt-1">{INGREDIENTS.find((i) => i.id === myEntry.ingredient)?.label} — {myEntry.description}</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="sip-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-gray-700 text-white font-medium"
        >
          揭開湯鍋
        </button>
      )}

      {revealed && entries.length === 0 && (
        <div data-testid="sip-empty" className="text-center text-gray-400 py-8">湯鍋還是空的</div>
      )}

      {revealed && entries.length > 0 && (
        <div data-testid="sip-result" className="space-y-2">
          {entries.map((e) => (
            <div key={e.entryId} data-testid={`sip-card-${e.entryId}`} className="bg-white border border-orange-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{INGREDIENTS.find((i) => i.id === e.ingredient)?.icon}</span>
                <span className="font-medium text-sm">{e.userName}</span>
                <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">{INGREDIENTS.find((i) => i.id === e.ingredient)?.label}</span>
              </div>
              <p className="text-sm text-gray-700">{e.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
