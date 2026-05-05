import { useState } from "react";

export interface MicSlot extends Record<string, unknown> {
  slotId: string;
  userId: string;
  userName: string;
  topic: string;
  status: "waiting" | "active" | "done";
}

export interface OpenMicConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxTopicLength: number;
}

export interface OpenMicState extends Record<string, unknown> {
  slots: MicSlot[];
  currentSlotId: string | null;
}

const DEFAULT_CONFIG: OpenMicConfig = {
  title: "開放麥克風",
  prompt: "搶麥！說出你想分享的話",
  maxTopicLength: 50,
};

interface Props {
  config: OpenMicConfig;
  state: OpenMicState;
  myUserId: string;
  onRequest: (topic: string) => void;
  onNext: () => void;
  onDone: (slotId: string) => void;
}

export default function OpenMic({
  config,
  state,
  myUserId,
  onRequest,
  onNext,
  onDone,
}: Props) {
  const [topicInput, setTopicInput] = useState("");

  const maxTopicLength =
    config.maxTopicLength ?? DEFAULT_CONFIG.maxTopicLength;
  const { slots, currentSlotId } = state;

  const mySlot = slots.find(
    (s) => s.userId === myUserId && s.status !== "done"
  );
  const currentSlot = slots.find((s) => s.slotId === currentSlotId);
  const waitingSlots = slots.filter((s) => s.status === "waiting");
  const doneSlots = slots.filter((s) => s.status === "done");

  const overLimit = topicInput.length > maxTopicLength;
  const canRequest =
    topicInput.trim().length > 0 && !overLimit && !mySlot;

  function handleRequest() {
    if (!canRequest) return;
    onRequest(topicInput.trim());
    setTopicInput("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="om-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p
        data-testid="om-prompt"
        className="text-center text-gray-600 text-sm"
      >
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {currentSlot && (
        <div
          data-testid={`om-current-${currentSlot.slotId}`}
          className="p-4 bg-violet-50 border-2 border-violet-400 rounded-xl"
        >
          <p className="text-xs text-violet-500 mb-1">🎤 現在講話中</p>
          <p className="font-bold text-violet-800">{currentSlot.userName}</p>
          <p className="text-sm text-violet-600 mt-1">{currentSlot.topic}</p>
          <button
            data-testid="om-done-btn"
            onClick={() => onDone(currentSlot.slotId)}
            className="mt-3 w-full py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
          >
            ✅ 講完了
          </button>
        </div>
      )}

      {!mySlot ? (
        <div className="space-y-2">
          <textarea
            data-testid="om-request-input"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            placeholder="你想分享什麼？（一句話）"
            rows={2}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
          {overLimit && (
            <p
              data-testid="om-topic-error"
              className="text-xs text-red-500"
            >
              超過字數限制（{maxTopicLength} 字）
            </p>
          )}
          <div className="flex justify-end">
            <button
              data-testid="om-request-btn"
              onClick={handleRequest}
              disabled={!canRequest}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-violet-700"
            >
              搶麥克風
            </button>
          </div>
        </div>
      ) : (
        <p
          data-testid="om-submitted-msg"
          className="text-center text-sm text-green-600"
        >
          ✅ 已登記：{mySlot.topic}
        </p>
      )}

      {waitingSlots.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              等待中（{waitingSlots.length} 人）
            </p>
            {!currentSlotId && (
              <button
                data-testid="om-next-btn"
                onClick={onNext}
                className="px-3 py-1 text-sm bg-violet-100 text-violet-700 rounded-lg hover:bg-violet-200"
              >
                呼叫下一位
              </button>
            )}
          </div>
          {waitingSlots.map((slot) => (
            <div
              key={slot.slotId}
              data-testid={`om-slot-${slot.slotId}`}
              className="p-3 rounded-lg border border-gray-200 bg-white"
            >
              <p className="text-sm font-medium">{slot.userName}</p>
              <p className="text-xs text-gray-500 mt-1">{slot.topic}</p>
            </div>
          ))}
        </div>
      )}

      {waitingSlots.length === 0 && !currentSlot && slots.length === 0 && (
        <div
          data-testid="om-empty"
          className="text-center text-gray-400 py-8"
        >
          尚無人登記，快來搶麥吧！
        </div>
      )}

      {doneSlots.length > 0 && (
        <p
          data-testid="om-done-count"
          className="text-xs text-center text-gray-400"
        >
          已完成 {doneSlots.length} 位
        </p>
      )}
    </div>
  );
}
