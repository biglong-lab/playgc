// 場域管理員遊戲管理主頁面
import AdminStaffLayout from "@/components/AdminStaffLayout";
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

export default function AdminStaffGames() {
  const ctx = useAdminStaffGames();

  return (
    <AdminStaffLayout>
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Gamepad2 className="h-6 w-6" />
              遊戲管理
            </h1>
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
    </AdminStaffLayout>
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
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>;
  }

  if (ctx.filteredGames.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {ctx.games.length === 0 ? "尚無遊戲，點擊「新增遊戲」開始建立" : "沒有符合條件的遊戲"}
      </div>
    );
  }

  return (
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
          <Button variant="outline" size="sm" onClick={() => ctx.navigate(`/admin-staff/games/${game.id}`)} data-testid={`button-edit-flow-${game.id}`}>
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
