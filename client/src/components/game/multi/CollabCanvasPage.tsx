import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { CollabCanvas } from "./CollabCanvas";
import type { CollabCanvasConfig, CollabCanvasState, CanvasNote } from "./CollabCanvas";

const NOTE_COLORS = ["#FDE68A", "#BBF7D0", "#BFDBFE", "#F9A8D4", "#D8B4FE", "#FDBA74"];

const DEFAULT_CONFIG: CollabCanvasConfig = {
  title: "協作畫布",
  prompt: "將你的想法貼在對應的區域",
  zones: ["Keep（保留）", "Drop（捨棄）", "Improve（改善）"],
  maxPerUser: 3,
  maxLength: 40,
};

function extractConfig(raw: Record<string, unknown>): CollabCanvasConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    zones: Array.isArray(raw.zones) ? (raw.zones as string[]) : DEFAULT_CONFIG.zones,
    maxPerUser: typeof raw.maxPerUser === "number" ? raw.maxPerUser : DEFAULT_CONFIG.maxPerUser,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
  };
}

const DEFAULT_STATE: CollabCanvasState = { notes: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CollabCanvasPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<CollabCanvasState>({
    gameId,
    sessionId,
    pageId,
    type: "collab_canvas",
    defaultState: DEFAULT_STATE,
  });

  function handleAddNote(zone: string, content: string) {
    const idx = state.notes.filter((n) => n.userId === userId).length;
    const note: CanvasNote = {
      noteId: `${userId}-${Date.now()}`,
      userId,
      userName,
      zone,
      content,
      color: NOTE_COLORS[idx % NOTE_COLORS.length],
    };
    updateState({ ...state, notes: [...state.notes, note] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CollabCanvas
      config={config}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      isLoaded={isLoaded}
      onAddNote={handleAddNote}
      onReveal={handleReveal}
    />
  );
}

export default CollabCanvasPage;
