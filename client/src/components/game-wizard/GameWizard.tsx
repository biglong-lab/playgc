// 遊戲建立精靈主元件
import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import StepSelectTemplate from "./StepSelectTemplate";
import StepGameInfo from "./StepGameInfo";
import StepComplete from "./StepComplete";
import type { GameTemplate } from "./templates";
import type { Game } from "@shared/schema";

type WizardStep = "select_game_mode" | "select_template" | "game_info" | "complete";

type SelectableGameMode = "individual" | "team";

interface GameWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 🆕 軟分流階段 1：當前 wizard 屬「建立遊戲」還是「建立活動」
   * 'game'     → 路線 I（玩家手機闖關、要登入）
   * 'activity' → 路線 II/III（活動現場、玩家匿名）
   * 預設 'game'（向後相容、舊入口都走遊戲）
   */
  editorMode?: "game" | "activity";
}

export default function GameWizard({ open, onOpenChange, editorMode = "game" }: GameWizardProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // 🆕 軟分流階段 1.5：editorMode='game' 從 select_game_mode 開始；'activity' 直接跳 select_template
  const initialStep: WizardStep = editorMode === "game" ? "select_game_mode" : "select_template";
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [selectedGameMode, setSelectedGameMode] = useState<SelectableGameMode>("individual");
  const [selectedTemplate, setSelectedTemplate] = useState<GameTemplate | null>(null);
  const [gameName, setGameName] = useState("");
  const [createdGame, setCreatedGame] = useState<Game | null>(null);

  // 建立遊戲 mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      templateId: string;
      difficulty: string;
      estimatedTime: number | null;
      maxPlayers: number;
      editorMode: "game" | "activity";
      gameMode: SelectableGameMode;
    }) => {
      const response = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "建立失敗");
      }
      return response.json();
    },
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      setCreatedGame(game);
      setStep("complete");
      toast({ title: "遊戲已建立" });
    },
    onError: (error: Error) => {
      toast({
        title: "建立失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 重置精靈狀態
  const resetWizard = () => {
    setStep(initialStep);
    setSelectedGameMode("individual");
    setSelectedTemplate(null);
    setGameName("");
    setCreatedGame(null);
  };

  // 🆕 選擇 game mode（個人 / 多人）→ 推進到 select_template
  const handleSelectGameMode = (mode: SelectableGameMode) => {
    setSelectedGameMode(mode);
    setStep("select_template");
  };

  // 關閉精靈
  const handleClose = () => {
    onOpenChange(false);
    // 延遲重置狀態，避免關閉動畫時看到內容變化
    setTimeout(resetWizard, 200);
  };

  // 選擇模板
  const handleSelectTemplate = (template: GameTemplate) => {
    setSelectedTemplate(template);
    setStep("game_info");
  };

  // 返回上一步
  const handleBack = () => {
    setStep("select_template");
  };

  // 🆕 從 select_template 退回 select_game_mode（只 game editorMode 有此步驟）
  const handleBackToGameMode = () => {
    setStep("select_game_mode");
  };

  // 提交建立
  const handleSubmit = () => {
    if (!selectedTemplate || !gameName.trim()) return;

    createMutation.mutate({
      title: gameName.trim(),
      templateId: selectedTemplate.id,
      difficulty: selectedTemplate.difficulty,
      estimatedTime: selectedTemplate.estimatedTime,
      maxPlayers: selectedTemplate.maxPlayers,
      editorMode,
      gameMode: selectedGameMode,
    });
  };

  // 前往遊戲列表
  const handleGoToList = () => {
    handleClose();
  };

  // 前往編輯器
  const handleGoToEditor = () => {
    if (createdGame) {
      handleClose();
      navigate(`/admin/games/${createdGame.id}`);
    }
  };

  // 測試遊戲
  const handleTestGame = () => {
    if (createdGame?.publicSlug) {
      window.open(`/play/${createdGame.publicSlug}`, "_blank");
    } else {
      toast({
        title: "尚無公開連結",
        description: "請先產生 QR Code 後再測試",
        variant: "destructive",
      });
    }
  };

  // 步驟指示器（依 editorMode 決定是否含 select_game_mode）
  const steps = editorMode === "game"
    ? [
        { key: "select_game_mode", label: "個人 / 多人" },
        { key: "select_template", label: "選擇模板" },
        { key: "game_info", label: "填寫名稱" },
        { key: "complete", label: "完成" },
      ]
    : [
        { key: "select_template", label: "選擇模板" },
        { key: "game_info", label: "填寫名稱" },
        { key: "complete", label: "完成" },
      ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">{editorMode === "activity" ? "🎉" : "🎮"}</span>
            {editorMode === "activity" ? "建立新活動" : "建立新遊戲"}
          </DialogTitle>
          {editorMode === "activity" && (
            <p className="text-xs text-muted-foreground -mt-1">
              路線 II/III：活動現場互動 / 大螢幕（玩家匿名掃 QR）
            </p>
          )}
          {editorMode === "game" && (
            <p className="text-xs text-muted-foreground -mt-1">
              路線 I：玩家手機闖關 / 多人協作（要登入）
            </p>
          )}
        </DialogHeader>

        {/* 步驟指示器 */}
        <div className="flex items-center justify-center gap-2 py-4">
          {steps.map((s, index) => (
            <div key={s.key} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  index < currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : index === currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index < currentStepIndex ? "✓" : index + 1}
              </div>
              <span
                className={cn(
                  "ml-2 text-sm hidden sm:inline",
                  index === currentStepIndex
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-8 h-0.5 mx-2",
                    index < currentStepIndex ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* 步驟內容 */}
        <div className="py-4">
          {step === "select_template" && (
            <StepSelectTemplate
              selectedTemplate={selectedTemplate}
              onSelectTemplate={handleSelectTemplate}
            />
          )}
          {step === "game_info" && selectedTemplate && (
            <StepGameInfo
              template={selectedTemplate}
              gameName={gameName}
              onGameNameChange={setGameName}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isSubmitting={createMutation.isPending}
            />
          )}
          {step === "complete" && createdGame && (
            <StepComplete
              game={createdGame}
              onGoToList={handleGoToList}
              onGoToEditor={handleGoToEditor}
              onTestGame={handleTestGame}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
