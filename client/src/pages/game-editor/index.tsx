// 遊戲編輯器主入口
import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameWithDetails, Page } from "@shared/schema";
import {
  ChevronLeft, Save, Upload, FileText,
  Eye, Settings, Package, Trophy, MapPin, Ticket,
} from "lucide-react";
import { Link } from "wouter";
import ItemsEditor from "@/components/ItemsEditor";
import { PAGE_TEMPLATES, getPageTypeInfo } from "./constants";
import { getDefaultConfig } from "./getDefaultConfig";
import PageConfigEditor from "./PageConfigEditor";
import EventsEditor from "./EventsEditor";
import ChapterManager from "./ChapterManager";
import { syncPages } from "./lib/page-sync";
import ToolboxSidebar from "./components/ToolboxSidebar";
import PageListSidebar from "./components/PageListSidebar";

export default function GameEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = gameId === "new";

  // 判斷是 admin-staff 還是 admin 路徑
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  const apiGamesPath = isAdminStaff ? "/api/admin/games" : "/api/games";
  const apiPagesPath = isAdminStaff ? "/api/admin/pages" : "/api/pages";
  const apiEventsPath = isAdminStaff ? "/api/admin/events" : "/api/events";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [estimatedTime, setEstimatedTime] = useState(30);
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isDraggingFromToolbox, setIsDraggingFromToolbox] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 媒體上傳到 Cloudinary
  const handleMediaUpload = useCallback(
    async (file: File, type: "video" | "audio" | "image"): Promise<string | null> => {
      if (!gameId) {
        toast({ title: "錯誤", description: "請先儲存遊戲", variant: "destructive" });
        return null;
      }

      setIsUploading(true);
      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const endpoint =
          type === "video"
            ? "/api/cloudinary/video"
            : type === "audio"
              ? "/api/cloudinary/audio"
              : "/api/cloudinary/game-media";

        const response = await apiRequest("POST", endpoint, {
          data: base64,
          gameId,
          fileName: file.name,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "上傳失敗");
        }

        const result = await response.json();
        const labels = { video: "影片", audio: "音訊", image: "圖片" };
        toast({ title: "上傳成功", description: `${labels[type]}已上傳` });
        return result.url;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "未知錯誤";
        toast({ title: "上傳失敗", description: message, variant: "destructive" });
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [gameId, toast]
  );

  const { data: game, isLoading } = useQuery<GameWithDetails>({
    queryKey: [apiGamesPath, gameId],
    enabled: !isNew,
  });

  useEffect(() => {
    if (game) {
      setTitle(game.title);
      setDescription(game.description || "");
      setDifficulty(game.difficulty || "medium");
      setEstimatedTime(game.estimatedTime || 30);
      setMaxPlayers(game.maxPlayers || 6);
      setPages(game.pages || []);
    }
  }, [game]);

  const saveGameMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      let targetGameId = gameId;

      if (isNew) {
        const response = await apiRequest("POST", apiGamesPath, data);
        const newGame = await response.json();
        targetGameId = newGame.id;
        const syncedPages = await syncPages(targetGameId, pages, [], {
          apiGamesPath,
          apiPagesPath,
        });
        return { game: newGame, pages: syncedPages };
      }

      await apiRequest("PATCH", `${apiGamesPath}/${gameId}`, data);
      const serverPagesResponse = await apiRequest(
        "GET",
        `${apiGamesPath}/${gameId}/pages`
      );
      const serverPages = await serverPagesResponse.json();
      const syncedPages = await syncPages(gameId!, pages, serverPages, {
        apiGamesPath,
        apiPagesPath,
      });
      return { game: null, pages: syncedPages };
    },
    onSuccess: (result) => {
      toast({ title: "已儲存", description: "遊戲已成功儲存" });
      queryClient.invalidateQueries({ queryKey: [apiGamesPath] });

      if (result?.pages) {
        setPages(result.pages);
        if (selectedPage) {
          const updated = result.pages.find(
            (p) =>
              p.id === selectedPage.id ||
              (selectedPage.id.startsWith("temp-") &&
                p.pageOrder === selectedPage.pageOrder)
          );
          if (updated) setSelectedPage(updated);
        }
      }

      if (isNew && result?.game?.id) {
        setLocation(`${basePath}/${result.game.id}`);
      }
    },
    onError: () => {
      toast({ title: "儲存失敗", description: "請重試", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveGameMutation.mutate({
      title, description, difficulty, estimatedTime, maxPlayers, status: "draft",
    });
  };

  const handlePublish = () => {
    saveGameMutation.mutate({
      title, description, difficulty, estimatedTime, maxPlayers, status: "published",
    });
  };

  // ====== 頁面操作 ======

  const addPage = (pageType: string, atIndex?: number) => {
    const newPage: Page = {
      id: `temp-${Date.now()}`,
      gameId: gameId || "",
      pageOrder: (atIndex ?? pages.length) + 1,
      pageType,
      config: getDefaultConfig(pageType),
      chapterId: null,
      createdAt: new Date(),
    };

    if (atIndex !== undefined) {
      const newPages = [...pages];
      newPages.splice(atIndex, 0, newPage);
      newPages.forEach((p, i) => (p.pageOrder = i + 1));
      setPages(newPages);
    } else {
      setPages([...pages, newPage]);
    }
    setSelectedPage(newPage);
    toast({ title: "已新增頁面", description: `${getPageTypeInfo(pageType).label}` });
  };

  const addTemplatePages = (templateId: string) => {
    const template = PAGE_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const newPages: Page[] = template.pages.map((p, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      gameId: gameId || "",
      pageOrder: pages.length + idx + 1,
      pageType: p.pageType,
      config: p.config,
      chapterId: null,
      createdAt: new Date(),
    }));

    setPages([...pages, ...newPages]);
    if (newPages.length > 0) setSelectedPage(newPages[0]);
    toast({
      title: "已套用模板",
      description: `${template.label} - 新增 ${newPages.length} 個頁面`,
    });
  };

  const handleReorder = (newPages: Page[]) => {
    newPages.forEach((p, i) => (p.pageOrder = i + 1));
    setPages(newPages);
  };

  const deletePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    newPages.forEach((p, i) => (p.pageOrder = i + 1));
    setPages(newPages);
    if (selectedPage?.id === pages[index].id) setSelectedPage(null);
  };

  const duplicatePage = (index: number) => {
    const newPage: Page = {
      ...pages[index],
      id: `temp-${Date.now()}`,
      pageOrder: index + 2,
    };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, newPage);
    newPages.forEach((p, i) => (p.pageOrder = i + 1));
    setPages(newPages);
    toast({ title: "已複製頁面" });
  };

  // ====== 拖曳處理 ======

  const handleToolboxDragStart = (e: React.DragEvent, pageType: string) => {
    e.dataTransfer.setData("pageType", pageType);
    e.dataTransfer.effectAllowed = "copy";
    setIsDraggingFromToolbox(true);
  };

  const handleToolboxDragEnd = () => {
    setIsDraggingFromToolbox(false);
    setDragOverIndex(null);
  };

  const handlePageListDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (isDraggingFromToolbox) setDragOverIndex(index);
  };

  const handlePageListDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const pageType = e.dataTransfer.getData("pageType");
    if (pageType) addPage(pageType, index);
    setDragOverIndex(null);
    setIsDraggingFromToolbox(false);
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pageType = e.dataTransfer.getData("pageType");
    if (pageType) addPage(pageType);
    setIsDraggingFromToolbox(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation(basePath)} data-testid="button-back">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="遊戲標題"
              className="font-display font-bold text-lg border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              data-testid="input-game-title"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setLocation(`/game/${gameId}`)} className="gap-2" disabled={isNew} data-testid="button-preview">
              <Eye className="w-4 h-4" /> 預覽
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saveGameMutation.isPending} className="gap-2" data-testid="button-save">
              <Save className="w-4 h-4" /> 儲存
            </Button>
            <Button onClick={handlePublish} disabled={saveGameMutation.isPending} className="gap-2" data-testid="button-publish">
              <Upload className="w-4 h-4" /> 發布
            </Button>
          </div>
        </div>

        {!isNew && (
          <div className="px-4 py-2 border-t border-border/50 flex items-center gap-2 bg-muted/30">
            <span className="text-xs text-muted-foreground mr-2">資源管理:</span>
            <Link href={`${basePath}/${gameId}/items`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-items"><Package className="w-3.5 h-3.5" /> 道具</Button>
            </Link>
            <Link href={`${basePath}/${gameId}/achievements`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-achievements"><Trophy className="w-3.5 h-3.5" /> 成就</Button>
            </Link>
            <Link href={`${basePath}/${gameId}/locations`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-locations"><MapPin className="w-3.5 h-3.5" /> 地點</Button>
            </Link>
            <Link href={`${basePath}/${gameId}/settings`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-settings"><Settings className="w-3.5 h-3.5" /> 設定</Button>
            </Link>
          </div>
        )}
      </header>

      <div className="flex-1 flex">
        <ToolboxSidebar
          onDragStart={handleToolboxDragStart}
          onDragEnd={handleToolboxDragEnd}
          onAddTemplate={addTemplatePages}
        />

        <PageListSidebar
          pages={pages}
          selectedPage={selectedPage}
          isDraggingFromToolbox={isDraggingFromToolbox}
          dragOverIndex={dragOverIndex}
          onSelectPage={setSelectedPage}
          onReorder={handleReorder}
          onDuplicate={duplicatePage}
          onDelete={deletePage}
          onDragOver={handlePageListDragOver}
          onDrop={handlePageListDrop}
          onDropZoneDrop={handleDropZoneDrop}
        />

        {/* 主內容區 */}
        <main className="flex-1 overflow-auto">
          <Tabs defaultValue="page" className="h-full">
            <div className="px-6 py-4 border-b border-border">
              <TabsList>
                <TabsTrigger value="page" data-testid="tab-page">頁面設定</TabsTrigger>
                <TabsTrigger value="game" data-testid="tab-game">遊戲設定</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-items">道具</TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-events">事件</TabsTrigger>
                <TabsTrigger value="chapters" data-testid="tab-chapters">章節</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="page" className="p-6">
              {selectedPage ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {(() => {
                        const info = getPageTypeInfo(selectedPage.pageType);
                        return (
                          <>
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${info.color}`}>
                              <info.icon className="w-4 h-4" />
                            </div>
                            {info.label} 設定
                          </>
                        );
                      })()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <PageConfigEditor
                      page={selectedPage}
                      allPages={pages}
                      gameId={gameId || ""}
                      handleMediaUpload={handleMediaUpload}
                      isUploading={isUploading}
                      onUpdate={(config) => {
                        const newPages = pages.map((p) =>
                          p.id === selectedPage.id ? { ...p, config } : p
                        );
                        setPages(newPages);
                        setSelectedPage({ ...selectedPage, config });
                      }}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-20 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>選擇一個頁面進行編輯</p>
                  <p className="text-sm mt-1">或從左側拖曳元件新增頁面</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="game" className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>遊戲基本設定</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">遊戲描述</label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述這個遊戲..." rows={4} data-testid="input-description" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">難度</label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger data-testid="select-difficulty"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="easy">簡單</SelectItem>
                          <SelectItem value="medium">中等</SelectItem>
                          <SelectItem value="hard">困難</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">預估時間 (分鐘)</label>
                      <Input type="number" value={estimatedTime} onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 30)} min={5} max={180} data-testid="input-time" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">最大人數</label>
                      <Input type="number" value={maxPlayers} onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 6)} min={1} max={20} data-testid="input-players" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="items" className="p-6">
              <ItemsEditor gameId={gameId || ""} useAdminApi={true} />
            </TabsContent>

            <TabsContent value="events" className="p-6">
              <EventsEditor gameId={gameId || ""} pages={pages} apiGamesPath={apiGamesPath} apiEventsPath={apiEventsPath} />
            </TabsContent>

            <TabsContent value="chapters" className="p-6">
              {gameId && !isNew ? (
                <ChapterManager gameId={gameId} />
              ) : (
                <p className="text-muted-foreground">請先儲存遊戲後再管理章節</p>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
