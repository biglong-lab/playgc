// 遊戲管理主頁面
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Gamepad2, Search, FileText, Globe, Archive } from "lucide-react";
import {
  GameFormDialog, QRCodeDialog, CoverUploadDialog, DeleteGameDialog,
} from "@/components/admin-games";
import { GameWizard } from "@/components/game-wizard";
import { useAdminGames } from "./admin-games/useAdminGames";
import { GamesTable } from "./admin-games/GamesTable";

export default function AdminGames() {
  const ctx = useAdminGames();

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
    <AdminLayout
      title="遊戲管理"
      actions={
        <Button onClick={() => ctx.setIsWizardOpen(true)} data-testid="button-create-game">
          <Plus className="h-4 w-4 mr-2" />
          新增遊戲
        </Button>
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
                  placeholder="搜尋遊戲..."
                  value={ctx.searchQuery}
                  onChange={(e) => ctx.setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-games"
                />
              </div>
            </div>
            <StatusTabs
              statusFilter={ctx.statusFilter}
              onFilterChange={ctx.setStatusFilter}
              counts={ctx.gameCounts}
            />
          </CardHeader>
          <CardContent>
            <GamesTableContent ctx={ctx} />
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
      </div>
    </AdminLayout>
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
function GamesTableContent({ ctx }: { ctx: ReturnType<typeof useAdminGames> }) {
  if (ctx.gamesLoading) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>;
  }

  if (ctx.filteredGames.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {ctx.games.length === 0
          ? "尚無遊戲，點擊「新增遊戲」開始建立"
          : "沒有符合條件的遊戲"}
      </div>
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
      publishPending={ctx.publishPending}
      generateQRPending={ctx.generateQRPending}
    />
  );
}
