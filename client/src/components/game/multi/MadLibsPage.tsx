import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import MadLibs, {
  type MadLibsConfig,
  type MadLibsState,
  type BlankFill,
} from "./MadLibs";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface MadLibsPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: MadLibsConfig = {
  title: "🎭 我們的故事",
  story: "今天 {hero} 帶著一隻 {animal} 來到 {place}，大家都說這是 {year} 年最 {adj} 的一天！",
  blanks: [
    { id: "hero", label: "主角名字", hint: "填一個人名" },
    { id: "animal", label: "動物", hint: "任意動物" },
    { id: "place", label: "地點", hint: "真實或虛構地點" },
    { id: "year", label: "年份", hint: "數字" },
    { id: "adj", label: "形容詞", hint: "任意形容詞" },
  ],
  revealWhenFull: true,
};

const DEFAULT_STATE: MadLibsState = { fills: [], revealed: false };

export default function MadLibsPage({ page, sessionId, gameId, pageId }: MadLibsPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: MadLibsConfig } | MadLibsConfig | null) ?? null;
  const config: MadLibsConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as MadLibsConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<MadLibsState>({
    gameId,
    sessionId,
    pageId,
    type: "mad_libs",
    defaultState: DEFAULT_STATE,
  });

  const [selectedBlankId, setSelectedBlankId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  const handleSelectBlank = useCallback((blankId: string) => {
    setSelectedBlankId(blankId);
    setDraftValue("");
  }, []);

  const handleDraftChange = useCallback((value: string) => {
    setDraftValue(value);
  }, []);

  const handleFill = useCallback(async (blankId: string, value: string) => {
    if (state.fills.some((f: BlankFill) => f.blankId === blankId)) return;
    const newFill: BlankFill = {
      blankId,
      value,
      filledBy: myUserId,
      filledByName: myUserName,
      filledAt: Date.now(),
    };
    const newFills = [...state.fills, newFill];
    const allFilled = config.blanks.every((b) => newFills.some((f) => f.blankId === b.id));
    const shouldReveal = config.revealWhenFull && allFilled;
    await updateState({ ...state, fills: newFills, revealed: shouldReveal || state.revealed });
    setSelectedBlankId(null);
    setDraftValue("");
  }, [state, myUserId, myUserName, config.blanks, config.revealWhenFull, updateState]);

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <MadLibs
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      draftValue={draftValue}
      selectedBlankId={selectedBlankId}
      onSelectBlank={handleSelectBlank}
      onDraftChange={handleDraftChange}
      onFill={handleFill}
      onReveal={handleReveal}
    />
  );
}
