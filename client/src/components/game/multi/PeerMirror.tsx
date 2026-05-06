import { useState } from "react";
import { Loader2, Eye } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MirrorEntry {
  entryId: string;
  userId: string;
  userName: string;
  targetName: string;
  strength: string;
  note: string;
}

interface PeerMirrorState extends Record<string, unknown> {
  entries: MirrorEntry[];
  revealed: boolean;
}

interface PeerMirrorConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): PeerMirrorConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "同伴之鏡",
    prompt:
      typeof raw.prompt === "string"
        ? raw.prompt
        : "你觀察到哪位隊友的哪個優點，讓你印象深刻？",
  };
}

const STRENGTHS = [
  "細心觀察",
  "創意思考",
  "推動力",
  "同理心",
  "溝通清晰",
  "執行力",
  "穩定支撐",
  "學習力",
  "正能量",
  "包容度",
];

const DEFAULT_STATE: PeerMirrorState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function PeerMirror({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<PeerMirrorState>({
    gameId,
    sessionId,
    pageId,
    type: "peer_mirror",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const [targetName, setTargetName] = useState("");
  const [strength, setStrength] = useState("");
  const [note, setNote] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="pm-loading" />;

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = targetName.trim().length > 0 && strength !== "";

  function handleSubmit() {
    if (!canSubmit) return;
    const entry: MirrorEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      targetName: targetName.trim(),
      strength,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setTargetName("");
    setStrength("");
    setNote("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const total = state.entries.length;

  const recipientGroups = state.revealed
    ? Array.from(new Set(state.entries.map((e) => e.targetName))).map((name) => ({
        name,
        cards: state.entries.filter((e) => e.targetName === name),
      }))
    : [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5 text-indigo-500" />
        <h2 className="text-xl font-bold" data-testid="pm-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="pm-prompt">
        {cfg.prompt}
      </p>
      <p className="text-xs text-gray-400" data-testid="pm-count">
        已提交：{total} 筆
      </p>

      {!myEntry ? (
        <div data-testid="pm-form" className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              隊友名字
            </label>
            <input
              data-testid="pm-target-input"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="輸入隊友名字"
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              你觀察到的優點
            </label>
            <div
              data-testid="pm-strength-picker"
              className="grid grid-cols-2 gap-1.5"
            >
              {STRENGTHS.map((s) => (
                <button
                  key={s}
                  data-testid={`pm-strength-${s}`}
                  onClick={() => setStrength(s)}
                  className={`px-2 py-1.5 rounded border text-xs transition-all ${
                    strength === s
                      ? "bg-indigo-500 border-indigo-500 text-white font-bold"
                      : "border-gray-200 text-gray-700 hover:border-indigo-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              具體觀察（選填）
            </label>
            <input
              data-testid="pm-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="描述一個你觀察到的具體行為"
              className="w-full p-2 border rounded text-sm"
            />
          </div>

          <button
            data-testid="pm-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-2 bg-indigo-500 text-white rounded text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出觀察
          </button>
        </div>
      ) : (
        <div
          className="p-3 bg-indigo-50 rounded border border-indigo-200 text-sm space-y-1"
          data-testid="pm-my-entry"
        >
          <p className="text-xs text-indigo-600 font-medium">你的觀察已送出</p>
          <p className="font-bold text-indigo-800">
            給 {myEntry.targetName}：{myEntry.strength}
          </p>
          {myEntry.note && (
            <p className="text-xs text-indigo-600 opacity-80">{myEntry.note}</p>
          )}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="pm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-indigo-500 text-white rounded text-sm"
        >
          揭示同伴之鏡
        </button>
      )}

      {state.revealed && (
        <div data-testid="pm-result" className="space-y-4">
          <p className="text-sm font-semibold text-gray-600">🔮 全隊互照之鏡</p>
          {total === 0 ? (
            <p data-testid="pm-empty" className="text-gray-400 text-sm">
              尚無觀察
            </p>
          ) : (
            <div data-testid="pm-recipient-list" className="space-y-4">
              {recipientGroups.map((group) => (
                <div
                  key={group.name}
                  data-testid={`pm-recipient-${group.name}`}
                  className="space-y-1.5"
                >
                  <p className="text-xs font-semibold text-indigo-700">
                    ✨ {group.name} 收到的觀察
                  </p>
                  {group.cards.map((card) => (
                    <div
                      key={card.entryId}
                      data-testid={`pm-card-${card.entryId}`}
                      className="p-2.5 bg-white border border-indigo-100 rounded-lg text-xs space-y-0.5"
                    >
                      <p className="font-bold text-indigo-800">{card.strength}</p>
                      {card.note && (
                        <p className="text-gray-500 italic">「{card.note}」</p>
                      )}
                      <p className="text-gray-400">— {card.userName}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PeerMirror;
