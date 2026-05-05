import { useState } from "react";
import { CheckCircle2, BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StoryBlank {
  id: string;
  label: string;
  hint?: string;
}

export interface MadLibsConfig {
  title: string;
  story: string;
  blanks: StoryBlank[];
  revealWhenFull: boolean;
}

export interface BlankFill {
  blankId: string;
  value: string;
  filledBy: string;
  filledByName: string;
  filledAt: number;
}

export interface MadLibsState extends Record<string, unknown> {
  fills: BlankFill[];
  revealed: boolean;
}

interface Props {
  config: MadLibsConfig;
  state: MadLibsState;
  myUserId: string;
  myUserName: string;
  draftValue: string;
  selectedBlankId: string | null;
  onSelectBlank: (blankId: string) => void;
  onDraftChange: (value: string) => void;
  onFill: (blankId: string, value: string) => void;
  onReveal: () => void;
}

function assembleStory(story: string, blanks: StoryBlank[], fills: BlankFill[]): React.ReactNode[] {
  const fillMap: Record<string, BlankFill> = {};
  for (const f of fills) fillMap[f.blankId] = f;

  const parts: React.ReactNode[] = [];
  let remaining = story;
  let key = 0;

  for (const blank of blanks) {
    const placeholder = `{${blank.id}}`;
    const idx = remaining.indexOf(placeholder);
    if (idx === -1) continue;
    if (idx > 0) {
      parts.push(<span key={key++}>{remaining.slice(0, idx)}</span>);
    }
    const fill = fillMap[blank.id];
    parts.push(
      fill ? (
        <span key={key++} className="font-bold text-indigo-600 underline decoration-dotted">
          {fill.value}
        </span>
      ) : (
        <span key={key++} className="inline-block px-3 border-b-2 border-gray-400 text-gray-400 italic text-sm">
          {blank.label}
        </span>
      ),
    );
    remaining = remaining.slice(idx + placeholder.length);
  }
  if (remaining) parts.push(<span key={key++}>{remaining}</span>);
  return parts;
}

export default function MadLibs({
  config,
  state,
  myUserId,
  draftValue,
  selectedBlankId,
  onSelectBlank,
  onDraftChange,
  onFill,
  onReveal,
}: Props) {
  const { title, story, blanks, revealWhenFull } = config;
  const { fills, revealed } = state;

  const fillMap: Record<string, BlankFill> = {};
  for (const f of fills) fillMap[f.blankId] = f;

  const myFilledIds = fills.filter((f) => f.filledBy === myUserId).map((f) => f.blankId);
  const allFilled = blanks.every((b) => fillMap[b.id]);
  const filledCount = blanks.filter((b) => fillMap[b.id]).length;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-pink-50 to-orange-50 flex flex-col px-4 py-6 gap-5"
      data-testid="ml-root"
    >
      <div className="text-center">
        <div className="text-3xl mb-1">🎭</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="ml-title">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">搶先填入空格，完成後一起揭曉故事！</p>
      </div>

      <div
        className="bg-white rounded-2xl shadow p-5 text-sm text-gray-500 leading-relaxed"
        data-testid="ml-progress"
      >
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-gray-500">填空進度</span>
          <span className="text-xs font-semibold text-orange-600" data-testid="ml-fill-count">
            {filledCount} / {blanks.length}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all"
            style={{ width: `${blanks.length > 0 ? (filledCount / blanks.length) * 100 : 0}%` }}
            data-testid="ml-progress-bar"
          />
        </div>
      </div>

      {!revealed && (
        <div className="flex flex-col gap-2" data-testid="ml-blanks-list">
          {blanks.map((blank) => {
            const fill = fillMap[blank.id];
            const isMyFill = fill?.filledBy === myUserId;
            const isSelected = selectedBlankId === blank.id;
            const isTaken = Boolean(fill);

            return (
              <div
                key={blank.id}
                className={`bg-white rounded-xl p-3 border-2 transition-all ${
                  isSelected
                    ? "border-orange-400 shadow-md"
                    : isTaken
                    ? "border-gray-100 opacity-70"
                    : "border-transparent hover:border-orange-200"
                }`}
                data-testid={`ml-blank-${blank.id}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-gray-700 text-sm">{blank.label}</span>
                    {blank.hint && (
                      <span className="text-xs text-gray-400 ml-2">({blank.hint})</span>
                    )}
                  </div>
                  {isTaken ? (
                    <div className="flex items-center gap-1">
                      {isMyFill ? (
                        <span
                          className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full"
                          data-testid={`ml-my-fill-${blank.id}`}
                        >
                          {fill.value}
                        </span>
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-gray-400" />
                      )}
                    </div>
                  ) : (
                    !myFilledIds.includes(blank.id) && (
                      <button
                        onClick={() => onSelectBlank(blank.id)}
                        className="text-xs bg-orange-500 text-white px-2 py-1 rounded-lg hover:bg-orange-600"
                        data-testid={`ml-claim-${blank.id}`}
                      >
                        填入
                      </button>
                    )
                  )}
                </div>

                {isSelected && !isTaken && (
                  <div className="mt-2 flex gap-2" data-testid={`ml-input-area-${blank.id}`}>
                    <input
                      value={draftValue}
                      onChange={(e) => onDraftChange(e.target.value)}
                      placeholder={`填入「${blank.label}」`}
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-orange-400"
                      data-testid={`ml-input-${blank.id}`}
                    />
                    <Button
                      size="sm"
                      disabled={!draftValue.trim()}
                      onClick={() => onFill(blank.id, draftValue.trim())}
                      className="bg-orange-500 hover:bg-orange-600 text-white text-xs"
                      data-testid={`ml-confirm-${blank.id}`}
                    >
                      確認
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {allFilled && !revealed && (
        <Button
          onClick={onReveal}
          className="bg-pink-600 hover:bg-pink-700 text-white"
          data-testid="ml-reveal-btn"
        >
          <BookOpen className="w-4 h-4 mr-2" />
          揭曉完整故事！
        </Button>
      )}

      {revealed && (
        <div className="bg-white rounded-2xl shadow-lg p-6" data-testid="ml-story-revealed">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-pink-500" />
            <p className="font-semibold text-gray-700">完整故事</p>
            <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />
          </div>
          <p className="text-gray-700 leading-relaxed text-base" data-testid="ml-story-text">
            {assembleStory(story, blanks, fills)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2" data-testid="ml-credits">
            {fills.map((f) => {
              const blank = blanks.find((b) => b.id === f.blankId);
              return (
                <span
                  key={f.blankId}
                  className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full border border-pink-200"
                  data-testid={`ml-credit-${f.blankId}`}
                >
                  {blank?.label}：{f.filledByName}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {!revealed && !allFilled && (
        <p className="text-center text-xs text-gray-400" data-testid="ml-waiting-hint">
          等待所有空格填入後可揭曉故事
        </p>
      )}
    </div>
  );
}
