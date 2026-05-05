import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ColorPulse, { ColorPulseConfig, ColorPulseState, ColorResponse } from "./ColorPulse";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: ColorPulseConfig = {
  title: "色彩心情牆",
  prompt: "選一個最能代表你現在心情的顏色",
  colors: [],
  maxNoteLength: 30,
  showAuthor: true,
};

const DEFAULT_STATE: ColorPulseState = {
  responses: [],
  revealed: false,
};

export default function ColorPulsePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: ColorPulseConfig =
    rawConfig && typeof rawConfig === "object" && "colors" in rawConfig
      ? (rawConfig as ColorPulseConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: ColorPulseConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ColorPulseState>({
    gameId,
    sessionId,
    pageId,
    type: "color_pulse",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-blue-500" />
      </div>
    );
  }

  function handleSubmit(colorId: string, colorHex: string, colorLabel: string, note: string) {
    const newResponse: ColorResponse = {
      responseId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      colorId,
      colorHex,
      colorLabel,
      note,
      hearts: [],
    };
    updateState({ ...state, responses: [...state.responses, newResponse] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(responseId: string) {
    const updated = state.responses.map((r: ColorResponse) => {
      if (r.responseId !== responseId) return r;
      const already = r.hearts.includes(myUserId);
      return {
        ...r,
        hearts: already ? r.hearts.filter((h: string) => h !== myUserId) : [...r.hearts, myUserId],
      };
    });
    updateState({ ...state, responses: updated });
  }

  return (
    <ColorPulse
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
