// 🔐 LockCoop — 協作解鎖元件（純 UI）
//
// 玩法（依 docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.5）：
//   - 一把鎖需 N 位密碼
//   - 每位玩家拿到不同線索（admin 預先設定多組）
//   - 玩家用對講機溝通拼出完整密碼
//   - 任一玩家輸入正確密碼即解鎖（廣播給全員）
//
// 線索分配：用 hash(sessionId + userId) 取模決定拿哪組（避免每次重整變）
// 線索組數 < 玩家數 → 重複分配（同組線索給多人，鼓勵組內溝通）
//
// 角色：純 UI（presentation）— 不接 WebSocket、不打 API
//   容器層 LockCoopPage 用 useTeamLockCoopSync 提供 sharedCode / onCodeChange / onAttempt

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, HelpCircle, KeyRound, Users } from "lucide-react";
import { normalizeAnswer } from "@/lib/gameVerification";
import type { LockCoopConfig } from "@shared/schema";

/**
 * 簡單字串 hash（FNV-1a 32-bit）— 純函式，給定相同 input 永遠回相同 output。
 * 不用 SubtleCrypto 因為這只是 UI 分配用，不需要密碼學等級。
 *
 * @internal export 給測試用
 */
export function fnv1aHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // 轉成正整數
  return hash >>> 0;
}

/**
 * 依 hash(sessionId + userId) 決定該玩家拿哪組線索（多人時穩定分配 + 公平打散）
 *
 * @param userId 玩家 ID
 * @param sessionId 遊戲 session ID
 * @param totalClues admin 設定的線索組數
 * @returns 線索 index（0..totalClues-1）
 *
 * @internal export 給測試用
 */
export function pickClueIndexForUser(
  userId: string,
  sessionId: string,
  totalClues: number,
): number {
  if (totalClues <= 0) return 0;
  const hash = fnv1aHash(`${sessionId}:${userId}`);
  return hash % totalClues;
}

export interface LockCoopProps {
  config: LockCoopConfig;
  myUserId: string;
  sessionId: string;
  /** 隊員清單（含自己） — 顯示「N 位隊員協作中」用 */
  memberCount: number;
  /** 隊伍共享的密碼輸入（任一人輸入即同步） */
  sharedCode: string;
  /** 當前嘗試次數（隊伍共用） */
  attempts: number;
  /** 是否已解鎖（成功狀態） */
  isUnlocked: boolean;
  /** 是否已失敗（達到 maxAttempts） */
  isFailed: boolean;
  /** 玩家修改密碼輸入時呼叫（hook 同步給其他人） */
  onCodeChange: (code: string) => void;
  /** 玩家按「嘗試解鎖」時呼叫（hook 驗證 + 廣播） */
  onAttempt: () => void;
  /** 解鎖成功後玩家按「繼續」時呼叫 */
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function LockCoop({
  config,
  myUserId,
  sessionId,
  memberCount,
  sharedCode,
  attempts,
  isUnlocked,
  isFailed,
  onCodeChange,
  onAttempt,
  onComplete,
}: LockCoopProps) {
  const digits = config.digits;
  const maxAttempts = config.maxAttempts ?? 5;
  const remainingAttempts = Math.max(0, maxAttempts - attempts);
  const totalClues = config.clues?.length ?? 0;

  // 我的線索 — 純函式分配，重整不變
  const myClue = useMemo(() => {
    if (totalClues === 0) return null;
    const idx = pickClueIndexForUser(myUserId, sessionId, totalClues);
    return config.clues[idx];
  }, [myUserId, sessionId, config.clues, totalClues]);

  // 共享 code 不足 digits 時補空白格顯示用
  const codeChars: string[] = useMemo(() => {
    const chars = sharedCode.split("");
    while (chars.length < digits) chars.push("");
    return chars.slice(0, digits);
  }, [sharedCode, digits]);

  const isComplete = sharedCode.length === digits;

  const handleContinue = () => {
    onComplete(
      config.rewardPoints ? { points: config.rewardPoints } : undefined,
      config.nextPageId,
    );
  };

  // ════════════════════════════════════════════════════════════════
  // 成功 / 失敗狀態
  // ════════════════════════════════════════════════════════════════

  if (isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="lock-coop-unlocked">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
              <Unlock className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">解鎖成功！</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {config.successMessage ?? "全隊合作破解密碼，繼續下一關"}
              </p>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleContinue}
              data-testid="btn-lock-coop-continue"
            >
              繼續
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" data-testid="lock-coop-failed">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-destructive/20 flex items-center justify-center">
              <Lock className="w-10 h-10 text-destructive" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">挑戰失敗</h2>
              <p className="text-sm text-muted-foreground mt-2">
                {config.failureMessage ?? `已嘗試 ${maxAttempts} 次，鎖永久關閉`}
              </p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => handleContinue()}
              data-testid="btn-lock-coop-skip"
            >
              繼續（跳過）
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // 主畫面：線索 + 共享輸入區
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen p-4 space-y-4 max-w-md mx-auto" data-testid="lock-coop">
      {/* 標題 */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">{config.title ?? "協作解鎖"}</h2>
          </div>
          {config.instruction && (
            <p className="text-sm text-muted-foreground">{config.instruction}</p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{memberCount} 位隊員協作中</span>
            <span className="ml-auto">剩 {remainingAttempts} 次嘗試</span>
          </div>
        </CardContent>
      </Card>

      {/* 我的線索（只給自己看） */}
      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <HelpCircle className="w-4 h-4" />
            <span className="font-medium text-sm">你拿到的線索</span>
          </div>
          {myClue ? (
            <>
              {myClue.label && (
                <Badge variant="outline" className="text-xs">
                  {myClue.label}
                </Badge>
              )}
              <p className="text-base font-medium" data-testid="my-clue-text">
                {myClue.text}
              </p>
              <p className="text-xs text-muted-foreground">
                💬 用對講機跟隊友分享你的線索，一起拼出密碼
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">尚未取得線索</p>
          )}
        </CardContent>
      </Card>

      {/* 共享密碼輸入區 */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">隊伍共享密碼輸入（{digits} 位）</p>
            <div className="flex gap-2 justify-center" data-testid="lock-coop-code-display">
              {codeChars.map((char, i) => (
                <div
                  key={i}
                  className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center font-mono text-xl font-bold ${
                    char ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/50"
                  }`}
                  data-testid={`lock-coop-digit-${i}`}
                >
                  {char || "_"}
                </div>
              ))}
            </div>
          </div>

          {/* 文字輸入 fallback（手機鍵盤友善） */}
          <div className="space-y-2">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={digits}
              value={sharedCode}
              onChange={(e) => onCodeChange(normalizeAnswer(e.target.value))}
              placeholder={`輸入 ${digits} 位密碼`}
              className="w-full px-3 py-2 rounded-lg border bg-background text-center font-mono text-lg tracking-widest"
              data-testid="lock-coop-input"
              aria-label="密碼輸入"
            />
            <p className="text-xs text-muted-foreground text-center">
              💡 任一隊員輸入都會即時同步給全隊
            </p>
          </div>

          {/* 嘗試解鎖 */}
          <Button
            className="w-full gap-2"
            size="lg"
            disabled={!isComplete}
            onClick={onAttempt}
            data-testid="btn-lock-coop-attempt"
          >
            <Lock className="w-4 h-4" />
            嘗試解鎖
          </Button>
        </CardContent>
      </Card>

      {/* 提示（admin 設定才顯示） */}
      {config.hint && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">
              <HelpCircle className="inline w-3 h-3 mr-1" />
              提示：{config.hint}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
