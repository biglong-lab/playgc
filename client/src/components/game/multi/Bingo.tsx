// 🎱 Bingo — 多人賓果（純 UI 元件）
// 所有玩家共用同一張賓果格，一起標記達成目標
// 適用：破冰、團隊活動、婚禮、班級遊戲

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface BingoConfig {
  title?: string;
  subtitle?: string;
  items: string[];
  gridSize?: 2 | 3 | 4 | 5;
  winCondition?: "line" | "full";
  celebrationText?: string;
}

export interface BingoState {
  markedItems: string[];
  isWon: boolean;
}

interface BingoProps {
  config: BingoConfig;
  state: BingoState;
  myUserName: string;
  onMark: (item: string) => Promise<void>;
}

function checkWin(items: string[], marked: string[], gridSize: number, condition: "line" | "full"): boolean {
  if (condition === "full") return items.every((it) => marked.includes(it));

  const size = gridSize;
  const grid = items.slice(0, size * size);
  const markedSet = new Set(marked);

  // 橫向
  for (let r = 0; r < size; r++) {
    if (grid.slice(r * size, r * size + size).every((it) => markedSet.has(it))) return true;
  }
  // 直向
  for (let c = 0; c < size; c++) {
    let ok = true;
    for (let r = 0; r < size; r++) {
      if (!markedSet.has(grid[r * size + c])) { ok = false; break; }
    }
    if (ok) return true;
  }
  // 對角
  const diag1 = Array.from({ length: size }, (_, i) => grid[i * size + i]);
  const diag2 = Array.from({ length: size }, (_, i) => grid[i * size + (size - 1 - i)]);
  if (diag1.every((it) => markedSet.has(it))) return true;
  if (diag2.every((it) => markedSet.has(it))) return true;

  return false;
}

export default function Bingo({ config, state, onMark }: BingoProps) {
  const gridSize = config.gridSize ?? 3;
  const items = config.items.slice(0, gridSize * gridSize);
  const markedSet = new Set(state.markedItems);
  const condition = config.winCondition ?? "line";

  const hasWon = state.isWon || checkWin(items, state.markedItems, gridSize, condition);
  const markedCount = state.markedItems.filter((it) => items.includes(it)).length;

  const handleMark = (item: string) => {
    if (hasWon) return;
    if (markedSet.has(item)) return;
    void onMark(item);
  };

  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  }[gridSize];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{config.title ?? "🎱 賓果"}</CardTitle>
            <Badge variant="outline">
              {markedCount}/{items.length}
            </Badge>
          </div>
          {config.subtitle && (
            <p className="text-sm text-muted-foreground">{config.subtitle}</p>
          )}
        </CardHeader>
        <CardContent>
          {hasWon ? (
            <div className="text-center py-6 space-y-2">
              <div className="text-4xl">🎉</div>
              <p className="text-lg font-bold text-green-600">BINGO！</p>
              <p className="text-sm text-muted-foreground">
                {config.celebrationText ?? "恭喜達成賓果！"}
              </p>
            </div>
          ) : (
            <div className={cn("grid gap-2", gridCols)}>
              {items.map((item) => {
                const isMarked = markedSet.has(item);
                return (
                  <button
                    key={item}
                    onClick={() => handleMark(item)}
                    disabled={isMarked}
                    className={cn(
                      "aspect-square rounded-lg border-2 text-xs font-medium p-1 transition-all",
                      "flex items-center justify-center text-center leading-tight",
                      isMarked
                        ? "bg-green-500 border-green-500 text-white scale-95 cursor-default"
                        : "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer",
                    )}
                  >
                    {isMarked ? "✓" : item}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 已標記清單 */}
      {state.markedItems.length > 0 && !hasWon && (
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground mb-2">已標記：</p>
            <div className="flex flex-wrap gap-1">
              {state.markedItems.map((it) => (
                <Badge key={it} variant="secondary" className="text-xs">
                  {it}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
