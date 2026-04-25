// 🏆 統一參戰 Dialog — 按 SQUAD_SYSTEM_DESIGN.md §21.1
//
// 設計原則：
//   - 所有組隊遊戲（team / competitive / relay / battle）共用同一個 Dialog
//   - 沒有「臨時 / 永久」選項（讓使用者完全不用學技術詞彙）
//   - localStorage 記憶上次隊伍 → 80% 預設帶入
//   - 三選項：用我的隊伍 / 建新隊伍 / 用邀請碼加入
//
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Trophy, KeyRound, Plus, ChevronRight } from "lucide-react";

/** 使用者既有的隊伍（用於「用我的隊伍」清單）*/
export interface UserSquad {
  id: string;
  name: string;
  tag?: string;
  totalGames?: number; // 場次榜資料
  isLastUsed?: boolean; // 是否為上次使用的隊伍
}

export interface SquadParticipationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** 使用者既有隊伍清單（從 API 載入） */
  squads?: UserSquad[];

  /** 選擇用某個隊伍時觸發 */
  onUseSquad?: (squadId: string) => void;

  /** 選擇建立新隊伍時觸發（傳入隊名）*/
  onCreateSquad?: (name: string) => void;

  /** 選擇用邀請碼加入時觸發 */
  onJoinByCode?: (code: string) => void;

  /** Loading 狀態（用於按鈕 spinner）*/
  isLoading?: boolean;

  /** 自訂標題（預設「選擇參戰方式」）*/
  title?: string;
}

/** 子畫面狀態 */
type Screen = "main" | "create" | "join";

/**
 * 統一參戰 Dialog — 任何組隊遊戲開始前的入口
 */
export function SquadParticipationDialog({
  open,
  onOpenChange,
  squads = [],
  onUseSquad,
  onCreateSquad,
  onJoinByCode,
  isLoading = false,
  title = "🏆 選擇參戰方式",
}: SquadParticipationDialogProps) {
  const [screen, setScreen] = useState<Screen>("main");
  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const lastUsedSquad = squads.find((s) => s.isLastUsed);
  const otherSquads = squads.filter((s) => !s.isLastUsed);

  const handleClose = (next: boolean) => {
    if (!next) {
      // 關閉時 reset 子畫面
      setScreen("main");
      setNewName("");
      setJoinCode("");
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" data-testid="squad-participation-dialog">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {screen === "main"
              ? "一個隊名打天下，所有戰績自動累積到同一個身分"
              : screen === "create"
                ? "取個好記的隊伍名稱"
                : "輸入朋友分享的邀請碼"}
          </DialogDescription>
        </DialogHeader>

        {screen === "main" && (
          <div className="space-y-3">
            {/* 上次使用的隊伍（最顯眼）*/}
            {lastUsedSquad && (
              <Card
                className="cursor-pointer hover:bg-primary/5 border-primary/40 transition-colors"
                onClick={() => onUseSquad?.(lastUsedSquad.id)}
                data-testid="squad-option-last-used"
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{lastUsedSquad.name}</span>
                      {lastUsedSquad.tag && (
                        <Badge variant="outline" className="text-[10px]">
                          {lastUsedSquad.tag}
                        </Badge>
                      )}
                      <Badge variant="default" className="text-[10px]">
                        上次用
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(lastUsedSquad.totalGames ?? 0) > 0
                        ? `${lastUsedSquad.totalGames} 場戰績累積中`
                        : "新隊伍"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {/* 其他既有隊伍 */}
            {otherSquads.length > 0 && (
              <div className="space-y-2">
                {otherSquads.map((squad) => (
                  <Card
                    key={squad.id}
                    className="cursor-pointer hover:bg-card/80 transition-colors"
                    onClick={() => onUseSquad?.(squad.id)}
                    data-testid={`squad-option-${squad.id}`}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{squad.name}</span>
                          {squad.tag && (
                            <Badge variant="outline" className="text-[10px]">
                              {squad.tag}
                            </Badge>
                          )}
                        </div>
                        {(squad.totalGames ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {squad.totalGames} 場
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 建立新隊伍 */}
            <Card
              className="cursor-pointer hover:bg-card/80 transition-colors border-dashed"
              onClick={() => setScreen("create")}
              data-testid="squad-option-create"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    建新隊伍
                  </p>
                  <p className="text-xs text-muted-foreground">
                    取個隊名，從現在開始累積戰績
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>

            {/* 用邀請碼加入 */}
            <Card
              className="cursor-pointer hover:bg-card/80 transition-colors"
              onClick={() => setScreen("join")}
              data-testid="squad-option-join"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">用邀請碼加入</p>
                  <p className="text-xs text-muted-foreground">
                    輸入朋友給的 6 碼邀請碼
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>
        )}

        {screen === "create" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="squad-name">隊伍名稱</Label>
              <Input
                id="squad-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例如：火焰戰士"
                maxLength={20}
                autoFocus
                data-testid="input-new-squad-name"
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 取個好記的名字，未來所有戰績都會記在這個隊名下
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setScreen("main")}>
                返回
              </Button>
              <Button
                onClick={() => onCreateSquad?.(newName.trim())}
                disabled={isLoading || newName.trim().length < 2}
                data-testid="btn-confirm-create-squad"
              >
                {isLoading ? "建立中..." : "建立隊伍"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {screen === "join" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="invite-code">邀請碼（6 碼英數）</Label>
              <Input
                id="invite-code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="例如：ABC123"
                maxLength={8}
                autoFocus
                className="font-mono uppercase tracking-widest text-center text-lg"
                data-testid="input-invite-code"
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 朋友會在他的隊伍頁分享這個碼給你
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setScreen("main")}>
                返回
              </Button>
              <Button
                onClick={() => onJoinByCode?.(joinCode.trim())}
                disabled={isLoading || joinCode.trim().length < 4}
                data-testid="btn-confirm-join-code"
              >
                {isLoading ? "加入中..." : "加入隊伍"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
