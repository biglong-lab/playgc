import { Loader2, Eye } from "lucide-react";

export interface MoodOption extends Record<string, unknown> {
  id: string;
  emoji: string;
  label: string;
  color: string;
}

export interface MoodEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  moodId: string;
}

export interface PixelMoodConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  moods: MoodOption[];
}

export interface PixelMoodState extends Record<string, unknown> {
  entries: MoodEntry[];
  revealed: boolean;
}

interface PixelMoodProps {
  config: PixelMoodConfig;
  state: PixelMoodState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onSubmit: (moodId: string) => void;
  onReveal: () => void;
}

export function PixelMood({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onSubmit,
  onReveal,
}: PixelMoodProps) {
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  const { title, prompt, moods } = config;
  const { entries, revealed } = state;
  const myEntry = entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;
  const myMood = moods.find((m) => m.id === myEntry?.moodId);

  const tally: Record<string, number> = {};
  for (const mood of moods) tally[mood.id] = 0;
  for (const e of entries) {
    if (tally[e.moodId] !== undefined) tally[e.moodId]++;
  }

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="pm-title" className="text-xl font-bold text-center text-pink-700">
        {title}
      </h2>
      <p data-testid="pm-prompt" className="text-center text-gray-600 text-sm">
        {prompt}
      </p>
      <p data-testid="pm-count" className="text-sm text-gray-500 text-center">
        已有 {entries.length} 人選擇
      </p>

      {!hasSubmitted && !revealed && (
        <div data-testid="pm-mood-grid" className="grid grid-cols-2 gap-3">
          {moods.map((mood) => (
            <button
              key={mood.id}
              data-testid={`pm-mood-${mood.id}`}
              onClick={() => onSubmit(mood.id)}
              style={{ backgroundColor: mood.color + "22", borderColor: mood.color }}
              className="border-2 rounded-xl p-4 flex flex-col items-center gap-1 hover:scale-105 transition-transform"
            >
              <span className="text-3xl">{mood.emoji}</span>
              <span className="text-sm font-medium" style={{ color: mood.color }}>
                {mood.label}
              </span>
            </button>
          ))}
        </div>
      )}

      {hasSubmitted && !revealed && myMood && (
        <div
          data-testid="pm-my-entry"
          style={{ backgroundColor: myMood.color + "22", borderColor: myMood.color }}
          className="border-2 rounded-xl p-4 text-center"
        >
          <div className="text-4xl">{myMood.emoji}</div>
          <div className="text-sm font-medium mt-1" style={{ color: myMood.color }}>
            你選了：{myMood.label}
          </div>
        </div>
      )}

      {isTeamLead && !revealed && entries.length > 0 && (
        <button
          data-testid="pm-reveal-btn"
          onClick={onReveal}
          className="w-full flex items-center justify-center gap-2 bg-pink-500 text-white py-2 rounded-xl text-sm font-medium"
        >
          <Eye size={16} />
          公開心情馬賽克
        </button>
      )}

      {revealed && (
        <div data-testid="pm-result" className="space-y-4">
          <div className="grid grid-cols-4 gap-1">
            {entries.map((e) => {
              const m = moods.find((mo) => mo.id === e.moodId);
              return (
                <div
                  key={e.entryId}
                  data-testid={`pm-pixel-${e.entryId}`}
                  title={`${e.userName}: ${m?.label}`}
                  style={{ backgroundColor: m?.color ?? "#ccc" }}
                  className="aspect-square rounded-sm"
                />
              );
            })}
          </div>
          <div className="space-y-2">
            {moods.map((mood) => (
              <div
                key={mood.id}
                data-testid={`pm-tally-${mood.id}`}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-xl">{mood.emoji}</span>
                <span className="font-medium" style={{ color: mood.color }}>
                  {mood.label}
                </span>
                <span className="ml-auto text-gray-600">{tally[mood.id]} 人</span>
                <div
                  className="h-3 rounded-full"
                  style={{
                    backgroundColor: mood.color,
                    width: `${entries.length > 0 ? (tally[mood.id] / entries.length) * 80 : 0}px`,
                    minWidth: "4px",
                  }}
                />
              </div>
            ))}
          </div>
          {entries.length === 0 && (
            <p data-testid="pm-empty" className="text-center text-gray-400 text-sm">
              還沒有人選擇
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default PixelMood;
