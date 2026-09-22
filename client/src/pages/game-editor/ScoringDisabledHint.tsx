// 🎯 編輯器提示：遊戲已關閉計分時，分數欄位不會生效（2026-09-22）
// 欄位保留不隱藏：之後重新開啟計分時，原本設定的分數仍在。
// 讀編輯器已載入的遊戲快取（["/api/games", gameId]），不額外打 API。
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import type { Game } from "@shared/schema";
import { isScoringEnabled } from "@shared/lib/scoring";

export default function ScoringDisabledHint({ gameId }: { gameId?: string }) {
  const params = useParams<{ gameId?: string }>();
  const id = gameId || params.gameId;
  const { data: game } = useQuery<Game>({ queryKey: ["/api/games", id], enabled: !!id });
  if (!game || isScoringEnabled(game)) return null;
  return (
    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1" data-testid="hint-scoring-disabled">
      此遊戲已在「遊戲設定」關閉計分，這裡的分數不會生效（道具獎勵照常）。
    </p>
  );
}
