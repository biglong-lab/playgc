// 步驟 3：完成
import { CheckCircle, Play, Pencil, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Game } from "@shared/schema";

interface StepCompleteProps {
  game: Game;
  onGoToList: () => void;
  onGoToEditor: () => void;
  onTestGame: () => void;
}

export default function StepComplete({
  game,
  onGoToList,
  onGoToEditor,
  onTestGame,
}: StepCompleteProps) {
  return (
    <div className="space-y-6 text-center">
      {/* 成功圖示 */}
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
      </div>

      {/* 標題 */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          遊戲建立成功！
        </h2>
        <p className="text-muted-foreground">
          「{game.title}」已經準備好了
        </p>
      </div>

      {/* 下一步選項 */}
      <div className="space-y-3 p-4 rounded-lg border border-border bg-card max-w-sm mx-auto">
        <p className="text-sm font-medium text-foreground mb-4">
          接下來你可以...
        </p>

        <button
          type="button"
          onClick={onTestGame}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          data-testid="button-test-game"
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="font-medium text-foreground">立即測試</div>
            <div className="text-sm text-muted-foreground">用玩家視角體驗遊戲</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToEditor}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          data-testid="button-edit-game"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Pencil className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <div className="font-medium text-foreground">編輯內容</div>
            <div className="text-sm text-muted-foreground">修改文字、新增關卡</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoToList}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
          data-testid="button-go-to-list"
        >
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Rocket className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="font-medium text-foreground">發布遊戲</div>
            <div className="text-sm text-muted-foreground">讓玩家可以開始玩</div>
          </div>
        </button>
      </div>

      {/* 底部按鈕 */}
      <div className="flex justify-center gap-4 pt-4">
        <Button variant="outline" onClick={onGoToList} data-testid="button-back-to-list">
          返回列表
        </Button>
        <Button onClick={onGoToEditor} data-testid="button-enter-editor">
          進入編輯器 →
        </Button>
      </div>
    </div>
  );
}
