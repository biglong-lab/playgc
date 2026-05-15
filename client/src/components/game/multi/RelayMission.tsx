// 🏃 RelayMission — 接力任務元件（純 UI）
//
// 玩法（依 docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.7）：
//   - 一個任務分為 N 段，每段一個簡單問答（題目 + 答案）
//   - 段間切換：sequential（依序）/ free（任意）
//   - 玩家分配：hash(sessionId + userId) % memberCount 決定誰負責哪段（穩定）
//   - 玩家數 < 段數 → 部分人負責多段（重複分配）
//   - 玩家數 > 段數 → 部分人沒分到段，看其他人接力
//
// MVP：每段是文字問答；未來可擴充 segmentType 嵌套子玩法（photo/qr/gps）

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Trophy, ArrowRight, Lock as LockIcon, User } from "lucide-react";
import { normalizeAnswer } from "@/lib/gameVerification";
import { fnv1aHash } from "./LockCoop";
import type { RelayMissionConfig } from "@shared/schema";

/**
 * 玩家分配：依 hash(sessionId + userId) 穩定分配段落
 * 段內順序 sequential：用 segmentIndex 決定誰負責（hash % memberCount 對齊）
 * 段內順序 free：每段都用 hash 分配，分配可能重疊（不影響玩法）
 *
 * @internal export 給測試用
 */
export function pickPlayerForSegment(
  segmentIndex: number,
  memberUserIds: string[],
  sessionId: string,
): string | null {
  if (memberUserIds.length === 0) return null;
  // 把 segmentIndex 加進 hash 種子 → 不同段不同玩家（除非 memberCount < segments）
  const hash = fnv1aHash(`${sessionId}:relay:${segmentIndex}`);
  return memberUserIds[hash % memberUserIds.length];
}

export interface RelayMissionProps {
  config: RelayMissionConfig;
  myUserId: string;
  sessionId: string;
  /** 隊員 userId 陣列（含自己），用來分配段落 */
  memberUserIds: string[];
  /** 隊伍共享：當前進到第幾段（0-based） */
  currentSegmentIndex: number;
  /** 已完成的段（user-id by segment index） */
  completedSegments: Array<{ segmentIndex: number; completedBy: string }>;
  /** 是否全部段完成 */
  isAllComplete: boolean;
  /** 玩家提交當前段答案時呼叫 */
  onSubmitAnswer: (segmentIndex: number, answer: string) => void;
  /** 全部完成後玩家按繼續 */
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function RelayMission({
  config,
  myUserId,
  sessionId,
  memberUserIds,
  currentSegmentIndex,
  completedSegments,
  isAllComplete,
  onSubmitAnswer,
  onComplete,
}: RelayMissionProps) {
  const segments = config.segments ?? [];
  const totalSegments = segments.length;

  // 當前段負責人（依分配規則）
  const currentSegmentOwner = useMemo(() => {
    if (currentSegmentIndex >= totalSegments) return null;
    return pickPlayerForSegment(currentSegmentIndex, memberUserIds, sessionId);
  }, [currentSegmentIndex, memberUserIds, sessionId, totalSegments]);

  const isMyTurn = currentSegmentOwner === myUserId;
  const currentSegment = segments[currentSegmentIndex];

  const [draftAnswer, setDraftAnswer] = useState("");

  const handleContinue = () => {
    onComplete(
      config.rewardPoints ? { points: config.rewardPoints } : undefined,
      config.nextPageId,
    );
  };

  const handleSubmit = () => {
    if (!draftAnswer.trim()) return;
    onSubmitAnswer(currentSegmentIndex, draftAnswer);
    setDraftAnswer("");
  };

  // ════════════════════════════════════════════════════════════════
  // 全部完成
  // ════════════════════════════════════════════════════════════════

  if (isAllComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="relay-mission-all-complete">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <Trophy className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">接力完成！</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {config.successMessage ?? `全隊完成 ${totalSegments} 段任務`}
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleContinue}
              data-testid="btn-relay-continue"
            >
              繼續
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 主畫面：進度條 + 當前段任務
  // ════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="min-h-screen p-4 space-y-4 max-w-md mx-auto"
      data-testid="relay-mission"
      role="region"
      aria-label="多人接力任務"
    >
      {/* 標題 */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">{config.title ?? "接力任務"}</h2>
          </div>
          {config.instruction && (
            <p className="text-sm text-muted-foreground">{config.instruction}</p>
          )}
        </CardContent>
      </Card>

      {/* 進度條：N 段點點 */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-2 text-center">
            第 {currentSegmentIndex + 1} / {totalSegments} 段
          </p>
          <div className="flex gap-2 justify-center" data-testid="relay-progress-dots">
            {segments.map((seg, i) => {
              const done = completedSegments.some((c) => c.segmentIndex === i);
              const current = i === currentSegmentIndex;
              return (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full ${
                    done ? "bg-green-500" : current ? "bg-primary" : "bg-muted"
                  }`}
                  data-testid={`relay-segment-dot-${i}${done ? "-done" : current ? "-current" : ""}`}
                  title={seg.title}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 當前段：依是否輪到自己分流顯示 */}
      {currentSegment && (
        <Card className={isMyTurn ? "border-primary/40 bg-primary/5" : ""}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant={isMyTurn ? "default" : "outline"}>
                {currentSegment.title}
              </Badge>
              {isMyTurn ? (
                <Badge className="text-xs">輪到你了</Badge>
              ) : (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  等待隊友
                </span>
              )}
            </div>

            {isMyTurn ? (
              <>
                <p className="text-base font-medium" data-testid="relay-segment-prompt">
                  {currentSegment.prompt}
                </p>
                {currentSegment.hint && (
                  <p className="text-xs text-muted-foreground">💡 提示：{currentSegment.hint}</p>
                )}
                <Input
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  placeholder="輸入答案"
                  data-testid="relay-segment-input"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit();
                  }}
                />
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={!draftAnswer.trim()}
                  data-testid="btn-relay-submit"
                >
                  提交答案
                </Button>
              </>
            ) : (
              <div className="text-center py-6 space-y-2">
                <LockIcon className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm">
                  等待隊友完成「{currentSegment.title}」
                </p>
                <p className="text-xs text-muted-foreground">
                  💬 用對講機跟負責人對話
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 已完成段列表 */}
      {completedSegments.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">已完成</p>
            {completedSegments.map((c) => (
              <div
                key={c.segmentIndex}
                className="flex items-center gap-2 text-sm"
                data-testid={`relay-completed-${c.segmentIndex}`}
              >
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>{segments[c.segmentIndex]?.title ?? `第 ${c.segmentIndex + 1} 段`}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

/** Helper：判斷玩家輸入答案是否正確（normalize 後比對） */
export function isSegmentAnswerCorrect(input: string, expected: string): boolean {
  return normalizeAnswer(input) === normalizeAnswer(expected);
}
