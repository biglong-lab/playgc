import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import EmojiStory, {
  EmojiStoryConfig,
  EmojiStoryState,
  Story,
} from "./EmojiStory";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: EmojiStoryConfig = {
  title: "Emoji 故事創作",
  prompt: "用 3 個 Emoji 說出你的心情或故事",
  emojiOptions: [],
  maxEmojis: 3,
  captionMaxLength: 30,
  showAuthor: true,
};

const DEFAULT_STATE: EmojiStoryState = {
  stories: [],
  revealed: false,
};

export default function EmojiStoryPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: EmojiStoryConfig =
    rawConfig && typeof rawConfig === "object" && "emojiOptions" in rawConfig
      ? (rawConfig as EmojiStoryConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: EmojiStoryConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_story",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-yellow-500" />
      </div>
    );
  }

  function handleSubmit(emojis: string[], caption: string) {
    const newStory: Story = {
      storyId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      emojis,
      caption,
      hearts: [],
    };
    updateState({ ...state, stories: [...state.stories, newStory] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(storyId: string) {
    const updated = state.stories.map((s: Story) => {
      if (s.storyId !== storyId) return s;
      const already = s.hearts.includes(myUserId);
      return {
        ...s,
        hearts: already ? s.hearts.filter((h: string) => h !== myUserId) : [...s.hearts, myUserId],
      };
    });
    updateState({ ...state, stories: updated });
  }

  return (
    <EmojiStory
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
