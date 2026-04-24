// 遊戲管理主頁面
import { useState } from "react";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";
import SearchKbdHint from "@/components/shared/SearchKbdHint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Gamepad2, Search, FileText, Globe, Archive, Sparkles } from "lucide-react";
import type { Game } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Map, Smile } from "lucide-react";
import {
  GameFormDialog, QRCodeDialog, CoverUploadDialog, DeleteGameDialog,
  MoveFieldDialog,
} from "@/components/admin-games";
import { GameWizard } from "@/components/game-wizard";
import { useAdminGames } from "./admin-games/useAdminGames";
import { GamesTable } from "./admin-games/GamesTable";

export default function AdminGames() {
  const ctx = useAdminGames();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // 🚚 搬移場域 Dialog state（僅 super_admin 可用）
  const [moveFieldGame, setMoveFieldGame] = useState<Game | null>(null);
  const isSuperAdmin = ctx.admin?.systemRole === "super_admin";
  // 🆕 搜尋框鍵盤 shortcut（只綁 `/` 和 Esc，⌘K 讓給 CommandPalette）
  const { inputRef: searchInputRef, handleEscape } = useSearchShortcut<HTMLInputElement>({ disableCmdK: true });

  // 🆕 C2 + 擴充: 匯入示範遊戲（支援多模板）
  const importDemoMutation = useMutation({
    mutationFn: async (templateKey: string) => {
      const res = await fetch("/api/admin/games/create-from-demo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{
        success: boolean;
        game: Game;
        pagesCreated: number;
        playerUrl: string;
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({
        title: "✅ 示範遊戲已建立",
        description: `${data.game.title} · ${data.pagesCreated} 頁 · ${data.playerUrl}`,
      });
      navigate(`/admin/games/${data.game.id}/edit`);
    },
    onError: (err) => {
      toast({
        title: "匯入失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  if (ctx.authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ctx.isAuthenticated || !ctx.admin) {
    return null;
  }

  return (
    <UnifiedAdminLayout
      title="遊戲管理"
      actions={
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={importDemoMutation.isPending}
                data-testid="btn-import-demo-game"
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {importDemoMutation.isPending ? "匯入中..." : "匯入示範遊戲"}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>選擇示範模板</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => importDemoMutation.mutate("jiachun")}
                data-testid="menu-import-jiachun"
                className="flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Sparkles className="h-4 w-4" />
                  賈村完整示範
                </div>
                <div className="text-xs text-muted-foreground ml-6">
                  8 頁 · OCR + QR + GPS + AR + 文字驗證
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => importDemoMutation.mutate("checkin")}
                data-testid="menu-import-checkin"
                className="flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Map className="h-4 w-4" />
                  賈村打卡之旅
                </div>
                <div className="text-xs text-muted-foreground ml-6">
                  5 頁 · 3 個景點打卡 + 紀念照合成
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => importDemoMutation.mutate("ar-fun")}
                data-testid="menu-import-ar-fun"
                className="flex-col items-start gap-1 py-2"
              >
                <div className="flex items-center gap-2 font-medium">
                  <Smile className="h-4 w-4" />
                  賈村表情秀
                </div>
                <div className="text-xs text-muted-foreground ml-6">
                  6 頁 · AR 面具 + 連拍 GIF + 變裝對比
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => ctx.setIsWizardOpen(true)}
            data-testid="button-create-game"
          >
            <Plus className="h-4 w-4 mr-2" />
            新增遊戲
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        {/* 遊戲列表卡片 */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>遊戲列表</CardTitle>
                <CardDescription>此場域所有已建立的遊戲</CardDescription>
              </div>
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="搜尋遊戲..."
                  value={ctx.searchQuery}
                  onChange={(e) => ctx.setSearchQuery(e.target.value)}
                  onKeyDown={(e) => handleEscape(e, ctx.searchQuery, ctx.setSearchQuery)}
                  className="pl-8 pr-14"
                  data-testid="input-search-games"
                />
                {!ctx.searchQuery && <SearchKbdHint mode="slash" />}
              </div>
            </div>
            <StatusTabs
              statusFilter={ctx.statusFilter}
              onFilterChange={ctx.setStatusFilter}
              counts={ctx.gameCounts}
            />
          </CardHeader>
          <CardContent>
            <GamesTableContent ctx={ctx} onMoveField={isSuperAdmin ? setMoveFieldGame : undefined} />
          </CardContent>
        </Card>

        {/* 對話框群組 */}
        <GameFormDialog
          open={ctx.isDialogOpen}
          onOpenChange={ctx.setIsDialogOpen}
          isEditing={!!ctx.editingGame}
          formData={ctx.formData}
          setFormData={ctx.setFormData}
          onSubmit={ctx.handleSubmit}
          isPending={ctx.createPending || ctx.updatePending}
          onReset={ctx.resetForm}
        />

        <QRCodeDialog
          open={ctx.isQRDialogOpen}
          onOpenChange={ctx.setIsQRDialogOpen}
          game={ctx.selectedGame}
          onGenerate={(id, regenerate) => ctx.onGenerateQR(id, regenerate)}
          isPending={ctx.generateQRPending}
        />

        <CoverUploadDialog
          open={ctx.isCoverDialogOpen}
          onOpenChange={(open) => {
            ctx.setIsCoverDialogOpen(open);
            if (!open) ctx.setCoverUploadGame(null);
          }}
          game={ctx.coverUploadGame}
          onUpload={ctx.uploadCoverImage}
          isUploading={ctx.isUploadingCover}
        />

        <DeleteGameDialog
          open={!!ctx.deleteGame}
          onOpenChange={(open) => !open && ctx.setDeleteGame(null)}
          gameTitle={ctx.deleteGame?.title}
          onConfirm={ctx.onDelete}
          isPending={ctx.deletePending}
        />

        <GameWizard
          open={ctx.isWizardOpen}
          onOpenChange={ctx.setIsWizardOpen}
        />

        {/* 🚚 搬移場域對話框（super_admin only） */}
        {isSuperAdmin && (
          <MoveFieldDialog
            open={!!moveFieldGame}
            onOpenChange={(open) => !open && setMoveFieldGame(null)}
            game={moveFieldGame}
          />
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

// 狀態篩選標籤
function StatusTabs({
  statusFilter, onFilterChange, counts,
}: {
  statusFilter: string;
  onFilterChange: (v: string) => void;
  counts: { all: number; draft: number; published: number; archived: number };
}) {
  return (
    <Tabs value={statusFilter} onValueChange={onFilterChange} className="mt-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
          <Gamepad2 className="h-4 w-4" />
          全部 ({counts.all})
        </TabsTrigger>
        <TabsTrigger value="draft" className="flex items-center gap-2" data-testid="tab-draft">
          <FileText className="h-4 w-4" />
          草稿 ({counts.draft})
        </TabsTrigger>
        <TabsTrigger value="published" className="flex items-center gap-2" data-testid="tab-published">
          <Globe className="h-4 w-4" />
          已發布 ({counts.published})
        </TabsTrigger>
        <TabsTrigger value="archived" className="flex items-center gap-2" data-testid="tab-archived">
          <Archive className="h-4 w-4" />
          已封存 ({counts.archived})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// 表格內容（含載入/空狀態）
function GamesTableContent({
  ctx,
  onMoveField,
}: {
  ctx: ReturnType<typeof useAdminGames>;
  onMoveField?: (game: Game) => void;
}) {
  if (ctx.gamesLoading) {
    return <ListSkeleton count={5} />;
  }

  if (ctx.filteredGames.length === 0) {
    const isEmpty = ctx.games.length === 0;
    return (
      <EmptyState
        icon={Gamepad2}
        title={isEmpty ? "尚無遊戲" : "沒有符合條件的遊戲"}
        description={
          isEmpty
            ? "使用遊戲精靈快速建立，或從模板庫挑一個起手"
            : "試著清除搜尋條件或切換狀態篩選"
        }
        actions={
          isEmpty
            ? [{ label: "開啟新增遊戲精靈", onClick: () => ctx.setIsWizardOpen(true) }]
            : [{
                label: "清除所有篩選",
                variant: "outline",
                onClick: () => {
                  ctx.setSearchQuery("");
                  ctx.setStatusFilter("all");
                },
              }]
        }
      />
    );
  }

  return (
    <GamesTable
      games={ctx.filteredGames}
      onNavigate={ctx.navigate}
      onEdit={ctx.handleEdit}
      onDelete={ctx.setDeleteGame}
      onPublish={ctx.onPublish}
      onGenerateQR={(id) => ctx.onGenerateQR(id)}
      onViewQR={(game) => {
        ctx.setSelectedGame(game);
        ctx.setIsQRDialogOpen(true);
      }}
      onCoverUpload={(game) => {
        ctx.setCoverUploadGame(game);
        ctx.setIsCoverDialogOpen(true);
      }}
      onMoveField={onMoveField}
      publishPending={ctx.publishPending}
      generateQRPending={ctx.generateQRPending}
    />
  );
}
