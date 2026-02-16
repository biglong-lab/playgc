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
  gameCounts: { all: number; draft: number; published: number; archived: number };
  gamesLoading: boolean;
  // 搜尋/篩選
  statusFilter: string;
  setStatusFilter: (v: string) => void;
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

      if (!response.ok) throw new Error("上傳失敗");

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

  return {
    admin, authLoading, isAuthenticated,
    games, filteredGames, gameCounts, gamesLoading,
    statusFilter, setStatusFilter, searchQuery, setSearchQuery,
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
    generateQRPending: generateQRMutation.isPending,
    onDelete: () => deleteGame && deleteMutation.mutate(deleteGame.id),
    onPublish: (id, status) => publishMutation.mutate({ id, status }),
    onGenerateQR: (id, regenerateSlug) => generateQRMutation.mutate({ id, regenerateSlug }),
  };
}
