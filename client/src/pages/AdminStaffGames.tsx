import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminStaffLayout from "@/components/AdminStaffLayout";
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
import { 
  Plus, 
  Pencil, 
  Trash2, 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  X, 
  Gamepad2,
  Eye,
  ExternalLink,
  RefreshCw,
  Workflow,
  Settings,
  Upload,
  Image as ImageIcon,
  Loader2,
  Search,
  FileText,
  Globe,
  Archive
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface Field {
  id: string;
  name: string;
  code: string;
}

interface Game {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  estimatedTime: number | null;
  maxPlayers: number | null;
  status: string | null;
  fieldId: string | null;
  publicSlug: string | null;
  qrCodeUrl: string | null;
  isIsolated: boolean | null;
  createdAt: string;
  field?: Field | null;
}

async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
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

export default function AdminStaffGames() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
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
    queryFn: () => fetchWithAdminAuth("/api/admin/games"),
  });

  // Normalize status to treat null/undefined as "draft"
  const normalizeStatus = (status: string | null | undefined): string => {
    return status || "draft";
  };

  // Filter games by status and search query
  const filteredGames = games.filter((game) => {
    const gameStatus = normalizeStatus(game.status);
    const matchesStatus = statusFilter === "all" || gameStatus === statusFilter;
    const matchesSearch = !searchQuery || 
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  // Count games by status
  const gameCounts = {
    all: games.length,
    draft: games.filter(g => normalizeStatus(g.status) === "draft").length,
    published: games.filter(g => normalizeStatus(g.status) === "published").length,
    archived: games.filter(g => normalizeStatus(g.status) === "archived").length,
  };

  const { data: fields = [] } = useQuery<Field[]>({
    queryKey: ["/api/admin/fields"],
    queryFn: () => fetchWithAdminAuth("/api/admin/fields"),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      fetchWithAdminAuth("/api/admin/games", {
        method: "POST",
        body: JSON.stringify({
          title: data.title,
          description: data.description || null,
          difficulty: data.difficulty,
          estimatedTime: data.estimatedTime ? parseInt(data.estimatedTime) : null,
          maxPlayers: data.maxPlayers ? parseInt(data.maxPlayers) : 6,
        }),
      }),
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
    mutationFn: ({ id, data }: { id: string; data: Partial<Game> }) => 
      fetchWithAdminAuth(`/api/admin/games/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
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
    mutationFn: (id: string) => 
      fetchWithAdminAuth(`/api/admin/games/${id}`, { method: "DELETE" }),
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
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      fetchWithAdminAuth(`/api/admin/games/${id}/publish`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({ title: "遊戲狀態已更新" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const generateQRMutation = useMutation({
    mutationFn: ({ id, regenerateSlug }: { id: string; regenerateSlug?: boolean }) => 
      fetchWithAdminAuth(`/api/admin/games/${id}/qrcode`, {
        method: "POST",
        body: JSON.stringify({ regenerateSlug }),
      }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      if (selectedGame) {
        setSelectedGame({
          ...selectedGame,
          publicSlug: data.slug,
          qrCodeUrl: data.qrCodeUrl,
        });
      }
      toast({ title: variables.regenerateSlug ? "QR Code 已重新產生" : "QR Code 已產生" });
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
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const imageData = await base64Promise;
      
      // Upload to Cloudinary
      await fetchWithAdminAuth(`/api/admin/games/${coverUploadGame.id}/cloudinary-cover`, {
        method: "POST",
        body: JSON.stringify({ imageData }),
      });
      
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
          <Button 
            onClick={() => setIsDialogOpen(true)}
            data-testid="button-create-game"
          >
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
                    <TableHead>場域</TableHead>
                    <TableHead>難度</TableHead>
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
                        {game.field ? (
                          <Badge variant="outline">{game.field.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {game.difficulty && DIFFICULTY_LABELS[game.difficulty]}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className={STATUS_COLORS[game.status || "draft"]}
                          variant="secondary"
                        >
                          {STATUS_LABELS[game.status || "draft"]}
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
                            onClick={() => navigate(`/admin-staff/games/${game.id}`)}
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
                  <>
                    <div className="flex justify-center">
                      <img 
                        src={selectedGame.qrCodeUrl} 
                        alt="QR Code" 
                        className="w-64 h-64 border rounded-lg"
                        data-testid="img-qrcode"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>遊戲連結</Label>
                      <div className="flex gap-2">
                        <Input
                          value={`${window.location.origin}/g/${selectedGame.publicSlug}`}
                          readOnly
                          className="text-sm"
                          data-testid="input-game-url"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyGameUrl(selectedGame.publicSlug!)}
                          data-testid="button-copy-url"
                        >
                          {copiedUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(`/g/${selectedGame.publicSlug}`, '_blank')}
                          data-testid="button-open-game"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => downloadQRCode(selectedGame.qrCodeUrl!, selectedGame.title)}
                        data-testid="button-download-qr"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下載 QR Code
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => generateQRMutation.mutate({ id: selectedGame.id, regenerateSlug: true })}
                        disabled={generateQRMutation.isPending}
                        data-testid="button-regenerate-qr"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        重新產生
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">尚未產生 QR Code</p>
                    <Button
                      onClick={() => generateQRMutation.mutate({ id: selectedGame.id })}
                      disabled={generateQRMutation.isPending}
                      data-testid="button-generate-qr-dialog"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      產生 QR Code
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isCoverDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsCoverDialogOpen(false);
            setCoverUploadGame(null);
          }
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                上傳封面圖片
              </DialogTitle>
              <DialogDescription>
                {coverUploadGame?.title}
              </DialogDescription>
            </DialogHeader>
            {coverUploadGame && (
              <div className="space-y-4 py-4">
                {coverUploadGame.coverImageUrl && (
                  <div className="space-y-2">
                    <Label>目前封面</Label>
                    <div className="relative w-full h-40 rounded-lg overflow-hidden bg-muted">
                      <img
                        src={coverUploadGame.coverImageUrl}
                        alt="目前封面"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>選擇新圖片</Label>
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    {isUploadingCover ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">上傳中...</p>
                      </div>
                    ) : (
                      <label className="cursor-pointer block">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="input-cover-file"
                        />
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            點擊選擇圖片或拖放圖片到此處
                          </p>
                          <p className="text-xs text-muted-foreground">
                            支援 JPG, PNG, GIF (最大 5MB)
                          </p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteGame} onOpenChange={(open) => !open && setDeleteGame(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確認刪除</AlertDialogTitle>
              <AlertDialogDescription>
                確定要刪除遊戲「{deleteGame?.title}」嗎？此操作無法復原。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteGame && deleteMutation.mutate(deleteGame.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete"
              >
                刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminStaffLayout>
  );
}
