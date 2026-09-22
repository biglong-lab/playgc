// 🏁 賽事大廳：等待開賽（邀請碼 / 參賽者 / 開賽條件 / 退出），2026-09-23 P1
import { useState } from "react";
import { Check, Clock, Copy, Crown, Loader2, LogOut, Play, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { MatchDetail } from "@/lib/match-types";
import { matchStartBlocker } from "@shared/lib/match-rules";

interface WaitingViewProps {
  readonly match: MatchDetail;
  readonly isCreator: boolean;
  readonly userId?: string;
  readonly inviteUrl: string;
  readonly onStart: () => void;
  readonly isStarting: boolean;
  readonly onLeave: () => void;
  readonly isLeaving: boolean;
}

/** 開賽條件（跟伺服器同一套規則 shared/lib/match-rules；伺服器仍會再擋一次） */
export function startBlocker(match: MatchDetail): string | null {
  return matchStartBlocker({
    matchMode: match.matchMode,
    participantCount: match.ranking.length,
    minParticipants: match.minParticipants,
    relayLegCount: match.relayLegs.length,
  });
}

function ruleSummary(match: MatchDetail): string {
  const time = match.timeLimitSeconds ? `限時 ${Math.round(match.timeLimitSeconds / 60)} 分鐘` : "不限時";
  if (match.matchMode === "relay") {
    const legs = match.relayLegs.map((l) => `第 ${l.segment} 棒：第 ${l.fromPage}–${l.toPage} 頁`).join("、");
    return `${time}｜依加入順序分棒（${legs}）`;
  }
  return `${time}｜全員完成或時間到自動結算`;
}

export function WaitingView(props: WaitingViewProps) {
  const { match, isCreator, userId, onStart, isStarting } = props;
  const blocker = startBlocker(match);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            等待開賽
          </CardTitle>
          <p className="text-xs text-muted-foreground">{ruleSummary(match)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteBlock accessCode={match.accessCode ?? ""} inviteUrl={props.inviteUrl} />
          <ParticipantList match={match} userId={userId} />
          {isCreator ? (
            <div className="space-y-1">
              <Button className="w-full" size="lg" onClick={onStart} disabled={isStarting || !!blocker} data-testid="button-start-match">
                {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                開始賽事（{match.ranking.length} 人）
              </Button>
              {blocker && <p className="text-xs text-center text-muted-foreground">{blocker}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">等待房主開始賽事…</p>
          )}
          <LeaveButton isCreator={isCreator} onLeave={props.onLeave} isLeaving={props.isLeaving} />
        </CardContent>
      </Card>
    </div>
  );
}

function InviteBlock({ accessCode, inviteUrl }: { accessCode: string; inviteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const flash = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash();
    } catch { /* 不支援剪貼簿就算了，畫面上看得到代碼 */ }
  };
  const share = async () => {
    const text = `加入我的賽事！邀請碼：${accessCode}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "加入賽事", text, url: inviteUrl });
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    await copy(`${text}\n${inviteUrl}`);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground text-center">邀請碼</p>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-lg p-4 text-center">
          <span className="text-3xl font-mono font-bold text-primary tracking-[0.2em]" data-testid="text-match-code">
            {accessCode || "------"}
          </span>
        </div>
        <Button variant="outline" size="icon" onClick={() => void copy(accessCode)} title="複製邀請碼" data-testid="button-copy-match-code">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button variant="outline" size="icon" onClick={() => void share()} title="分享邀請連結" data-testid="button-share-match-code">
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center">朋友點分享連結會直接加入這場</p>
    </div>
  );
}

function ParticipantList({ match, userId }: { match: MatchDetail; userId?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium flex items-center gap-1">
          <Users className="h-4 w-4" /> 參賽者
        </span>
        <Badge variant="secondary" className="text-xs">{match.ranking.length}/{match.maxParticipants} 人</Badge>
      </div>
      <div className="space-y-1">
        {match.ranking.map((p) => (
          <div
            key={p.participantId}
            className={`flex items-center gap-2 px-3 py-2 rounded text-sm ${
              p.userId === userId ? "bg-primary/10 border border-primary/30" : "bg-card"
            }`}
          >
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{p.displayName}</span>
            {p.userId === userId && <Badge variant="outline" className="text-[10px]">我</Badge>}
            {p.userId === match.creatorId && <Crown className="h-3.5 w-3.5 text-yellow-500" aria-label="房主" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 退出（房主 = 取消整場 → 先確認） */
function LeaveButton({ isCreator, onLeave, isLeaving }: { isCreator: boolean; onLeave: () => void; isLeaving: boolean }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full gap-2 text-muted-foreground"
        onClick={() => (isCreator ? setConfirming(true) : onLeave())}
        disabled={isLeaving}
        data-testid="button-leave-match"
      >
        <LogOut className="h-4 w-4" />
        {isCreator ? "取消這場賽事" : "退出賽事"}
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定取消這場賽事？</AlertDialogTitle>
            <AlertDialogDescription>你是房主，取消後所有已加入的人都會回到賽事列表。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>先不要</AlertDialogCancel>
            <AlertDialogAction onClick={onLeave} data-testid="button-confirm-cancel-match">取消賽事</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
