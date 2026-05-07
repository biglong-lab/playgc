import { useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import type { Game } from "@shared/schema";
import { normalizeStatus, DEFAULT_FORM_DATA, type GameFormData } from "@/components/admin-games";

export interface AdminGamesReturn {
  // 認證
  admin: ReturnType<typeof useRequireAdminAuth>["admin"];
  authLoading: boolean;
  isAuthenticated: boolean;
  // 遊戲資料
  games: Game[];
  filteredGames: Game[];
  gameCounts: {
    all: number;
    draft: number;
    published: number;
    archived: number;
    game: number;
    activity: number;
    scenarioInstances: number;
  };
  gamesLoading: boolean;
  // 搜尋/篩選
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  // 🆕 軟分流階段 1：editor mode filter
  editorModeFilter: "all" | "game" | "activity";
  setEditorModeFilter: (v: "all" | "game" | "activity") => void;
  showScenarioInstances: boolean;
  setShowScenarioInstances: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  // 表單
  formData: GameFormData;
  setFormData: Dispatch<SetStateAction<GameFormData>>;
  editingGame: Game | null;
  // 對話框
  isDialogOpen: boolean;
  setIsDialogOpen: (v: boolean) => void;
  isQRDialogOpen: boolean;
  setIsQRDialogOpen: (v: boolean) => void;
  isCoverDialogOpen: boolean;
  setIsCoverDialogOpen: (v: boolean) => void;
  deleteGame: Game | null;
  setDeleteGame: (v: Game | null) => void;
  selectedGame: Game | null;
  setSelectedGame: (v: Game | null) => void;
  coverUploadGame: Game | null;
  setCoverUploadGame: (v: Game | null) => void;
  isUploadingCover: boolean;
  isWizardOpen: boolean;
  setIsWizardOpen: (v: boolean) => void;
  // 操作
  navigate: (path: string) => void;
  handleEdit: (game: Game) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
  uploadCoverImage: (file: File) => Promise<void>;
  // Mutations
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
  publishPending: boolean;
  // 🆕 首頁可見 toggle
  homeVisiblePending: boolean;
  onToggleHomeVisible: (id: string, isIsolated: boolean) => void;
  generateQRPending: boolean;
  onDelete: () => void;
  onPublish: (id: string, status: string) => void;
  onGenerateQR: (id: string, regenerateSlug?: boolean) => void;
}

export function useAdminGames(): AdminGamesReturn {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { admin, isLoading: authLoading, isAuthenticated } = useRequireAdminAuth();

  // 對話框 state
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

  // 遊戲查詢
  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    enabled: isAuthenticated,
  });

  // 🆕 軟分流階段 1：editor mode filter（all / game / activity）
  // 預設過濾掉 SCENARIO 實例（description 含 [scenario:）— admin 列表不爆炸
  const [editorModeFilter, setEditorModeFilter] = useState<"all" | "game" | "activity">("all");
  const [showScenarioInstances, setShowScenarioInstances] = useState(false);

  const isScenarioInstance = (g: Game): boolean =>
    !!g.description?.includes("[scenario:");

  const visibleGames = games.filter((g) => showScenarioInstances || !isScenarioInstance(g));

  const filteredGames = visibleGames.filter((game) => {
    const gameStatus = normalizeStatus(game.status);
    const matchesStatus = statusFilter === "all" || gameStatus === statusFilter;
    const matchesEditorMode =
      editorModeFilter === "all" || (game.editorMode ?? "game") === editorModeFilter;
    const matchesSearch = !searchQuery ||
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (game.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesEditorMode && matchesSearch;
  });

  const gameCounts = {
    all: visibleGames.length,
    draft: visibleGames.filter(g => normalizeStatus(g.status) === "draft").length,
    published: visibleGames.filter(g => normalizeStatus(g.status) === "published").length,
    archived: visibleGames.filter(g => normalizeStatus(g.status) === "archived").length,
    game: visibleGames.filter(g => (g.editorMode ?? "game") === "game").length,
    activity: visibleGames.filter(g => g.editorMode === "activity").length,
    scenarioInstances: games.filter(isScenarioInstance).length,
  };

  // Mutations
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
    onError: (error: Error) => toast({ title: "建立失敗", description: error.message, variant: "destructive" }),
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
    onError: (error: Error) => toast({ title: "更新失敗", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/games/${id}`, { method: "DELETE", credentials: "include" });
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
    onError: (error: Error) => toast({ title: "刪除失敗", description: error.message, variant: "destructive" }),
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
    onError: (error: Error) => toast({ title: "更新失敗", description: error.message, variant: "destructive" }),
  });

  // 🆕 2026-05-07：首頁可見 toggle（綁 isIsolated 反向）
  // isIsolated=true（schema default）= QR-only 防亂入、不在首頁
  // isIsolated=false = 首頁可見
  const homeVisibleMutation = useMutation({
    mutationFn: async ({ id, isIsolated }: { id: string; isIsolated: boolean }) => {
      const response = await fetch(`/api/admin/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isIsolated }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "更新失敗");
      }
      return response.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({
        title: vars.isIsolated ? "已從首頁隱藏" : "✅ 已設為首頁可見",
        description: vars.isIsolated
          ? "玩家現在只能透過 QR / 直接連結進入"
          : "玩家現在可在首頁看到此遊戲",
      });
    },
    onError: (error: Error) =>
      toast({ title: "更新失敗", description: error.message, variant: "destructive" }),
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
        setSelectedGame({ ...selectedGame, publicSlug: data.slug, qrCodeUrl: data.qrCodeUrl });
      }
      toast({ title: "QR Code 已產生" });
    },
    onError: (error: Error) => toast({ title: "產生 QR Code 失敗", description: error.message, variant: "destructive" }),
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
      gameMode: game.gameMode || "individual",
      bgmUrl: (game as { bgmUrl?: string | null }).bgmUrl || "",
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
          gameMode: formData.gameMode || "individual",
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
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "上傳失敗");
      }

      // 🆕 invalidate 所有用到 game 的 query（管理端 + 玩家端）
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games"] });

      toast({
        title: "✅ 封面已更新",
        description: "若立即看到破圖，Cloudinary CDN 會在幾秒內自動同步（已內建自動重試）",
      });
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

  return {
    admin, authLoading, isAuthenticated,
    games, filteredGames, gameCounts, gamesLoading,
    statusFilter, setStatusFilter,
    editorModeFilter, setEditorModeFilter,
    showScenarioInstances, setShowScenarioInstances,
    searchQuery, setSearchQuery,
    formData, setFormData, editingGame,
    isDialogOpen, setIsDialogOpen,
    isQRDialogOpen, setIsQRDialogOpen,
    isCoverDialogOpen, setIsCoverDialogOpen,
    deleteGame, setDeleteGame,
    selectedGame, setSelectedGame,
    coverUploadGame, setCoverUploadGame,
    isUploadingCover,
    isWizardOpen, setIsWizardOpen,
    navigate, handleEdit, handleSubmit, resetForm, uploadCoverImage,
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
    deletePending: deleteMutation.isPending,
    publishPending: publishMutation.isPending,
    homeVisiblePending: homeVisibleMutation.isPending,
    generateQRPending: generateQRMutation.isPending,
    onDelete: () => deleteGame && deleteMutation.mutate(deleteGame.id),
    onPublish: (id, status) => publishMutation.mutate({ id, status }),
    onToggleHomeVisible: (id, isIsolated) => homeVisibleMutation.mutate({ id, isIsolated }),
    onGenerateQR: (id, regenerateSlug) => generateQRMutation.mutate({ id, regenerateSlug }),
  };
}
