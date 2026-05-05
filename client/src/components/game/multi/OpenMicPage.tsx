import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import OpenMic, {
  OpenMicConfig,
  OpenMicState,
  MicSlot,
} from "./OpenMic";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: OpenMicConfig = {
  title: "開放麥克風",
  prompt: "搶麥！說出你想分享的話",
  maxTopicLength: 50,
};

const DEFAULT_STATE: OpenMicState = {
  slots: [],
  currentSlotId: null,
};

export default function OpenMicPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: OpenMicConfig =
    raw && typeof raw === "object" && "maxTopicLength" in raw
      ? (raw as OpenMicConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: OpenMicConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<OpenMicState>({
      gameId,
      sessionId,
      pageId,
      type: "open_mic",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleRequest(topic: string) {
    const already = state.slots.find(
      (s: MicSlot) => s.userId === myUserId && s.status !== "done"
    );
    if (already) return;
    const newSlot: MicSlot = {
      slotId: `slot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      topic,
      status: "waiting",
    };
    updateState({ ...state, slots: [...state.slots, newSlot] });
  }

  function handleNext() {
    const next = state.slots.find(
      (s: MicSlot) => s.status === "waiting"
    );
    if (!next) return;
    const updatedSlots = state.slots.map((s: MicSlot) =>
      s.slotId === next.slotId
        ? { ...s, status: "active" as const }
        : s
    );
    updateState({
      ...state,
      slots: updatedSlots,
      currentSlotId: next.slotId,
    });
  }

  function handleDone(slotId: string) {
    const updatedSlots = state.slots.map((s: MicSlot) =>
      s.slotId === slotId ? { ...s, status: "done" as const } : s
    );
    updateState({ ...state, slots: updatedSlots, currentSlotId: null });
  }

  return (
    <OpenMic
      config={config}
      state={state}
      myUserId={myUserId}
      onRequest={handleRequest}
      onNext={handleNext}
      onDone={handleDone}
    />
  );
}
