// 🏁 賽事大廳：瀏覽 / 建立 / 邀請碼加入（2026-09-23 P1）
import { useState } from "react";
import { ArrowLeft, Loader2, Swords, Users, KeyRound, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { resolveMatchConfig, type Game, type GameMatchConfig } from "@shared/schema";
import type { WaitingMatchSummary } from "@/lib/match-types";

interface BrowseMatchesViewProps {
  readonly game: Game | undefined;
  readonly matches: readonly WaitingMatchSummary[];
  readonly onCreateMatch: () => void;
  readonly onJoinMatch: (matchId: string) => void;
  readonly onJoinByCode: (code: string) => void;
  readonly onGoBack: () => void;
  readonly isCreating: boolean;
  readonly isJoining: boolean;
}

/** 模式說明 + 接力沒設定分段的防呆 */
function modeInfo(game: Game | undefined) {
  const isRelay = game?.gameMode === "relay";
  const cfg = resolveMatchConfig(game?.matchConfig as GameMatchConfig | null | undefined);
  const legs = cfg.relaySegments.length;
  return {
    isRelay,
    label: isRelay ? "接力模式" : "競賽模式",
    rule: isRelay
      ? `一隊 ${legs || "?"} 人輪流，每人負責一段，完成自動交棒`
      : `大家各玩一次，比${cfg.timeLimitMinutes > 0 ? `誰在 ${cfg.timeLimitMinutes} 分鐘內` : "誰"}成績最好`,
    blocked: isRelay && legs === 0,
  };
}

export function BrowseMatchesView(props: BrowseMatchesViewProps) {
  const { game, matches, onCreateMatch, onJoinMatch, onGoBack, isCreating, isJoining } = props;
  const info = modeInfo(game);

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onGoBack} aria-label="返回大廳">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{game?.title ?? "對戰大廳"}</h1>
          <p className="text-sm text-muted-foreground">{info.label}：{info.rule}</p>
        </div>
      </div>

      {info.blocked && (
        <Card className="mb-4 border-destructive/40">
          <CardContent className="pt-6 flex gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            這個接力遊戲還沒設定每一棒的頁數，暫時不能開賽，請洽場域工作人員。
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="pt-6 space-y-2">
          <Button className="w-full" onClick={onCreateMatch} disabled={isCreating || info.blocked} data-testid="button-create-match">
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Swords className="h-4 w-4 mr-2" />}
            建立新賽事
          </Button>
          <p className="text-xs text-muted-foreground text-center">建立後把邀請碼或連結分享給朋友</p>
        </CardContent>
      </Card>

      <JoinByCodeCard onJoinByCode={props.onJoinByCode} isJoining={isJoining} />

      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" />
        等待中的賽事 ({matches.length})
      </h2>
      {matches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">目前沒有等待中的賽事，建立一個吧！</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <Card key={m.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{m.accessCode}</Badge>
                  <span className="text-sm text-muted-foreground">{m.participantCount}/{m.maxTeams ?? "?"} 人</span>
                </div>
                <Button size="sm" onClick={() => onJoinMatch(m.id)} disabled={isJoining} data-testid={`button-join-match-${m.id}`}>
                  {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : "加入"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function JoinByCodeCard({ onJoinByCode, isJoining }: { onJoinByCode: (code: string) => void; isJoining: boolean }) {
  const [code, setCode] = useState("");
  const clean = code.trim().toUpperCase();
  const canJoin = clean.length >= 4 && !isJoining;
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) onJoinByCode(clean);
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.slice(0, 8))}
            placeholder="輸入朋友給的邀請碼"
            className="font-mono uppercase"
            aria-label="邀請碼"
            data-testid="input-match-code"
          />
          <Button type="submit" variant="outline" disabled={!canJoin} className="gap-1 shrink-0" data-testid="button-join-by-code">
            <KeyRound className="h-4 w-4" />
            加入
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
