// 📺 TriviaShowdownPage — GamePageRenderer 對應 pageType="host_trivia_showdown"

import { useCallback } from "react";
import TriviaShowdown, { type TriviaShowdownConfig } from "./TriviaShowdown";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import { useAuth } from "@/hooks/useAuth";
import { useMyUserName } from "@/hooks/useMyUserName";
import type { Page } from "@shared/schema";

interface TriviaShowdownPageProps {
  page: Page;
}

interface AnswerRecord {
  choice: number;
  ts: number;
}

interface TriviaShowdownStateShape {
  currentQuestionIdx: number;
  status: "intro" | "question" | "answering" | "revealed" | "ended";
  answered: Record<string, AnswerRecord>;
  scores: Record<string, number>;
  questionStartedAt?: number;
}

const DEFAULT_SCORE_BY_RANK = [100, 75, 50, 25];

export default function TriviaShowdownPage({ page }: TriviaShowdownPageProps) {
  // W14 D3: LINE 名字優先 → admin 帳號 fallback → 匿名
  const lineName = useMyUserName();
  const { user } = useAuth();
  const myUserName = lineName || user?.firstName || user?.email?.split("@")[0] || "匿名";

  const rawConfig = (page.config as { config?: TriviaShowdownConfig } | TriviaShowdownConfig | null) ?? null;
  const config: TriviaShowdownConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TriviaShowdownConfig | null)) ?? {
      title: "🏆 知識搶答",
      questions: [
        {
          id: "q1",
          prompt: "金門最大的紀念日是？",
          options: ["823 砲戰", "古寧頭戰役", "921 大地震", "雙十國慶"],
          correctIdx: 0,
          timeLimitSec: 15,
        },
        {
          id: "q2",
          prompt: "金門特產之一（飲品）？",
          options: ["金門蜜棗", "金門高粱酒", "金門麻油", "金門綠豆湯"],
          correctIdx: 1,
          timeLimitSec: 15,
        },
      ],
    };

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: TriviaShowdownStateShape | null,
    ): TriviaShowdownStateShape | null => {
      if (pulseType !== "answer") return null;

      const baseState: TriviaShowdownStateShape = currentState ?? {
        currentQuestionIdx: 0,
        status: "intro",
        answered: {},
        scores: {},
      };

      // 只在 answering 階段接受答案
      if (baseState.status !== "answering") return baseState;

      const p = payload as { choice?: number };
      if (typeof p?.choice !== "number") return baseState;

      // 該玩家本題已答 → 拒絕（一人一題）
      // 注意：我們無法從 pulse payload 取 fromUserId（hook 沒暴露），
      // 簡化版用 myUserName，正式版應從 ws message.fromUserId 來
      if (baseState.answered[myUserName]) return baseState;

      const questions = config.questions ?? [];
      const currentQ = questions[baseState.currentQuestionIdx];
      if (!currentQ) return baseState;

      const newAnswered = {
        ...baseState.answered,
        [myUserName]: { choice: p.choice, ts: Date.now() },
      };

      // 答對 → 依現有「正確答對」次序給分
      let newScores = { ...baseState.scores };
      const isCorrect = p.choice === currentQ.correctIdx;
      if (isCorrect) {
        const prevCorrectCount = Object.entries(baseState.answered).filter(([, a]) => a.choice === currentQ.correctIdx).length;
        const scoreByRank = config.scoreByRank ?? DEFAULT_SCORE_BY_RANK;
        const score = scoreByRank[prevCorrectCount] ?? scoreByRank[scoreByRank.length - 1];
        newScores[myUserName] = (newScores[myUserName] ?? 0) + score;
      }

      return { ...baseState, answered: newAnswered, scores: newScores };
    },
    [config, myUserName],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<TriviaShowdownStateShape>({
    onPulse: handlePulse,
  });

  return (
    <TriviaShowdown
      config={config}
      hostMode={hostMode}
      state={state}
      myUserName={myUserName}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
