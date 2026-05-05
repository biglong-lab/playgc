import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { ThankYouNote, ThankYouNoteConfig, ThankYouNoteState, ThanksNote } from "./ThankYouNote";

interface ThankYouNotePageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: ThankYouNoteConfig = {
  title: "💌 感謝便條",
  prompt: "寫一張感謝便條給你想感謝的人",
  recipientLabel: "感謝誰",
  messageLabel: "感謝的話",
  maxLength: 150,
  anonymous: false,
};

function extractConfig(raw: Record<string, unknown>): ThankYouNoteConfig {
  if ("recipientLabel" in raw && typeof raw.recipientLabel === "string") {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      recipientLabel: raw.recipientLabel,
      messageLabel: typeof raw.messageLabel === "string" ? raw.messageLabel : DEFAULT_CONFIG.messageLabel,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
      anonymous: typeof raw.anonymous === "boolean" ? raw.anonymous : DEFAULT_CONFIG.anonymous,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function ThankYouNotePage({ gameId, sessionId, pageId, config }: ThankYouNotePageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ThankYouNoteState>({
    gameId,
    sessionId,
    pageId,
    type: "thank_you_note",
    defaultState: { notes: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (recipient: string, message: string) => {
    const already = state.notes.find((n: ThanksNote) => n.fromUserId === userId);
    if (already) return;
    updateState({
      ...state,
      notes: [
        ...state.notes,
        {
          noteId: `${userId}-${Date.now()}`,
          fromUserId: userId,
          fromUserName: cfg.anonymous ? "匿名" : userName,
          recipient,
          message,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <ThankYouNote
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
