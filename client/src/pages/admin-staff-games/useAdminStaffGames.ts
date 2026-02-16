// 場域管理員遊戲管理邏輯 Hook
import { useState, type Dispatch, type SetStateAction } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { normalizeStatus, DEFAULT_FORM_DATA, type GameFormData } from "@/components/admin-games";

// AdminStaff 版的 Game 介面（含 field 資訊）
interface Field {
  id: string;
  name: string;
  code: string;
}

export interface StaffGame {
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

// 帶認證的 fetch 封裝
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

export interface AdminStaffGamesReturn {
  // 資料
  games: StaffGame[];
  filteredGames: StaffGame[];
  gameCounts: { all: number; draft: number; published: number; archived: number };
  gamesLoading: boolean;
  // 表單
  formData: GameFormData;
  setFormData: Dispatch<SetStateAction<GameFormData>>;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  // 對話框狀態
  isDialogOpen: boolean;
  setIsDialogOpen: (v: boolean) => void;
  isQRDialogOpen: boolean;
  setIsQRDialogOpen: (v: boolean) => void;
  isCoverDialogOpen: boolean;
  setIsCoverDialogOpen: (v: boolean) => void;
  editingGame: StaffGame | null;
  deleteGame: StaffGame | null;
  setDeleteGame: (g: StaffGame | null) => void;
  selectedGame: StaffGame | null;
  setSelectedGame: (g: StaffGame | null) => void;
  coverUploadGame: StaffGame | null;
  setCoverUploadGame: (g: StaffGame | null) => void;
  isUploadingCover: boolean;
  // 操作
  navigate: (path: string) => void;
  handleEdit: (game: StaffGame) => void;
  handleSubmit: (e: React.FormEvent) => void;
  resetForm: () => void;
  uploadCoverImage: (file: File) => Promise<void>;
  onPublish: (id: string, status: string) => void;
  onGenerateQR: (id: string, regenerateSlug?: boolean) => void;
  onDelete: () => void;
  // Mutation 狀態
  createPending: boolean;
  updatePending: boolean;
  deletePending: boolean;
  publishPending: boolean;
  generateQRPending: boolean;
}

export function useAdminStaffGames(): AdminStaffGamesReturn {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // 表單 / 篩選狀態
  const [formData, setFormData] = useState<GameFormData>(DEFAULT_FORM_DATA);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 對話框狀態
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<StaffGame | null>(null);
  const [deleteGameState, setDeleteGame] = useState<StaffGame | null>(null);
  const [selectedGame, setSelectedGame] = useState<StaffGame | null>(null);
  const [coverUploadGame, setCoverUploadGame] = useState<StaffGame | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  // 查詢
  const { data: games = [], isLoading: gamesLoading } = useQuery<StaffGame[]>({
    queryKey: ["/api/admin/games"],
    queryFn: () => fetchWithAdminAuth("/api/admin/games"),
  });

  // 篩選
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
    mutationFn: (data: GameFormData) =>
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
    mutationFn: ({ id, data }: { id: string; data: Partial<StaffGame> }) =>
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

  // Handlers
  function resetForm() {
    setIsDialogOpen(false);
    setEditingGame(null);
    setFormData(DEFAULT_FORM_DATA);
  }

  function handleEdit(game: StaffGame) {
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

  return {
    games,
    filteredGames,
    gameCounts,
    gamesLoading,
    formData,
    setFormData,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isDialogOpen,
    setIsDialogOpen,
    isQRDialogOpen,
    setIsQRDialogOpen,
    isCoverDialogOpen,
    setIsCoverDialogOpen,
    editingGame,
    deleteGame: deleteGameState,
    setDeleteGame,
    selectedGame,
    setSelectedGame,
    coverUploadGame,
    setCoverUploadGame,
    isUploadingCover,
    navigate,
    handleEdit,
    handleSubmit,
    resetForm,
    uploadCoverImage,
    onPublish: (id, status) => publishMutation.mutate({ id, status }),
    onGenerateQR: (id, regenerateSlug) => generateQRMutation.mutate({ id, regenerateSlug }),
    onDelete: () => deleteGameState && deleteMutation.mutate(deleteGameState.id),
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
    deletePending: deleteMutation.isPending,
    publishPending: publishMutation.isPending,
    generateQRPending: generateQRMutation.isPending,
  };
}
