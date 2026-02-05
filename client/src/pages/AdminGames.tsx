import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Trash2, 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  X, 
  Gamepad2,
  ExternalLink,
  RefreshCw,
  Workflow,
  Settings,
  Image as ImageIcon,
  Loader2,
  Search,
  FileText,
  Globe,
  Archive
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import type { Game } from "@shared/schema";

interface Field {
  id: string;
  name: string;
  code: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-500",
  published: "bg-green-500/10 text-green-500",
  archived: "bg-gray-500/10 text-gray-500",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

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
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty: "medium",
    estimatedTime: "",
    maxPlayers: "6",
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  const normalizeStatus = (status: string | null | undefined): string => {
    return status || "draft";
  };

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
    mutationFn: async (data: typeof formData) => {
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
    setFormData({
      title: "",
      description: "",
      difficulty: "medium",
      estimatedTime: "",
      maxPlayers: "6",
    });
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

  function handleShowQR(game: Game) {
    setSelectedGame(game);
    setIsQRDialogOpen(true);
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

  function copyGameUrl(slug: string) {
    const baseUrl = window.location.origin;
    const gameUrl = `${baseUrl}/g/${slug}`;
    navigator.clipboard.writeText(gameUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast({ title: "已複製遊戲連結" });
  }

  function downloadQRCode(qrCodeUrl: string, title: string) {
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `${title}-qrcode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleCoverUpload(game: Game) {
    setCoverUploadGame(game);
    setIsCoverDialogOpen(true);
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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({ title: "請選擇圖片檔案", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "圖片大小不得超過 5MB", variant: "destructive" });
        return;
      }
      uploadCoverImage(file);
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
          onClick={() => setIsDialogOpen(true)}
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
                            onClick={() => handleShowQR(game)}
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
                            onClick={() => handleCoverUpload(game)}
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

        <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingGame ? "編輯遊戲" : "新增遊戲"}
              </DialogTitle>
              <DialogDescription>
                {editingGame ? "修改遊戲資訊" : "建立新的實境遊戲"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">遊戲名稱 *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="輸入遊戲名稱"
                    required
                    data-testid="input-game-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">遊戲描述</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="輸入遊戲描述"
                    rows={3}
                    data-testid="input-game-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="difficulty">難度</Label>
                    <Select
                      value={formData.difficulty}
                      onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
                    >
                      <SelectTrigger data-testid="select-difficulty">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">簡單</SelectItem>
                        <SelectItem value="medium">中等</SelectItem>
                        <SelectItem value="hard">困難</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedTime">預估時間 (分鐘)</Label>
                    <Input
                      id="estimatedTime"
                      type="number"
                      value={formData.estimatedTime}
                      onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                      placeholder="60"
                      min="1"
                      data-testid="input-estimated-time"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxPlayers">最大玩家數</Label>
                  <Input
                    id="maxPlayers"
                    type="number"
                    value={formData.maxPlayers}
                    onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                    placeholder="6"
                    min="1"
                    max="100"
                    data-testid="input-max-players"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetForm}>
                  取消
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-game"
                >
                  {editingGame ? "更新" : "建立"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                遊戲 QR Code
              </DialogTitle>
              <DialogDescription>
                {selectedGame?.title}
              </DialogDescription>
            </DialogHeader>
            {selectedGame && (
              <div className="space-y-4 py-4">
                {selectedGame.qrCodeUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <img 
                      src={selectedGame.qrCodeUrl} 
                      alt="QR Code" 
                      className="w-48 h-48 border rounded-lg p-2 bg-white"
                    />
                    <div className="flex items-center gap-2 w-full">
                      <Input
                        value={`${window.location.origin}/g/${selectedGame.publicSlug}`}
                        readOnly
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyGameUrl(selectedGame.publicSlug!)}
                      >
                        {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadQRCode(selectedGame.qrCodeUrl!, selectedGame.title)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下載 QR Code
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateQRMutation.mutate({ id: selectedGame.id, regenerateSlug: true })}
                        disabled={generateQRMutation.isPending}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Button onClick={() => generateQRMutation.mutate({ id: selectedGame.id })}>
                      產生 QR Code
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isCoverDialogOpen} onOpenChange={setIsCoverDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                上傳封面圖片
              </DialogTitle>
              <DialogDescription>
                為「{coverUploadGame?.title}」選擇封面圖片
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {coverUploadGame?.coverImageUrl && (
                <div className="flex justify-center">
                  <img 
                    src={coverUploadGame.coverImageUrl} 
                    alt="Current cover" 
                    className="w-32 h-32 object-cover rounded-lg border"
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-4">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploadingCover}
                  />
                  <Button 
                    variant="outline" 
                    disabled={isUploadingCover}
                    asChild
                  >
                    <span>
                      {isUploadingCover ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4 mr-2" />
                      )}
                      選擇圖片
                    </span>
                  </Button>
                </label>
                <p className="text-sm text-muted-foreground">
                  支援 JPG、PNG，最大 5MB
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteGame} onOpenChange={() => setDeleteGame(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除遊戲嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                即將刪除「{deleteGame?.title}」。此操作無法復原，遊戲的所有資料都將被永久刪除。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGame && deleteMutation.mutate(deleteGame.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
