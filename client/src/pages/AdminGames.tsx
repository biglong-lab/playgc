import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  QrCode,
  Check,
  X,
  Gamepad2,
  Workflow,
  Settings,
  Image as ImageIcon,
  Search,
  FileText,
  Globe,
  Archive
} from "lucide-react";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import type { Game } from "@shared/schema";
import {
  GameFormDialog,
  QRCodeDialog,
  CoverUploadDialog,
  DeleteGameDialog,
  STATUS_LABELS,
  STATUS_COLORS,
  DIFFICULTY_LABELS,
  normalizeStatus,
  DEFAULT_FORM_DATA,
  type GameFormData,
} from "@/components/admin-games";
import { GameWizard } from "@/components/game-wizard";

export default function AdminGames() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { admin, isLoading: authLoading, isAuthenticated } = useRequireAdminAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [deleteGame, setDeleteGame] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [coverUploadGame, setCoverUploadGame] = useState<Game | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [formData, setFormData] = useState<GameFormData>(DEFAULT_FORM_DATA);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  const filteredGames = games.filter((game) => {
    const gameStatus = normalizeStatus(game.status);
    const matchesStatus = statusFilter === "all" || gameStatus === statusFilter;
    const matchesSearch = !searchQuery ||
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const gameCounts = {
    all: games.length,
    draft: games.filter(g => normalizeStatus(g.status) === "draft").length,
    published: games.filter(g => normalizeStatus(g.status) === "published").length,
    archived: games.filter(g => normalizeStatus(g.status) === "archived").length,
  };

  const createMutation = useMutation({
    mutationFn: async (data: GameFormData) => {
      const response = await fetch("/api/admin/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          difficulty: data.difficulty,
          estimatedTime: data.estimatedTime ? parseInt(data.estimatedTime) : null,
          maxPlayers: data.maxPlayers ? parseInt(data.maxPlayers) : 6,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "建立失敗");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲已建立" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "建立失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Game> }) => {
      const response = await fetch(`/api/admin/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "更新失敗");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲已更新" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/games/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "刪除失敗");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲已刪除" });
      setDeleteGame(null);
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/admin/games/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "更新失敗");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲狀態已更新" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const generateQRMutation = useMutation({
    mutationFn: async ({ id, regenerateSlug }: { id: string; regenerateSlug?: boolean }) => {
      const response = await fetch(`/api/admin/games/${id}/qrcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ regenerateSlug }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "產生失敗");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      if (selectedGame) {
        setSelectedGame({
          ...selectedGame,
          publicSlug: data.slug,
          qrCodeUrl: data.qrCodeUrl,
        });
      }
      toast({ title: "QR Code 已產生" });
    },
    onError: (error: Error) => {
      toast({ title: "產生 QR Code 失敗", description: error.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setIsDialogOpen(false);
    setEditingGame(null);
    setFormData(DEFAULT_FORM_DATA);
  }

  function handleEdit(game: Game) {
    setEditingGame(game);
    setFormData({
      title: game.title,
      description: game.description || "",
      difficulty: game.difficulty || "medium",
      estimatedTime: game.estimatedTime?.toString() || "",
      maxPlayers: game.maxPlayers?.toString() || "6",
    });
    setIsDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingGame) {
      updateMutation.mutate({
        id: editingGame.id,
        data: {
          title: formData.title,
          description: formData.description || null,
          difficulty: formData.difficulty,
          estimatedTime: formData.estimatedTime ? parseInt(formData.estimatedTime) : null,
          maxPlayers: formData.maxPlayers ? parseInt(formData.maxPlayers) : 6,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  }

  async function uploadCoverImage(file: File) {
    if (!coverUploadGame) return;

    setIsUploadingCover(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageData = await base64Promise;

      const response = await fetch(`/api/admin/games/${coverUploadGame.id}/cloudinary-cover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageData }),
      });

      if (!response.ok) {
        throw new Error("上傳失敗");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "封面圖片已更新" });
      setIsCoverDialogOpen(false);
      setCoverUploadGame(null);
    } catch (error) {
      toast({
        title: "上傳失敗",
        description: error instanceof Error ? error.message : "請稍後再試",
        variant: "destructive",
      });
    } finally {
      setIsUploadingCover(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null;
  }

  return (
    <AdminLayout
      title="遊戲管理"
      actions={
        <Button
          onClick={() => setIsWizardOpen(true)}
          data-testid="button-create-game"
        >
          <Plus className="h-4 w-4 mr-2" />
          新增遊戲
        </Button>
      }
    >
      <div className="p-6 space-y-6">
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-games"
                />
              </div>
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all" className="flex items-center gap-2" data-testid="tab-all">
                  <Gamepad2 className="h-4 w-4" />
                  全部 ({gameCounts.all})
                </TabsTrigger>
                <TabsTrigger value="draft" className="flex items-center gap-2" data-testid="tab-draft">
                  <FileText className="h-4 w-4" />
                  草稿 ({gameCounts.draft})
                </TabsTrigger>
                <TabsTrigger value="published" className="flex items-center gap-2" data-testid="tab-published">
                  <Globe className="h-4 w-4" />
                  已發布 ({gameCounts.published})
                </TabsTrigger>
                <TabsTrigger value="archived" className="flex items-center gap-2" data-testid="tab-archived">
                  <Archive className="h-4 w-4" />
                  已封存 ({gameCounts.archived})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {gamesLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : filteredGames.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {games.length === 0
                  ? "尚無遊戲，點擊「新增遊戲」開始建立"
                  : "沒有符合條件的遊戲"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>遊戲名稱</TableHead>
                    <TableHead>難度</TableHead>
                    <TableHead>時長</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGames.map((game) => (
                    <TableRow key={game.id} data-testid={`row-game-${game.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{game.title}</div>
                          {game.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {game.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {game.difficulty && DIFFICULTY_LABELS[game.difficulty]}
                      </TableCell>
                      <TableCell>
                        {game.estimatedTime ? `${game.estimatedTime} 分鐘` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={STATUS_COLORS[normalizeStatus(game.status)]}
                          variant="secondary"
                        >
                          {STATUS_LABELS[normalizeStatus(game.status)]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {game.publicSlug ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedGame(game);
                              setIsQRDialogOpen(true);
                            }}
                            data-testid={`button-view-qr-${game.id}`}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            檢視
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateQRMutation.mutate({ id: game.id })}
                            disabled={generateQRMutation.isPending}
                            data-testid={`button-generate-qr-${game.id}`}
                          >
                            <QrCode className="h-4 w-4 mr-1" />
                            產生
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/games/${game.id}`)}
                            data-testid={`button-edit-flow-${game.id}`}
                          >
                            <Workflow className="h-4 w-4 mr-1" />
                            編輯流程
                          </Button>
                          {normalizeStatus(game.status) === "draft" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => publishMutation.mutate({ id: game.id, status: "published" })}
                              disabled={publishMutation.isPending}
                              data-testid={`button-publish-${game.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              發布
                            </Button>
                          ) : normalizeStatus(game.status) === "published" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => publishMutation.mutate({ id: game.id, status: "draft" })}
                              disabled={publishMutation.isPending}
                              data-testid={`button-unpublish-${game.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              取消發布
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCoverUploadGame(game);
                              setIsCoverDialogOpen(true);
                            }}
                            title="上傳封面圖片"
                            data-testid={`button-cover-${game.id}`}
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(game)}
                            title="編輯基本設定"
                            data-testid={`button-edit-${game.id}`}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteGame(game)}
                            data-testid={`button-delete-${game.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <GameFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          isEditing={!!editingGame}
          formData={formData}
          setFormData={setFormData}
          onSubmit={handleSubmit}
          isPending={createMutation.isPending || updateMutation.isPending}
          onReset={resetForm}
        />

        <QRCodeDialog
          open={isQRDialogOpen}
          onOpenChange={setIsQRDialogOpen}
          game={selectedGame}
          onGenerate={(id, regenerate) => generateQRMutation.mutate({ id, regenerateSlug: regenerate })}
          isPending={generateQRMutation.isPending}
        />

        <CoverUploadDialog
          open={isCoverDialogOpen}
          onOpenChange={(open) => {
            setIsCoverDialogOpen(open);
            if (!open) setCoverUploadGame(null);
          }}
          game={coverUploadGame}
          onUpload={uploadCoverImage}
          isUploading={isUploadingCover}
        />

        <DeleteGameDialog
          open={!!deleteGame}
          onOpenChange={(open) => !open && setDeleteGame(null)}
          gameTitle={deleteGame?.title}
          onConfirm={() => deleteGame && deleteMutation.mutate(deleteGame.id)}
          isPending={deleteMutation.isPending}
        />

        <GameWizard
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
        />
      </div>
    </AdminLayout>
  );
}
