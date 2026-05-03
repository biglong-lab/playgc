// 📺 EmojiReactPage — GamePageRenderer 用此元件對應 pageType="host_emoji_react"
// 設計依據：docs/decisions/0004-host-screen-axis.md

import { useCallback, useMemo } from "react";
import EmojiReact, { type EmojiReactConfig } from "./EmojiReact";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface EmojiReactPageProps {
  page: Page;
}

interface FlyingEmoji {
  id: string;
  emoji: string;
  x: number;
  startedAt: number;
}

interface EmojiReactStateShape {
  counts: Record<string, number>;
  totalReacts: number;
  recentFlying: FlyingEmoji[];
}

const DEFAULT_EMOJIS = ["❤️", "👍", "🎉", "🔥", "😍", "👏", "😂", "🙌"];
const MAX_FLYING = 50;

export default function EmojiReactPage({ page }: EmojiReactPageProps) {
  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<EmojiReactConfig>(() => {
    const raw = (page.config as { config?: EmojiReactConfig } | EmojiReactConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as EmojiReactConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: EmojiReactStateShape | null,
    ): EmojiReactStateShape | null => {
      if (pulseType !== "react") return null;
      const emoji = (payload as { emoji?: string })?.emoji;
      if (!emoji) return null;

      const emojis = config.emojis ?? DEFAULT_EMOJIS;
      if (!emojis.includes(emoji)) return null;

      const baseState: EmojiReactStateShape = currentState ?? {
        counts: Object.fromEntries(emojis.map((e) => [e, 0])),
        totalReacts: 0,
        recentFlying: [],
      };

      const newFlying: FlyingEmoji = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        emoji,
        x: Math.floor(Math.random() * 90),
        startedAt: Date.now(),
      };

      const recentFlying = [...baseState.recentFlying, newFlying].slice(-MAX_FLYING);

      return {
        counts: {
          ...baseState.counts,
          [emoji]: (baseState.counts[emoji] ?? 0) + 1,
        },
        totalReacts: baseState.totalReacts + 1,
        recentFlying,
      };
    },
    [config],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<EmojiReactStateShape>({
    onPulse: handlePulse,
  });

  return (
    <EmojiReact
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
