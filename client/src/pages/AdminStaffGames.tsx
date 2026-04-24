// 場域管理員遊戲管理主頁面
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, QrCode, Check, X, Gamepad2, Workflow,
  Settings, Image as ImageIcon, Search, FileText, Globe, Archive,
} from "lucide-react";
import {
  GameFormDialog, QRCodeDialog, CoverUploadDialog, DeleteGameDialog,
  STATUS_LABELS, STATUS_COLORS, DIFFICULTY_LABELS, normalizeStatus,
} from "@/components/admin-games";
import { useAdminStaffGames, type StaffGame } from "./admin-staff-games/useAdminStaffGames";
import { useSearchShortcut } from "@/hooks/useSearchShortcut";

export default function AdminStaffGames() {
  const ctx = useAdminStaffGames();
  // 🆕 搜尋框鍵盤 shortcut
  const { inputRef: searchInputRef, isMac } = useSearchShortcut<HTMLInputElement>();

  return (
    <UnifiedAdminLayout title="遊戲管理">
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">管理您的實境遊戲</p>
          </div>
          <Button onClick={() => ctx.setIsDialogOpen(true)} data-testid="button-create-game">
            <Plus className="h-4 w-4 mr-2" />
            新增遊戲
          </Button>
        </div>

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
            <StatusTabs filter={ctx.statusFilter} onChange={ctx.setStatusFilter} counts={ctx.gameCounts} />
          </CardHeader>
          <CardContent>
            <StaffGamesTableContent ctx={ctx} />
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
          onOpenChange={(open) => { ctx.setIsCoverDialogOpen(open); if (!open) ctx.setCoverUploadGame(null); }}
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
      </div>
    </UnifiedAdminLayout>
  );
}

// 狀態篩選標籤
function StatusTabs({
  filter, onChange, counts,
}: {
  filter: string; onChange: (v: string) => void;
  counts: { all: number; draft: number; published: number; archived: number };
}) {
  return (
    <Tabs value={filter} onValueChange={onChange} className="mt-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
          <Gamepad2 className="h-4 w-4" /> 全部 ({counts.all})
        </TabsTrigger>
        <TabsTrigger value="draft" className="flex items-center gap-2" data-testid="tab-draft">
          <FileText className="h-4 w-4" /> 草稿 ({counts.draft})
        </TabsTrigger>
        <TabsTrigger value="published" className="flex items-center gap-2" data-testid="tab-published">
          <Globe className="h-4 w-4" /> 已發布 ({counts.published})
        </TabsTrigger>
        <TabsTrigger value="archived" className="flex items-center gap-2" data-testid="tab-archived">
          <Archive className="h-4 w-4" /> 已封存 ({counts.archived})
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// 表格內容（含載入/空狀態）- 包含場域欄位
function StaffGamesTableContent({ ctx }: { ctx: ReturnType<typeof useAdminStaffGames> }) {
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
            ? "跨場域的遊戲一覽，點下方新增第一個遊戲"
            : "試著清除搜尋條件或切換狀態篩選"
        }
        actions={
          isEmpty
            ? [{ label: "新增遊戲", onClick: () => ctx.setIsDialogOpen(true) }]
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
    <>
      {/* 手機：Card 版本 */}
      <div className="space-y-3 md:hidden">
        {ctx.filteredGames.map((game) => (
          <StaffGameMobileCard key={game.id} game={game} ctx={ctx} />
        ))}
      </div>

      {/* 桌面：Table 版本 */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>遊戲名稱</TableHead>
              <TableHead>場域</TableHead>
              <TableHead>難度</TableHead>
              <TableHead>狀態</TableHead>
              <TableHead>QR Code</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ctx.filteredGames.map((game) => (
              <StaffGameRow key={game.id} game={game} ctx={ctx} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// 手機版遊戲卡片（md 以下顯示）
function StaffGameMobileCard({ game, ctx }: { game: StaffGame; ctx: ReturnType<typeof useAdminStaffGames> }) {
  const status = normalizeStatus(game.status);

  return (
    <Card data-testid={`card-game-${game.id}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">{game.title}</div>
            {game.description && (
              <div className="text-sm text-muted-foreground line-clamp-2">{game.description}</div>
            )}
          </div>
          <Badge className={STATUS_COLORS[status]} variant="secondary">{STATUS_LABELS[status]}</Badge>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          {game.field && <Badge variant="outline">{game.field.name}</Badge>}
          {game.difficulty && (
            <span className="text-muted-foreground">難度：{DIFFICULTY_LABELS[game.difficulty]}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => ctx.navigate(`/admin/games/${game.id}`)} data-testid={`button-edit-flow-m-${game.id}`}>
            <Workflow className="h-4 w-4 mr-1" /> 流程
          </Button>
          {game.publicSlug ? (
            <Button variant="ghost" size="sm" onClick={() => { ctx.setSelectedGame(game); ctx.setIsQRDialogOpen(true); }} data-testid={`button-view-qr-m-${game.id}`}>
              <QrCode className="h-4 w-4 mr-1" /> QR
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => ctx.onGenerateQR(game.id)} disabled={ctx.generateQRPending} data-testid={`button-generate-qr-m-${game.id}`}>
              <QrCode className="h-4 w-4 mr-1" /> 產生 QR
            </Button>
          )}
          {status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => ctx.onPublish(game.id, "published")} disabled={ctx.publishPending} data-testid={`button-publish-m-${game.id}`}>
              <Check className="h-4 w-4 mr-1" /> 發布
            </Button>
          )}
          {status === "published" && (
            <Button variant="outline" size="sm" onClick={() => ctx.onPublish(game.id, "draft")} disabled={ctx.publishPending} data-testid={`button-unpublish-m-${game.id}`}>
              <X className="h-4 w-4 mr-1" /> 取消
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { ctx.setCoverUploadGame(game); ctx.setIsCoverDialogOpen(true); }} aria-label="上傳封面" data-testid={`button-cover-m-${game.id}`}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => ctx.handleEdit(game)} aria-label="編輯設定" data-testid={`button-edit-m-${game.id}`}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => ctx.setDeleteGame(game)} aria-label="刪除" data-testid={`button-delete-m-${game.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// 單一遊戲行（含場域欄位）
function StaffGameRow({ game, ctx }: { game: StaffGame; ctx: ReturnType<typeof useAdminStaffGames> }) {
  const status = normalizeStatus(game.status);

  return (
    <TableRow data-testid={`row-game-${game.id}`}>
      <TableCell>
        <div>
          <div className="font-medium">{game.title}</div>
          {game.description && (
            <div className="text-sm text-muted-foreground truncate max-w-[200px]">{game.description}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {game.field ? <Badge variant="outline">{game.field.name}</Badge> : <span className="text-muted-foreground">-</span>}
      </TableCell>
      <TableCell>{game.difficulty && DIFFICULTY_LABELS[game.difficulty]}</TableCell>
      <TableCell>
        <Badge className={STATUS_COLORS[status]} variant="secondary">{STATUS_LABELS[status]}</Badge>
      </TableCell>
      <TableCell>
        {game.publicSlug ? (
          <Button variant="ghost" size="sm" onClick={() => { ctx.setSelectedGame(game); ctx.setIsQRDialogOpen(true); }} data-testid={`button-view-qr-${game.id}`}>
            <QrCode className="h-4 w-4 mr-1" /> 檢視
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => ctx.onGenerateQR(game.id)} disabled={ctx.generateQRPending} data-testid={`button-generate-qr-${game.id}`}>
            <QrCode className="h-4 w-4 mr-1" /> 產生
          </Button>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => ctx.navigate(`/admin/games/${game.id}`)} data-testid={`button-edit-flow-${game.id}`}>
            <Workflow className="h-4 w-4 mr-1" /> 編輯流程
          </Button>
          {status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => ctx.onPublish(game.id, "published")} disabled={ctx.publishPending} data-testid={`button-publish-${game.id}`}>
              <Check className="h-4 w-4 mr-1" /> 發布
            </Button>
          )}
          {status === "published" && (
            <Button variant="outline" size="sm" onClick={() => ctx.onPublish(game.id, "draft")} disabled={ctx.publishPending} data-testid={`button-unpublish-${game.id}`}>
              <X className="h-4 w-4 mr-1" /> 取消發布
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { ctx.setCoverUploadGame(game); ctx.setIsCoverDialogOpen(true); }} title="上傳封面圖片" data-testid={`button-cover-${game.id}`}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => ctx.handleEdit(game)} title="編輯基本設定" data-testid={`button-edit-${game.id}`}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => ctx.setDeleteGame(game)} data-testid={`button-delete-${game.id}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
