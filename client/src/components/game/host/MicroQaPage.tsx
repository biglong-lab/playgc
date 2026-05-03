// 📺 MicroQaPage — GamePageRenderer 對應 pageType="host_micro_qa"
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md

import { useCallback, useMemo } from "react";
import MicroQa, { type MicroQaConfig, type MicroQaState, type QaQuestion } from "./MicroQa";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface MicroQaPageProps {
  page: Page;
}

const MAX_QUESTIONS = 50;

export default function MicroQaPage({ page }: MicroQaPageProps) {
  const config = useMemo<MicroQaConfig>(() => {
    const raw = (page.config as { config?: MicroQaConfig } | MicroQaConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as MicroQaConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: MicroQaState | null,
    ): MicroQaState | null => {
      const baseState: MicroQaState = currentState ?? {
        questions: [],
        totalAsks: 0,
        totalUpvotes: 0,
      };
      const data = payload as { text?: string; askedBy?: string; questionId?: string };

      if (pulseType === "ask") {
        if (!data?.text) return null;
        const newQ: QaQuestion = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          text: data.text.slice(0, 140),
          askedBy: data.askedBy ?? "匿名",
          upvotes: 0,
          askedAt: Date.now(),
          answered: false,
        };
        return {
          questions: [...baseState.questions, newQ].slice(-MAX_QUESTIONS),
          totalAsks: baseState.totalAsks + 1,
          totalUpvotes: baseState.totalUpvotes,
        };
      }

      if (pulseType === "upvote") {
        if (!data?.questionId) return null;
        const target = baseState.questions.find((q) => q.id === data.questionId);
        if (!target || target.answered) return null;
        return {
          questions: baseState.questions.map((q) =>
            q.id === data.questionId ? { ...q, upvotes: q.upvotes + 1 } : q,
          ),
          totalAsks: baseState.totalAsks,
          totalUpvotes: baseState.totalUpvotes + 1,
        };
      }

      if (pulseType === "mark_answered") {
        if (!data?.questionId) return null;
        return {
          questions: baseState.questions.map((q) =>
            q.id === data.questionId ? { ...q, answered: true } : q,
          ),
          totalAsks: baseState.totalAsks,
          totalUpvotes: baseState.totalUpvotes,
        };
      }

      return null;
    },
    [],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<MicroQaState>({
    onPulse: handlePulse,
  });

  return (
    <MicroQa
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
