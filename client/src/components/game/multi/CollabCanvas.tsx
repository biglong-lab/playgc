import { useState } from "react";
import { Loader2, Send, Eye } from "lucide-react";

export interface CanvasNote extends Record<string, unknown> {
  noteId: string;
  userId: string;
  userName: string;
  zone: string;
  content: string;
  color: string;
}

export interface CollabCanvasConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  zones: string[];
  maxPerUser: number;
  maxLength: number;
}

export interface CollabCanvasState extends Record<string, unknown> {
  notes: CanvasNote[];
  revealed: boolean;
}

interface CollabCanvasProps {
  config: CollabCanvasConfig;
  state: CollabCanvasState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onAddNote: (zone: string, content: string) => void;
  onReveal: () => void;
}

const NOTE_COLORS = ["#FDE68A", "#BBF7D0", "#BFDBFE", "#F9A8D4", "#D8B4FE", "#FDBA74"];

export function CollabCanvas({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onAddNote,
  onReveal,
}: CollabCanvasProps) {
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [content, setContent] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  const { title, prompt, zones, maxPerUser, maxLength } = config;
  const { notes, revealed } = state;
  const myNotes = notes.filter((n) => n.userId === userId);
  const canAdd = myNotes.length < maxPerUser;

  function handleAdd() {
    const trimmed = content.trim();
    if (!trimmed || !selectedZone) return;
    onAddNote(selectedZone, trimmed);
    setContent("");
  }

  const notesForZone = (zone: string) => notes.filter((n) => n.zone === zone);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <h2 data-testid="cc-title" className="text-xl font-bold text-center text-amber-700">
        {title}
      </h2>
      <p data-testid="cc-prompt" className="text-center text-gray-600 text-sm">
        {prompt}
      </p>
      <p data-testid="cc-count" className="text-sm text-gray-500 text-center">
        已有 {notes.length} 張便利貼
      </p>

      {canAdd && !revealed && (
        <div className="space-y-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div data-testid="cc-zone-select" className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <button
                key={z}
                data-testid={`cc-zone-btn-${z}`}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  selectedZone === z
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-amber-700 border-amber-300"
                }`}
              >
                {z}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              data-testid="cc-input"
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={selectedZone ? `在「${selectedZone}」貼便利貼...` : "先選擇區域"}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <button
              data-testid="cc-add-btn"
              onClick={handleAdd}
              disabled={!content.trim() || !selectedZone}
              className="flex items-center gap-1 bg-amber-500 text-white px-3 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-right">
            {myNotes.length}/{maxPerUser} 張
          </p>
        </div>
      )}

      {!revealed && myNotes.length > 0 && (
        <div data-testid="cc-my-notes" className="flex flex-wrap gap-2">
          {myNotes.map((n) => (
            <div
              key={n.noteId}
              data-testid={`cc-my-note-${n.noteId}`}
              style={{ backgroundColor: n.color }}
              className="rounded-lg p-2 text-xs shadow-sm max-w-32 text-gray-800"
            >
              <div className="font-semibold text-gray-500 text-xs mb-1">{n.zone}</div>
              {n.content}
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !revealed && notes.length > 0 && (
        <button
          data-testid="cc-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開協作畫布
        </button>
      )}

      {revealed && (
        <div data-testid="cc-result" className="space-y-4">
          {zones.map((zone) => {
            const zoneNotes = notesForZone(zone);
            return (
              <div key={zone} data-testid={`cc-zone-${zone}`} className="space-y-2">
                <h3 className="text-sm font-bold text-gray-700 border-b pb-1">
                  {zone} ({zoneNotes.length})
                </h3>
                {zoneNotes.length === 0 && (
                  <p className="text-xs text-gray-400">此區域沒有便利貼</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {zoneNotes.map((n, i) => (
                    <div
                      key={n.noteId}
                      data-testid={`cc-note-${n.noteId}`}
                      style={{ backgroundColor: NOTE_COLORS[i % NOTE_COLORS.length] }}
                      className="rounded-lg p-2 text-xs shadow-sm max-w-36 text-gray-800"
                    >
                      <div className="font-semibold text-gray-500 text-xs mb-1">
                        {n.userName}
                      </div>
                      {n.content}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {notes.length === 0 && (
            <p data-testid="cc-empty" className="text-center text-gray-400 text-sm">
              還沒有便利貼
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CollabCanvas;
