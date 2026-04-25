// 玩家進入新場域時的歡迎隊伍 Dialog — Phase 12.3
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §14
//
// 觸發條件：
//   1. 已登入玩家
//   2. 第一次進入此場域（localStorage 沒記錄）
//   3. 或上次顯示已超過 30 天
//
// 會顯示：場域 admin 設定的歡迎隊伍清單（top N）
//
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Trophy, Sparkles, Users } from "lucide-react";

interface WelcomeSquad {
  squadId: string;
  squadName: string;
  squadTag: string | null;
  logoUrl: string | null;
  totalGames: number;
  recruitsCount: number;
  fieldsPlayed: number;
  winRate: number;
  isManual: boolean;
}

interface Props {
  fieldId: string;
  fieldName: string;
  userId: string;
  enabled?: boolean;
}

const STORAGE_KEY_PREFIX = "welcome_squads_seen_";
const SEEN_TTL_MS = 30 * 86400 * 1000; // 30 天

function shouldShow(fieldId: string, userId: string): boolean {
  try {
    const key = `${STORAGE_KEY_PREFIX}${fieldId}_${userId}`;
    const raw = localStorage.getItem(key);
    if (!raw) return true;
    const seenAt = parseInt(raw, 10);
    if (Number.isNaN(seenAt)) return true;
    return Date.now() - seenAt > SEEN_TTL_MS;
  } catch {
    return true;
  }
}

function markSeen(fieldId: string, userId: string) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${fieldId}_${userId}`;
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* ignore quota errors */
  }
}

export default function WelcomeSquadsDialog({
  fieldId,
  fieldName,
  userId,
  enabled = true,
}: Props) {
  const [open, setOpen] = useState(false);

  // 檢查是否該顯示
  useEffect(() => {
    if (!enabled || !fieldId || !userId) return;
    if (shouldShow(fieldId, userId)) {
      // 延遲 1 秒避免一進場域就跳（讓使用者先看到場域內容）
      const t = setTimeout(() => setOpen(true), 1000);
      return () => clearTimeout(t);
    }
  }, [fieldId, userId, enabled]);

  // 取歡迎隊伍清單
  const { data, isLoading } = useQuery<{ squads: WelcomeSquad[] }>({
    queryKey: ["/api/fields", fieldId, "welcome-squads"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/fields/${fieldId}/welcome-squads`,
      );
      return res.json();
    },
    enabled: open && !!fieldId,
    staleTime: 60_000,
  });

  // 沒有歡迎隊伍 → 不開
  useEffect(() => {
    if (open && data && data.squads.length === 0) {
      setOpen(false);
      markSeen(fieldId, userId);
    }
  }, [open, data, fieldId, userId]);

  function handleClose() {
    markSeen(fieldId, userId);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-amber-500" />
            歡迎來到 {fieldName}！
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground mb-3">
            在地推薦的隊伍，加入有雙向獎勵
          </p>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              載入中...
            </div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {(data?.squads ?? []).map((s) => (
                <SquadCard
                  key={s.squadId}
                  squad={s}
                  onClick={() => handleClose()}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="w-full">
            稍後再看
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SquadCard({
  squad,
  onClick,
}: {
  squad: WelcomeSquad;
  onClick: () => void;
}) {
  return (
    <Link
      href={`/squad/${squad.squadId}`}
      onClick={onClick}
      className="block border rounded-lg p-3 hover:bg-muted/50 transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl shrink-0">
          {squad.logoUrl ? (
            <img
              src={squad.logoUrl}
              alt={squad.squadName}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            "🛡️"
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-medium truncate">{squad.squadName}</span>
            {squad.isManual && (
              <Badge className="bg-amber-500 text-white text-[10px] gap-0.5">
                <Crown className="w-2.5 h-2.5" />
                推薦
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <Trophy className="w-3 h-3" />
              {squad.totalGames} 場
            </span>
            <span>勝率 {squad.winRate}%</span>
            <span className="flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {squad.recruitsCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
