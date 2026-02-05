import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { GameWithDetails, Page, InsertPage } from "@shared/schema";
import {
  ChevronLeft, Save, Play, Upload, Plus, GripVertical,
  Trash2, Copy, FileText, MessageCircle, Video, Grid,
  HelpCircle, Target, Camera, MapPin, QrCode, Settings,
  Eye, ChevronUp, ChevronDown, Move, Zap, Gift, AlertTriangle,
  ArrowRight, Clock, Package, Trophy, Bomb, Lock, Smartphone, Vote, Puzzle
} from "lucide-react";
import { Link } from "wouter";
import ItemRewardPicker from "@/components/ItemRewardPicker";
import LocationPicker from "@/components/LocationPicker";
import QRCodeGenerator from "@/components/QRCodeGenerator";
import ItemsEditor from "@/components/ItemsEditor";

const PAGE_TYPES = [
  { value: "text_card", label: "字卡", icon: FileText, color: "bg-blue-500/20 text-blue-400" },
  { value: "dialogue", label: "對話", icon: MessageCircle, color: "bg-purple-500/20 text-purple-400" },
  { value: "video", label: "影片", icon: Video, color: "bg-pink-500/20 text-pink-400" },
  { value: "button", label: "按鈕選擇", icon: Grid, color: "bg-indigo-500/20 text-indigo-400" },
  { value: "text_verify", label: "文字驗證", icon: HelpCircle, color: "bg-cyan-500/20 text-cyan-400" },
  { value: "choice_verify", label: "選擇驗證", icon: HelpCircle, color: "bg-teal-500/20 text-teal-400" },
  { value: "conditional_verify", label: "碎片收集", icon: Puzzle, color: "bg-lime-500/20 text-lime-400" },
  { value: "shooting_mission", label: "射擊任務", icon: Target, color: "bg-orange-500/20 text-orange-400" },
  { value: "photo_mission", label: "拍照任務", icon: Camera, color: "bg-green-500/20 text-green-400" },
  { value: "gps_mission", label: "GPS 任務", icon: MapPin, color: "bg-red-500/20 text-red-400" },
  { value: "qr_scan", label: "QR 掃描", icon: QrCode, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "time_bomb", label: "拆彈任務", icon: Bomb, color: "bg-red-600/20 text-red-500" },
  { value: "lock", label: "密碼鎖", icon: Lock, color: "bg-amber-500/20 text-amber-400" },
  { value: "motion_challenge", label: "體感挑戰", icon: Smartphone, color: "bg-violet-500/20 text-violet-400" },
  { value: "vote", label: "隊伍投票", icon: Vote, color: "bg-emerald-500/20 text-emerald-400" },
];

const PAGE_TEMPLATES = [
  {
    id: "intro_sequence",
    label: "開場序列",
    description: "故事開場 + 指引對話 + 確認開始",
    icon: Play,
    color: "bg-emerald-500/20 text-emerald-400",
    pages: [
      { pageType: "text_card", config: { title: "歡迎來到賈村", content: "一場驚心動魄的冒險即將開始..." } },
      { pageType: "dialogue", config: { character: { name: "指揮官" }, messages: [{ text: "戰士，你準備好了嗎？" }] } },
      { pageType: "button", config: { prompt: "準備開始任務？", buttons: [{ text: "出發！", rewardPoints: 0 }, { text: "需要更多說明", rewardPoints: 0 }] } },
    ],
  },
  {
    id: "combat_mission",
    label: "戰鬥任務",
    description: "任務簡報 + 射擊目標 + 完成獎勵",
    icon: Target,
    color: "bg-orange-500/20 text-orange-400",
    pages: [
      { pageType: "text_card", config: { title: "作戰指令", content: "敵軍據點已被發現，消滅所有目標！" } },
      { pageType: "shooting_mission", config: { requiredHits: 10, timeLimit: 120, targetScore: 100 } },
      { pageType: "text_card", config: { title: "任務完成", content: "目標已全數消滅，幹得好！" } },
    ],
  },
  {
    id: "exploration_quest",
    label: "探索任務",
    description: "GPS導航 + 拍照記錄 + QR確認",
    icon: MapPin,
    color: "bg-red-500/20 text-red-400",
    pages: [
      { pageType: "text_card", config: { title: "偵查任務", content: "前往指定地點進行偵查。" } },
      { pageType: "gps_mission", config: { targetLocation: { lat: 25.033, lng: 121.565 }, radius: 30, instruction: "前往目標位置" } },
      { pageType: "photo_mission", config: { instruction: "拍攝目標區域的照片作為證據" } },
      { pageType: "qr_scan", config: { qrCodeId: "CHECKPOINT-001", instruction: "掃描檢查站QR碼確認抵達" } },
    ],
  },
  {
    id: "puzzle_challenge",
    label: "解謎挑戰",
    description: "謎題說明 + 多選驗證 + 文字密碼",
    icon: HelpCircle,
    color: "bg-cyan-500/20 text-cyan-400",
    pages: [
      { pageType: "text_card", config: { title: "密碼謎題", content: "破解敵軍的加密通訊，找出隱藏的密碼。" } },
      { pageType: "choice_verify", config: { question: "根據線索，哪個是正確答案？", options: [{ text: "選項A", correct: false }, { text: "選項B", correct: true }, { text: "選項C", correct: false }] } },
      { pageType: "text_verify", config: { question: "輸入解密後的密碼", answers: ["密碼", "PASSWORD"] } },
    ],
  },
  {
    id: "branching_story",
    label: "分支劇情",
    description: "對話劇情 + 選擇分支 + 結果展示",
    icon: ArrowRight,
    color: "bg-indigo-500/20 text-indigo-400",
    pages: [
      { pageType: "dialogue", config: { character: { name: "神秘人" }, messages: [{ text: "你想知道真相嗎？" }, { text: "選擇你的道路..." }] } },
      { pageType: "button", config: { prompt: "你的選擇將決定命運", buttons: [{ text: "追尋真相", rewardPoints: 10 }, { text: "保持距離", rewardPoints: 5 }] } },
      { pageType: "text_card", config: { title: "命運已定", content: "你的選擇將帶來不同的結果..." } },
    ],
  },
];

interface DragItem {
  type: string;
  id: string;
  index: number;
}

export default function GameEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const isNew = gameId === "new";
  
  // Detect if we're in admin-staff context or admin context
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  // API paths differ: admin-staff uses /api/admin/*, regular admin uses /api/*
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
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{type: 'video' | 'audio' | 'image', fieldName: string} | null>(null);

  // Media upload handler for Cloudinary
  const handleMediaUpload = useCallback(async (file: File, type: 'video' | 'audio' | 'image'): Promise<string | null> => {
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

      const endpoint = type === 'video' 
        ? '/api/cloudinary/video'
        : type === 'audio' 
          ? '/api/cloudinary/audio' 
          : '/api/cloudinary/game-media';

      const response = await apiRequest("POST", endpoint, {
        data: base64,
        gameId: gameId,
        fileName: file.name,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "上傳失敗");
      }

      const result = await response.json();
      toast({ title: "上傳成功", description: `${type === 'video' ? '影片' : type === 'audio' ? '音訊' : '圖片'}已上傳` });
      return result.url;
    } catch (error: any) {
      toast({ title: "上傳失敗", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [gameId, toast]);

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

  const updatePageIdReferences = (pagesToUpdate: Page[], idMapping: Map<string, string>): Page[] => {
    return pagesToUpdate.map(page => {
      const config = page.config as any;
      if (page.pageType === "button" && config.buttons) {
        const updatedButtons = config.buttons.map((btn: any) => ({
          ...btn,
          nextPageId: btn.nextPageId && idMapping.has(btn.nextPageId) 
            ? idMapping.get(btn.nextPageId) 
            : btn.nextPageId
        }));
        return { ...page, config: { ...config, buttons: updatedButtons } };
      }
      return page;
    });
  };

  const syncPages = async (targetGameId: string, currentPages: Page[], serverPages: Page[]): Promise<Page[]> => {
    const tempIdMapping = new Map<string, string>();
    const serverPageIds = new Set(serverPages.map(p => p.id));
    const currentPageIds = new Set(currentPages.map(p => p.id));
    
    const pagesToCreate = currentPages.filter(p => p.id.startsWith("temp-"));
    const pagesToUpdate = currentPages.filter(p => !p.id.startsWith("temp-") && serverPageIds.has(p.id));
    const pagesToDelete = serverPages.filter(p => !currentPageIds.has(p.id));
    
    for (const page of pagesToDelete) {
      await apiRequest("DELETE", `${apiPagesPath}/${page.id}`);
    }
    
    const createdPages: Page[] = [];
    for (const page of pagesToCreate) {
      const tempId = page.id;
      const response = await apiRequest("POST", `${apiGamesPath}/${targetGameId}/pages`, {
        pageType: page.pageType,
        pageOrder: page.pageOrder,
        config: page.config,
      });
      const createdPage = await response.json();
      tempIdMapping.set(tempId, createdPage.id);
      createdPages.push(createdPage);
    }
    
    let allPages = [
      ...currentPages.filter(p => !p.id.startsWith("temp-")),
      ...createdPages
    ];
    
    allPages = updatePageIdReferences(allPages, tempIdMapping);
    
    for (const page of pagesToUpdate) {
      const updatedConfig = allPages.find(p => p.id === page.id)?.config || page.config;
      await apiRequest("PATCH", `${apiPagesPath}/${page.id}`, {
        pageType: page.pageType,
        pageOrder: page.pageOrder,
        config: updatedConfig,
      });
    }
    
    for (const page of createdPages) {
      const updatedPage = allPages.find(p => p.id === page.id);
      if (updatedPage) {
        await apiRequest("PATCH", `${apiPagesPath}/${page.id}`, {
          config: updatedPage.config,
        });
      }
    }
    
    return allPages;
  };

  const saveGameMutation = useMutation({
    mutationFn: async (data: any) => {
      let targetGameId = gameId;
      
      if (isNew) {
        const response = await apiRequest("POST", apiGamesPath, data);
        const newGame = await response.json();
        targetGameId = newGame.id;
        
        const syncedPages = await syncPages(targetGameId, pages, []);
        return { game: newGame, pages: syncedPages };
      } else {
        await apiRequest("PATCH", `${apiGamesPath}/${gameId}`, data);
        
        const serverPagesResponse = await apiRequest("GET", `${apiGamesPath}/${gameId}/pages`);
        const serverPages = await serverPagesResponse.json();
        
        const syncedPages = await syncPages(gameId!, pages, serverPages);
        return { game: null, pages: syncedPages };
      }
    },
    onSuccess: (result) => {
      toast({ title: "已儲存", description: "遊戲已成功儲存" });
      queryClient.invalidateQueries({ queryKey: [apiGamesPath] });
      
      if (result?.pages) {
        setPages(result.pages);
        if (selectedPage) {
          const updatedSelectedPage = result.pages.find(p => 
            p.id === selectedPage.id || 
            (selectedPage.id.startsWith("temp-") && p.pageOrder === selectedPage.pageOrder)
          );
          if (updatedSelectedPage) {
            setSelectedPage(updatedSelectedPage);
          }
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
      title,
      description,
      difficulty,
      estimatedTime,
      maxPlayers,
      status: "draft",
    });
  };

  const handlePublish = () => {
    saveGameMutation.mutate({
      title,
      description,
      difficulty,
      estimatedTime,
      maxPlayers,
      status: "published",
    });
  };

  const addPage = (pageType: string, atIndex?: number) => {
    const newPage: Page = {
      id: `temp-${Date.now()}`,
      gameId: gameId || "",
      pageOrder: (atIndex ?? pages.length) + 1,
      pageType,
      config: getDefaultConfig(pageType),
      createdAt: new Date(),
    };
    
    if (atIndex !== undefined) {
      const newPages = [...pages];
      newPages.splice(atIndex, 0, newPage);
      newPages.forEach((p, i) => p.pageOrder = i + 1);
      setPages(newPages);
    } else {
      setPages([...pages, newPage]);
    }
    setSelectedPage(newPage);
    toast({ title: "已新增頁面", description: `${getPageTypeInfo(pageType).label}` });
  };

  const addTemplatePages = (templateId: string) => {
    const template = PAGE_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;

    const newPages: Page[] = template.pages.map((p, idx) => ({
      id: `temp-${Date.now()}-${idx}`,
      gameId: gameId || "",
      pageOrder: pages.length + idx + 1,
      pageType: p.pageType,
      config: p.config,
      createdAt: new Date(),
    }));

    setPages([...pages, ...newPages]);
    if (newPages.length > 0) {
      setSelectedPage(newPages[0]);
    }
    toast({ 
      title: "已套用模板", 
      description: `${template.label} - 新增 ${newPages.length} 個頁面` 
    });
  };

  const getDefaultConfig = (pageType: string): any => {
    switch (pageType) {
      case "text_card":
        return { title: "新標題", content: "在這裡輸入內容..." };
      case "dialogue":
        return { 
          character: { name: "角色名稱" }, 
          messages: [{ text: "對話內容..." }] 
        };
      case "button":
        return { 
          prompt: "請選擇一個選項",
          buttons: [
            { text: "選項 1", nextPageId: undefined, rewardPoints: 0 }, 
            { text: "選項 2", nextPageId: undefined, rewardPoints: 0 }
          ] 
        };
      case "text_verify":
        return { question: "問題?", answers: ["答案"] };
      case "choice_verify":
        return { 
          question: "問題?", 
          options: [
            { text: "選項 A", correct: true },
            { text: "選項 B", correct: false },
          ] 
        };
      case "conditional_verify":
        return {
          title: "碎片收集",
          instruction: "收集所有碎片，組成正確的密碼",
          fragmentType: "numbers",
          fragmentCount: 4,
          fragments: [
            { id: "f1", label: "碎片 1/4", value: "1", order: 1 },
            { id: "f2", label: "碎片 2/4", value: "2", order: 2 },
            { id: "f3", label: "碎片 3/4", value: "3", order: 3 },
            { id: "f4", label: "碎片 4/4", value: "4", order: 4 },
          ],
          targetCode: "1234",
          verificationMode: "order_matters",
          rewardPoints: 30
        };
      case "shooting_mission":
        return { requiredHits: 5, timeLimit: 60 };
      case "photo_mission":
        return { instruction: "請拍攝..." };
      case "gps_mission":
        return { 
          targetLocation: { lat: 25.033, lng: 121.565 }, 
          radius: 50,
          instruction: "前往目標位置" 
        };
      case "qr_scan":
        return { qrCodeId: "QR-001" };
      case "time_bomb":
        return { 
          title: "拆彈任務", 
          timeLimit: 60, 
          tasks: [
            { type: "tap", question: "快速點擊按鈕!", targetCount: 10 }
          ]
        };
      case "lock":
        return { 
          title: "密碼鎖", 
          lockType: "number", 
          combination: "1234", 
          digits: 4,
          maxAttempts: 5 
        };
      case "motion_challenge":
        return { 
          title: "體感挑戰", 
          challengeType: "shake", 
          targetValue: 20,
          timeLimit: 30 
        };
      case "vote":
        return {
          title: "隊伍投票",
          question: "請選擇你的答案",
          options: [
            { text: "選項一" },
            { text: "選項二" }
          ],
          showResults: true,
          anonymousVoting: true
        };
      default:
        return {};
    }
  };

  const handleReorder = (newPages: Page[]) => {
    newPages.forEach((p, i) => p.pageOrder = i + 1);
    setPages(newPages);
  };

  const deletePage = (index: number) => {
    const newPages = pages.filter((_, i) => i !== index);
    newPages.forEach((p, i) => p.pageOrder = i + 1);
    setPages(newPages);
    if (selectedPage?.id === pages[index].id) {
      setSelectedPage(null);
    }
  };

  const duplicatePage = (index: number) => {
    const pageToCopy = pages[index];
    const newPage: Page = {
      ...pageToCopy,
      id: `temp-${Date.now()}`,
      pageOrder: index + 2,
    };
    const newPages = [...pages];
    newPages.splice(index + 1, 0, newPage);
    newPages.forEach((p, i) => p.pageOrder = i + 1);
    setPages(newPages);
    toast({ title: "已複製頁面" });
  };

  const getPageTypeInfo = (type: string) => {
    return PAGE_TYPES.find(t => t.value === type) || { label: type, icon: FileText, color: "bg-gray-500/20 text-gray-400" };
  };

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
    if (isDraggingFromToolbox) {
      setDragOverIndex(index);
    }
  };

  const handlePageListDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const pageType = e.dataTransfer.getData("pageType");
    if (pageType) {
      addPage(pageType, index);
    }
    setDragOverIndex(null);
    setIsDraggingFromToolbox(false);
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pageType = e.dataTransfer.getData("pageType");
    if (pageType) {
      addPage(pageType);
    }
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
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation(basePath)}
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="遊戲標題"
                className="font-display font-bold text-lg border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                data-testid="input-game-title"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setLocation(`/game/${gameId}`)}
              className="gap-2"
              disabled={isNew}
              data-testid="button-preview"
            >
              <Eye className="w-4 h-4" />
              預覽
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSave}
              disabled={saveGameMutation.isPending}
              className="gap-2"
              data-testid="button-save"
            >
              <Save className="w-4 h-4" />
              儲存
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={saveGameMutation.isPending}
              className="gap-2"
              data-testid="button-publish"
            >
              <Upload className="w-4 h-4" />
              發布
            </Button>
          </div>
        </div>
        
        {!isNew && (
          <div className="px-4 py-2 border-t border-border/50 flex items-center gap-2 bg-muted/30">
            <span className="text-xs text-muted-foreground mr-2">資源管理:</span>
            <Link href={`${basePath}/${gameId}/items`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-items">
                <Package className="w-3.5 h-3.5" />
                道具
              </Button>
            </Link>
            <Link href={`${basePath}/${gameId}/achievements`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-achievements">
                <Trophy className="w-3.5 h-3.5" />
                成就
              </Button>
            </Link>
            <Link href={`${basePath}/${gameId}/locations`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-locations">
                <MapPin className="w-3.5 h-3.5" />
                地點
              </Button>
            </Link>
            <Link href={`${basePath}/${gameId}/settings`}>
              <Button variant="ghost" size="sm" className="gap-2 h-7" data-testid="link-settings">
                <Settings className="w-3.5 h-3.5" />
                設定
              </Button>
            </Link>
          </div>
        )}
      </header>

      <div className="flex-1 flex">
        <aside className="w-56 border-r border-border bg-card/50 flex flex-col">
          <Tabs defaultValue="elements" className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="elements" className="flex-1 text-xs">
                <Move className="w-3 h-3 mr-1" />
                元件
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex-1 text-xs">
                <Gift className="w-3 h-3 mr-1" />
                模板
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="elements" className="flex-1 overflow-auto p-2 space-y-1 m-0">
              {PAGE_TYPES.map((type) => (
                <motion.div
                  key={type.value}
                  draggable
                  onDragStart={(e) => handleToolboxDragStart(e as unknown as React.DragEvent, type.value)}
                  onDragEnd={handleToolboxDragEnd}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-grab active:cursor-grabbing ${type.color} border border-transparent hover:border-border/50 transition-all`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`toolbox-${type.value}`}
                >
                  <type.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{type.label}</span>
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-auto p-2 space-y-2 m-0">
              {PAGE_TEMPLATES.map((template) => (
                <motion.button
                  key={template.id}
                  onClick={() => addTemplatePages(template.id)}
                  className={`w-full text-left p-2 rounded-lg ${template.color} border border-transparent hover:border-border/50 transition-all`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  data-testid={`template-${template.id}`}
                >
                  <div className="flex items-center gap-2">
                    <template.icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{template.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{template.description}</p>
                </motion.button>
              ))}
            </TabsContent>
          </Tabs>
        </aside>

        <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-medium text-sm">頁面流程</h3>
              <p className="text-xs text-muted-foreground">{pages.length} 個頁面</p>
            </div>
            <Badge variant="outline" className="text-xs">
              拖曳排序
            </Badge>
          </div>
          
          <div 
            className="flex-1 overflow-auto p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDropZoneDrop}
          >
            <Reorder.Group 
              axis="y" 
              values={pages} 
              onReorder={handleReorder}
              className="space-y-1"
            >
              <AnimatePresence>
                {pages.map((page, index) => {
                  const typeInfo = getPageTypeInfo(page.pageType);
                  return (
                    <div key={page.id}>
                      {dragOverIndex === index && isDraggingFromToolbox && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 40 }}
                          className="border-2 border-dashed border-primary/50 rounded-lg bg-primary/10 flex items-center justify-center text-xs text-primary mb-1"
                        >
                          放置於此
                        </motion.div>
                      )}
                      <Reorder.Item
                        value={page}
                        className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                          selectedPage?.id === page.id 
                            ? "bg-primary/10 border border-primary/30" 
                            : "bg-background/50 hover:bg-accent border border-transparent"
                        }`}
                        onClick={() => setSelectedPage(page)}
                        onDragOver={(e) => handlePageListDragOver(e as unknown as React.DragEvent, index)}
                        onDrop={(e) => handlePageListDrop(e as unknown as React.DragEvent, index)}
                        whileDrag={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}
                        data-testid={`page-item-${index}`}
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${typeInfo.color}`}>
                          <typeInfo.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{typeInfo.label}</p>
                          <p className="text-xs text-muted-foreground font-mono">#{index + 1}</p>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6"
                            onClick={(e) => { e.stopPropagation(); duplicatePage(index); }}
                            data-testid={`button-duplicate-${index}`}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); deletePage(index); }}
                            data-testid={`button-delete-${index}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </Reorder.Item>
                    </div>
                  );
                })}
              </AnimatePresence>
            </Reorder.Group>

            {pages.length === 0 && (
              <motion.div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDraggingFromToolbox 
                    ? "border-primary bg-primary/10" 
                    : "border-border"
                }`}
                animate={{ scale: isDraggingFromToolbox ? 1.02 : 1 }}
              >
                <Plus className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  從左側拖曳元件到此處
                </p>
              </motion.div>
            )}

            {pages.length > 0 && isDraggingFromToolbox && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 60 }}
                className="border-2 border-dashed border-primary/50 rounded-lg bg-primary/10 flex items-center justify-center text-sm text-primary mt-2"
                onDragOver={(e) => e.preventDefault()}
              >
                放置於最後
              </motion.div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          <Tabs defaultValue="page" className="h-full">
            <div className="px-6 py-4 border-b border-border">
              <TabsList>
                <TabsTrigger value="page" data-testid="tab-page">頁面設定</TabsTrigger>
                <TabsTrigger value="game" data-testid="tab-game">遊戲設定</TabsTrigger>
                <TabsTrigger value="items" data-testid="tab-items">道具</TabsTrigger>
                <TabsTrigger value="events" data-testid="tab-events">事件</TabsTrigger>
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
                        const newPages = pages.map(p => 
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
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="描述這個遊戲..."
                      rows={4}
                      data-testid="input-description"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">難度</label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
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

                    <div>
                      <label className="text-sm font-medium mb-2 block">預估時間 (分鐘)</label>
                      <Input
                        type="number"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 30)}
                        min={5}
                        max={180}
                        data-testid="input-time"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">最大人數</label>
                      <Input
                        type="number"
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 6)}
                        min={1}
                        max={20}
                        data-testid="input-players"
                      />
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
          </Tabs>
        </main>
      </div>
    </div>
  );
}

function PageConfigEditor({ page, allPages, gameId, handleMediaUpload, isUploading, onUpdate }: { 
  page: Page; 
  allPages: Page[]; 
  gameId: string; 
  handleMediaUpload: (file: File, type: 'video' | 'audio' | 'image') => Promise<string | null>;
  isUploading: boolean;
  onUpdate: (config: any) => void;
}) {
  const config = page.config as any;

  const updateField = (field: string, value: any) => {
    onUpdate({ ...config, [field]: value });
  };

  const RewardsSection = () => (
    <div className="pt-4 mt-4 border-t border-border">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Gift className="w-4 h-4" />
        完成獎勵
      </h4>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-2 block">獎勵分數</label>
          <Input
            type="number"
            value={config.rewardPoints || 0}
            onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 0)}
            min={0}
            max={1000}
            data-testid="config-reward-points"
          />
        </div>
        <ItemRewardPicker
          gameId={gameId}
          selectedItems={config.rewardItems || []}
          onChange={(items) => updateField("rewardItems", items)}
          maxItems={3}
        />
      </div>
    </div>
  );

  const LocationSettingsSection = () => {
    const locationSettings = config.locationSettings || { enabled: false };
    
    const updateLocationSettings = (field: string, value: any) => {
      updateField("locationSettings", {
        ...locationSettings,
        [field]: value
      });
    };

    return (
      <div className="pt-4 mt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            地圖定位設置
          </h4>
          <Switch
            checked={locationSettings.enabled || false}
            onCheckedChange={(checked) => updateLocationSettings("enabled", checked)}
            data-testid="config-location-enabled"
          />
        </div>
        
        {locationSettings.enabled && (
          <div className="space-y-4 animate-in fade-in-50">
            <div className="flex items-center gap-2 mb-2">
              <Checkbox
                id="showOnMap"
                checked={locationSettings.showOnMap !== false}
                onCheckedChange={(checked) => updateLocationSettings("showOnMap", checked)}
              />
              <label htmlFor="showOnMap" className="text-sm">在地圖上顯示標記</label>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">地點名稱</label>
              <Input
                value={locationSettings.locationName || ""}
                onChange={(e) => updateLocationSettings("locationName", e.target.value)}
                placeholder="輸入地點名稱"
                data-testid="config-location-name"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">緯度</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={locationSettings.latitude || ""}
                  onChange={(e) => updateLocationSettings("latitude", parseFloat(e.target.value) || null)}
                  placeholder="24.4369"
                  data-testid="config-location-lat"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">經度</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={locationSettings.longitude || ""}
                  onChange={(e) => updateLocationSettings("longitude", parseFloat(e.target.value) || null)}
                  placeholder="118.3179"
                  data-testid="config-location-lng"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">觸發範圍 (公尺)</label>
              <Input
                type="number"
                value={locationSettings.radius || 50}
                onChange={(e) => updateLocationSettings("radius", parseInt(e.target.value) || 50)}
                min={5}
                max={500}
                data-testid="config-location-radius"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">導航指示</label>
              <Input
                value={locationSettings.instructions || ""}
                onChange={(e) => updateLocationSettings("instructions", e.target.value)}
                placeholder="請前往此地點完成任務"
                data-testid="config-location-instructions"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">圖標類型</label>
              <Select
                value={locationSettings.iconType || "default"}
                onValueChange={(value) => updateLocationSettings("iconType", value)}
              >
                <SelectTrigger data-testid="config-location-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">預設</SelectItem>
                  <SelectItem value="qr">QR 掃描</SelectItem>
                  <SelectItem value="photo">拍照</SelectItem>
                  <SelectItem value="shooting">射擊</SelectItem>
                  <SelectItem value="gps">GPS 定位</SelectItem>
                  <SelectItem value="puzzle">謎題</SelectItem>
                  <SelectItem value="star">星標</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
    );
  };

  switch (page.pageType) {
    case "text_card":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="輸入標題"
              data-testid="config-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">內容</label>
            <Textarea
              value={config.content || ""}
              onChange={(e) => updateField("content", e.target.value)}
              placeholder="輸入內容..."
              rows={6}
              data-testid="config-content"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">背景圖片 (可選)</label>
            <div className="flex gap-2">
              <Input
                value={config.backgroundImage || ""}
                onChange={(e) => updateField("backgroundImage", e.target.value)}
                placeholder="https://..."
                data-testid="config-background-image"
                className="flex-1"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="textcard-image-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'image');
                    if (url) {
                      updateField("backgroundImage", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('textcard-image-upload')?.click()}
                data-testid="button-upload-textcard-image"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
            </div>
            {config.backgroundImage && (
              <div className="mt-2">
                <img 
                  src={config.backgroundImage} 
                  alt="背景預覽" 
                  className="w-full rounded-lg max-h-32 object-cover"
                  data-testid="image-preview"
                />
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">佈局樣式</label>
            <Select
              value={config.layout || "center"}
              onValueChange={(value) => updateField("layout", value)}
            >
              <SelectTrigger data-testid="select-layout">
                <SelectValue placeholder="選擇佈局" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="center">置中</SelectItem>
                <SelectItem value="image_top">圖片在上</SelectItem>
                <SelectItem value="image_left">圖片在左</SelectItem>
                <SelectItem value="fullscreen">全螢幕</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">背景音訊 (可選)</label>
            <div className="flex gap-2">
              <Input
                value={config.backgroundAudio || ""}
                onChange={(e) => updateField("backgroundAudio", e.target.value)}
                placeholder="https://..."
                data-testid="config-background-audio"
                className="flex-1"
              />
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                id="textcard-audio-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'audio');
                    if (url) {
                      updateField("backgroundAudio", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('textcard-audio-upload')?.click()}
                data-testid="button-upload-audio"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
            </div>
            {config.backgroundAudio && (
              <div className="mt-2">
                <audio 
                  src={config.backgroundAudio} 
                  controls 
                  className="w-full"
                  data-testid="audio-preview"
                />
              </div>
            )}
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "dialogue":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">角色名稱</label>
            <Input
              value={config.character?.name || ""}
              onChange={(e) => updateField("character", { ...config.character, name: e.target.value })}
              placeholder="角色名稱"
              data-testid="config-character"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">角色頭像 (可選)</label>
            <div className="flex gap-2 items-center">
              {config.character?.avatar && (
                <img 
                  src={config.character.avatar} 
                  alt="頭像" 
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <Input
                value={config.character?.avatar || ""}
                onChange={(e) => updateField("character", { ...config.character, avatar: e.target.value })}
                placeholder="https://..."
                data-testid="config-avatar-url"
                className="flex-1"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="dialogue-avatar-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'image');
                    if (url) {
                      updateField("character", { ...config.character, avatar: url });
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('dialogue-avatar-upload')?.click()}
                data-testid="button-upload-avatar"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">對話內容</label>
            <Textarea
              value={config.messages?.[0]?.text || ""}
              onChange={(e) => updateField("messages", [{ text: e.target.value }])}
              placeholder="對話內容..."
              rows={4}
              data-testid="config-dialogue"
            />
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "shooting_mission":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">需要命中次數</label>
            <Input
              type="number"
              value={config.requiredHits || 5}
              onChange={(e) => updateField("requiredHits", parseInt(e.target.value) || 5)}
              min={1}
              max={100}
              data-testid="config-hits"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
            <Input
              type="number"
              value={config.timeLimit || 60}
              onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 60)}
              min={10}
              max={300}
              data-testid="config-timelimit"
            />
          </div>
          <RewardsSection />
          <LocationSettingsSection />
        </div>
      );

    case "photo_mission":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">拍照指示</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="請拍攝..."
              rows={4}
              data-testid="config-instruction"
            />
          </div>
          <RewardsSection />
          <LocationSettingsSection />
        </div>
      );

    case "gps_mission":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">目標位置</label>
            <LocationPicker
              lat={config.targetLocation?.lat || 25.033}
              lng={config.targetLocation?.lng || 121.565}
              radius={config.radius || 50}
              onChange={(lat, lng) => updateField("targetLocation", { lat, lng })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">緯度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.targetLocation?.lat || 25.033}
                onChange={(e) => updateField("targetLocation", { 
                  ...config.targetLocation, 
                  lat: parseFloat(e.target.value) 
                })}
                data-testid="config-lat"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">經度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.targetLocation?.lng || 121.565}
                onChange={(e) => updateField("targetLocation", { 
                  ...config.targetLocation, 
                  lng: parseFloat(e.target.value) 
                })}
                data-testid="config-lng"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">觸發半徑 (公尺)</label>
            <Input
              type="number"
              value={config.radius || 50}
              onChange={(e) => updateField("radius", parseInt(e.target.value) || 50)}
              min={5}
              max={500}
              data-testid="config-radius"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">任務指示</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="前往目標位置"
              rows={2}
              data-testid="config-gps-instruction"
            />
          </div>
          <RewardsSection />
        </div>
      );

    case "qr_scan":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">驗證代碼 (主要)</label>
            <Input
              value={config.primaryCode || config.qrCodeId || ""}
              onChange={(e) => {
                updateField("primaryCode", e.target.value);
                updateField("qrCodeId", e.target.value);
              }}
              placeholder="JC-LOC-001"
              data-testid="config-primary-code"
            />
            <p className="text-xs text-muted-foreground mt-1">
              玩家掃描 QR Code 後必須匹配的代碼
            </p>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">驗證模式</label>
            <Select
              value={config.validationMode || "case_insensitive"}
              onValueChange={(value) => updateField("validationMode", value)}
            >
              <SelectTrigger data-testid="select-validation-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="case_insensitive">不區分大小寫（預設）</SelectItem>
                <SelectItem value="exact">精確匹配</SelectItem>
                <SelectItem value="location_id">位置 ID 模式</SelectItem>
                <SelectItem value="regex">正則表達式</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {config.validationMode === 'exact' && '區分大小寫的精確匹配'}
              {config.validationMode === 'regex' && '使用正則表達式進行模式匹配'}
              {config.validationMode === 'location_id' && '只比較數字部分（如 JC-LOC-001 只比較 001）'}
              {(!config.validationMode || config.validationMode === 'case_insensitive') && '忽略大小寫進行匹配'}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">備用代碼 (可選)</label>
            <Textarea
              value={(config.alternativeCodes || []).join("\n")}
              onChange={(e) => updateField("alternativeCodes", e.target.value.split("\n").filter((s: string) => s.trim()))}
              placeholder="每行一個備用代碼"
              rows={2}
              data-testid="config-alt-codes"
            />
            <p className="text-xs text-muted-foreground mt-1">
              額外可接受的代碼，每行一個
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">掃描指示</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="請掃描檢查站的 QR Code"
              rows={2}
              data-testid="config-qr-instruction"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">位置提示 (可選)</label>
            <Input
              value={config.locationHint || ""}
              onChange={(e) => updateField("locationHint", e.target.value)}
              placeholder="在大門旁邊的柱子上"
              data-testid="config-location-hint"
            />
          </div>

          <QRCodeGenerator
            qrCodeId={config.primaryCode || config.qrCodeId || ""}
            gameId={gameId}
            pageId={page.id}
          />
          <RewardsSection />
          <LocationSettingsSection />
        </div>
      );

    case "text_verify":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">問題</label>
            <Input
              value={config.question || ""}
              onChange={(e) => updateField("question", e.target.value)}
              placeholder="輸入問題"
              data-testid="config-question"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">正確答案 (多個用逗號分隔)</label>
            <Input
              value={(config.answers || []).join(", ")}
              onChange={(e) => updateField("answers", e.target.value.split(",").map((s: string) => s.trim()))}
              placeholder="答案1, 答案2"
              data-testid="config-answers"
            />
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "choice_verify":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">問題</label>
            <Input
              value={config.question || ""}
              onChange={(e) => updateField("question", e.target.value)}
              placeholder="輸入問題"
              data-testid="config-choice-question"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">選項設定</label>
            <div className="space-y-2">
              {(config.options || []).map((opt: any, i: number) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input
                    value={opt.text || ""}
                    onChange={(e) => {
                      const newOptions = [...config.options];
                      newOptions[i] = { ...newOptions[i], text: e.target.value };
                      updateField("options", newOptions);
                    }}
                    placeholder={`選項 ${i + 1}`}
                    className="flex-1"
                    data-testid={`config-option-${i}`}
                  />
                  <Badge 
                    variant={opt.correct ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      const newOptions = [...config.options];
                      newOptions[i] = { ...newOptions[i], correct: !newOptions[i].correct };
                      updateField("options", newOptions);
                    }}
                  >
                    {opt.correct ? "正確" : "錯誤"}
                  </Badge>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateField("options", [...(config.options || []), { text: "", correct: false }]);
                }}
                data-testid="button-add-option"
              >
                <Plus className="w-4 h-4 mr-1" />
                新增選項
              </Button>
            </div>
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "conditional_verify":
      const fragments = config.fragments || [];
      const updateFragments = (newFragments: any[]) => {
        updateField("fragments", newFragments);
        if (config.fragmentType !== 'custom') {
          const targetCode = newFragments.map((f: any) => f.value).join('');
          updateField("targetCode", targetCode);
        }
      };
      
      const generateFragments = (type: string, count: number) => {
        const newFragments = [];
        for (let i = 0; i < count; i++) {
          let value = '';
          if (type === 'numbers') {
            value = String(Math.floor(Math.random() * 10));
          } else if (type === 'letters') {
            value = String.fromCharCode(65 + Math.floor(Math.random() * 26));
          }
          newFragments.push({
            id: `f${i + 1}`,
            label: `碎片 ${i + 1}/${count}`,
            value,
            order: i + 1
          });
        }
        return newFragments;
      };

      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="碎片收集任務"
              data-testid="config-fragment-title"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">任務說明</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="收集所有碎片，組成正確的密碼"
              rows={2}
              data-testid="config-fragment-instruction"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">碎片類型</label>
              <Select
                value={config.fragmentType || "numbers"}
                onValueChange={(value) => {
                  updateField("fragmentType", value);
                  const newFragments = generateFragments(value, config.fragmentCount || 4);
                  updateFragments(newFragments);
                }}
              >
                <SelectTrigger data-testid="config-fragment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numbers">數字碎片 (0-9)</SelectItem>
                  <SelectItem value="letters">字母碎片 (A-Z)</SelectItem>
                  <SelectItem value="custom">自定義內容</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">碎片數量</label>
              <Input
                type="number"
                value={config.fragmentCount || 4}
                onChange={(e) => {
                  const count = Math.max(2, Math.min(10, parseInt(e.target.value) || 4));
                  updateField("fragmentCount", count);
                  const newFragments = generateFragments(config.fragmentType || 'numbers', count);
                  updateFragments(newFragments);
                }}
                min={2}
                max={10}
                data-testid="config-fragment-count"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">驗證模式</label>
            <Select
              value={config.verificationMode || "order_matters"}
              onValueChange={(value) => updateField("verificationMode", value)}
            >
              <SelectTrigger data-testid="config-verification-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="order_matters">順序重要（依照順序輸入）</SelectItem>
                <SelectItem value="order_independent">順序不重要（只需全部收集）</SelectItem>
                <SelectItem value="all_collected">只需確認收集（無需輸入）</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <Puzzle className="w-4 h-4" />
              碎片配置
              <Badge variant="secondary" className="text-xs">{fragments.length} 個碎片</Badge>
            </label>
            <div className="space-y-2">
              {fragments.map((fragment: any, i: number) => (
                <div key={fragment.id || i} className="flex gap-2 items-center bg-accent/30 rounded-lg p-2">
                  <div className="flex-shrink-0 w-16 text-center">
                    <Badge variant="outline" className="text-xs">碎片 {i + 1}</Badge>
                  </div>
                  <Input
                    value={fragment.value || ""}
                    onChange={(e) => {
                      const newFragments = [...fragments];
                      newFragments[i] = { ...newFragments[i], value: e.target.value };
                      updateFragments(newFragments);
                    }}
                    placeholder={config.fragmentType === 'numbers' ? '0-9' : config.fragmentType === 'letters' ? 'A-Z' : '內容'}
                    className="w-20 text-center font-mono"
                    maxLength={config.fragmentType === 'custom' ? 10 : 1}
                    data-testid={`config-fragment-value-${i}`}
                  />
                  <Input
                    value={fragment.label || ""}
                    onChange={(e) => {
                      const newFragments = [...fragments];
                      newFragments[i] = { ...newFragments[i], label: e.target.value };
                      updateField("fragments", newFragments);
                    }}
                    placeholder="碎片標籤"
                    className="flex-1"
                    data-testid={`config-fragment-label-${i}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">目標密碼</label>
            <Input
              value={config.targetCode || ""}
              onChange={(e) => updateField("targetCode", e.target.value)}
              placeholder="自動生成或手動設定"
              className="font-mono"
              data-testid="config-target-code"
            />
            <p className="text-xs text-muted-foreground mt-1">
              玩家需要收集碎片並組成此密碼。如果留空，將自動根據碎片值生成。
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">獎勵分數</label>
            <Input
              type="number"
              value={config.rewardPoints || 0}
              onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 0)}
              min={0}
              max={1000}
              data-testid="config-fragment-reward"
            />
          </div>
          
          <LocationSettingsSection />
        </div>
      );

    case "button":
      return (
        <div className="space-y-4">
          <ButtonConfigEditor config={config} updateField={updateField} allPages={allPages} />
          <LocationSettingsSection />
        </div>
      );

    case "video":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">影片 URL</label>
            <div className="flex gap-2">
              <Input
                value={config.videoUrl || ""}
                onChange={(e) => updateField("videoUrl", e.target.value)}
                placeholder="https://..."
                data-testid="config-video-url"
                className="flex-1"
              />
              <input
                type="file"
                accept="video/*"
                className="hidden"
                id="video-upload-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = await handleMediaUpload(file, 'video');
                    if (url) {
                      updateField("videoUrl", url);
                    }
                  }
                  e.target.value = '';
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={isUploading}
                onClick={() => document.getElementById('video-upload-input')?.click()}
                data-testid="button-upload-video"
              >
                {isUploading ? (
                  <span className="animate-spin">⏳</span>
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">支援上傳影片或輸入 Cloudinary URL</p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="影片標題"
              data-testid="config-video-title"
            />
          </div>
          {config.videoUrl && (
            <div>
              <label className="text-sm font-medium mb-2 block">預覽</label>
              <video 
                src={config.videoUrl} 
                controls 
                className="w-full rounded-lg max-h-48"
                data-testid="video-preview"
              />
            </div>
          )}
          <LocationSettingsSection />
        </div>
      );

    case "time_bomb":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="拆彈任務"
              data-testid="config-bomb-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
            <Input
              type="number"
              value={config.timeLimit || 60}
              onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 60)}
              min={10}
              max={300}
              data-testid="config-bomb-time"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">任務說明</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="在時間內完成所有任務來拆除炸彈!"
              rows={2}
              data-testid="config-bomb-instruction"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-3 block flex items-center gap-2">
              任務列表
              <Badge variant="secondary" className="text-xs">{(config.tasks || []).length} 個任務</Badge>
            </label>
            <div className="space-y-2">
              {(config.tasks || []).map((task: any, i: number) => (
                <div key={i} className="bg-accent/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <Badge variant="outline">任務 {i + 1}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newTasks = config.tasks.filter((_: any, idx: number) => idx !== i);
                        updateField("tasks", newTasks);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <Select
                    value={task.type || "tap"}
                    onValueChange={(value) => {
                      const newTasks = [...config.tasks];
                      newTasks[i] = { ...newTasks[i], type: value };
                      updateField("tasks", newTasks);
                    }}
                  >
                    <SelectTrigger data-testid={`config-task-type-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tap">快速點擊</SelectItem>
                      <SelectItem value="input">輸入答案</SelectItem>
                      <SelectItem value="choice">選擇題</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={task.question || ""}
                    onChange={(e) => {
                      const newTasks = [...config.tasks];
                      newTasks[i] = { ...newTasks[i], question: e.target.value };
                      updateField("tasks", newTasks);
                    }}
                    placeholder="問題或說明"
                    data-testid={`config-task-question-${i}`}
                  />
                  {task.type === "tap" && (
                    <Input
                      type="number"
                      value={task.targetCount || 10}
                      onChange={(e) => {
                        const newTasks = [...config.tasks];
                        newTasks[i] = { ...newTasks[i], targetCount: parseInt(e.target.value) || 10 };
                        updateField("tasks", newTasks);
                      }}
                      placeholder="目標點擊次數"
                      data-testid={`config-task-count-${i}`}
                    />
                  )}
                  {task.type === "input" && (
                    <Input
                      value={task.answer || ""}
                      onChange={(e) => {
                        const newTasks = [...config.tasks];
                        newTasks[i] = { ...newTasks[i], answer: e.target.value };
                        updateField("tasks", newTasks);
                      }}
                      placeholder="正確答案"
                      data-testid={`config-task-answer-${i}`}
                    />
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  updateField("tasks", [...(config.tasks || []), { type: "tap", question: "", targetCount: 10 }]);
                }}
                data-testid="button-add-task"
              >
                <Plus className="w-4 h-4 mr-1" />
                新增任務
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">成功訊息</label>
              <Input
                value={config.successMessage || ""}
                onChange={(e) => updateField("successMessage", e.target.value)}
                placeholder="炸彈已拆除!"
                data-testid="config-bomb-success"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">失敗訊息</label>
              <Input
                value={config.failureMessage || ""}
                onChange={(e) => updateField("failureMessage", e.target.value)}
                placeholder="時間到!"
                data-testid="config-bomb-failure"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">獎勵分數</label>
            <Input
              type="number"
              value={config.rewardPoints || 50}
              onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 50)}
              min={0}
              data-testid="config-bomb-points"
            />
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "lock":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="密碼鎖"
              data-testid="config-lock-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">鎖類型</label>
            <Select
              value={config.lockType || "number"}
              onValueChange={(value) => updateField("lockType", value)}
            >
              <SelectTrigger data-testid="config-lock-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="number">數字鎖</SelectItem>
                <SelectItem value="letter">字母鎖</SelectItem>
                <SelectItem value="dial">轉盤鎖</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">密碼組合</label>
            <Input
              value={config.combination || ""}
              onChange={(e) => updateField("combination", e.target.value)}
              placeholder={config.lockType === "letter" ? "ABCD" : "1234"}
              data-testid="config-lock-code"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">位數</label>
              <Input
                type="number"
                value={config.digits || 4}
                onChange={(e) => updateField("digits", parseInt(e.target.value) || 4)}
                min={2}
                max={8}
                data-testid="config-lock-digits"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">最大嘗試次數</label>
              <Input
                type="number"
                value={config.maxAttempts || 5}
                onChange={(e) => updateField("maxAttempts", parseInt(e.target.value) || 5)}
                min={1}
                max={20}
                data-testid="config-lock-attempts"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">提示</label>
            <Textarea
              value={config.hint || ""}
              onChange={(e) => updateField("hint", e.target.value)}
              placeholder="可選的密碼提示..."
              rows={2}
              data-testid="config-lock-hint"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">說明</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="解開密碼鎖以繼續..."
              rows={2}
              data-testid="config-lock-instruction"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">獎勵分數</label>
            <Input
              type="number"
              value={config.rewardPoints || 20}
              onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 20)}
              min={0}
              data-testid="config-lock-points"
            />
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "motion_challenge":
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="體感挑戰"
              data-testid="config-motion-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">挑戰類型</label>
            <Select
              value={config.challengeType || "shake"}
              onValueChange={(value) => updateField("challengeType", value)}
            >
              <SelectTrigger data-testid="config-motion-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shake">搖晃手機</SelectItem>
                <SelectItem value="tilt">傾斜手機</SelectItem>
                <SelectItem value="jump">跳躍 (垂直移動)</SelectItem>
                <SelectItem value="rotate">旋轉手機</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">目標值</label>
            <Input
              type="number"
              value={config.targetValue || 20}
              onChange={(e) => updateField("targetValue", parseInt(e.target.value) || 20)}
              min={1}
              max={100}
              data-testid="config-motion-target"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {config.challengeType === "shake" ? "搖晃次數" : 
               config.challengeType === "tilt" || config.challengeType === "rotate" ? "傾斜角度" : "移動次數"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">時間限制 (秒)</label>
            <Input
              type="number"
              value={config.timeLimit || 30}
              onChange={(e) => updateField("timeLimit", parseInt(e.target.value) || 30)}
              min={5}
              max={120}
              data-testid="config-motion-time"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">說明</label>
            <Textarea
              value={config.instruction || ""}
              onChange={(e) => updateField("instruction", e.target.value)}
              placeholder="搖晃你的手機來完成挑戰!"
              rows={2}
              data-testid="config-motion-instruction"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">成功訊息</label>
              <Input
                value={config.successMessage || ""}
                onChange={(e) => updateField("successMessage", e.target.value)}
                placeholder="挑戰成功!"
                data-testid="config-motion-success"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">失敗訊息</label>
              <Input
                value={config.failureMessage || ""}
                onChange={(e) => updateField("failureMessage", e.target.value)}
                placeholder="時間到!"
                data-testid="config-motion-failure"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">獎勵分數</label>
            <Input
              type="number"
              value={config.rewardPoints || 15}
              onChange={(e) => updateField("rewardPoints", parseInt(e.target.value) || 15)}
              min={0}
              data-testid="config-motion-points"
            />
          </div>
          <LocationSettingsSection />
        </div>
      );

    case "vote":
      const voteOptions = config.options || [{ text: "選項一" }, { text: "選項二" }];
      return (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">標題</label>
            <Input
              value={config.title || ""}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="隊伍投票"
              data-testid="config-vote-title"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">投票問題</label>
            <Textarea
              value={config.question || ""}
              onChange={(e) => updateField("question", e.target.value)}
              placeholder="請選擇你的答案"
              rows={2}
              data-testid="config-vote-question"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">投票選項</label>
            <div className="space-y-2">
              {voteOptions.map((opt: { text: string; icon?: string; nextPageId?: string }, idx: number) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const newOpts = [...voteOptions];
                      newOpts[idx] = { ...newOpts[idx], text: e.target.value };
                      updateField("options", newOpts);
                    }}
                    placeholder={`選項 ${idx + 1}`}
                    data-testid={`config-vote-option-${idx}`}
                  />
                  <Select
                    value={opt.nextPageId || "_continue"}
                    onValueChange={(value) => {
                      const newOpts = [...voteOptions];
                      newOpts[idx] = { ...newOpts[idx], nextPageId: value === "_continue" ? undefined : value };
                      updateField("options", newOpts);
                    }}
                  >
                    <SelectTrigger className="w-[140px]" data-testid={`config-vote-option-next-${idx}`}>
                      <SelectValue placeholder="下一頁" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_continue">繼續下一頁</SelectItem>
                      <SelectItem value="_end">結束遊戲</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      const newOpts = voteOptions.filter((_: any, i: number) => i !== idx);
                      updateField("options", newOpts);
                    }}
                    disabled={voteOptions.length <= 2}
                    data-testid={`config-vote-remove-${idx}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateField("options", [...voteOptions, { text: `選項 ${voteOptions.length + 1}` }])}
                data-testid="config-vote-add-option"
              >
                <Plus className="w-4 h-4 mr-1" />
                新增選項
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.showResults ?? true}
                onChange={(e) => updateField("showResults", e.target.checked)}
                id="vote-show-results"
                data-testid="config-vote-show-results"
              />
              <label htmlFor="vote-show-results" className="text-sm">顯示投票結果</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.anonymousVoting ?? true}
                onChange={(e) => updateField("anonymousVoting", e.target.checked)}
                id="vote-anonymous"
                data-testid="config-vote-anonymous"
              />
              <label htmlFor="vote-anonymous" className="text-sm">匿名投票</label>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-2 block">投票時限 (秒，0 = 無限)</label>
              <Input
                type="number"
                value={config.votingTimeLimit || 0}
                onChange={(e) => updateField("votingTimeLimit", parseInt(e.target.value) || 0)}
                min={0}
                max={300}
                data-testid="config-vote-time-limit"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">最少投票數</label>
              <Input
                type="number"
                value={config.minVotes || 1}
                onChange={(e) => updateField("minVotes", parseInt(e.target.value) || 1)}
                min={1}
                max={100}
                data-testid="config-vote-min-votes"
              />
              <p className="text-xs text-muted-foreground mt-1">達到此數量才顯示結果</p>
            </div>
          </div>
          <LocationSettingsSection />
        </div>
      );

    default:
      return (
        <div className="bg-accent/30 rounded-lg p-4">
          <pre className="text-xs overflow-auto">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      );
  }
}

const EVENT_TYPES = [
  { value: "qrcode", label: "QR Code 掃描", icon: QrCode, description: "掃描特定 QR Code 時觸發" },
  { value: "gps", label: "GPS 抵達", icon: MapPin, description: "抵達指定地點時觸發" },
  { value: "shooting", label: "射擊達標", icon: Target, description: "射擊任務完成時觸發" },
  { value: "timer", label: "計時器", icon: Clock, description: "經過指定時間後觸發" },
];

const REWARD_TYPES = [
  { value: "points", label: "獲得分數", icon: Zap },
  { value: "item", label: "獲得道具", icon: Gift },
  { value: "unlock_page", label: "解鎖頁面", icon: ArrowRight },
  { value: "message", label: "顯示訊息", icon: MessageCircle },
];

interface GameEvent {
  id: string;
  gameId?: string;
  name: string;
  eventType: string;
  triggerConfig: any;
  rewardConfig: any;
}

function EventsEditor({ gameId, pages, apiGamesPath, apiEventsPath }: { gameId: string; pages: Page[]; apiGamesPath: string; apiEventsPath: string }) {
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<GameEvent>>>({});

  const { data: events = [], isLoading } = useQuery<GameEvent[]>({
    queryKey: [apiGamesPath, gameId, 'events'],
    enabled: !!gameId && gameId !== "new",
  });

  const createEventMutation = useMutation({
    mutationFn: async (event: Omit<GameEvent, "id">) => {
      const res = await apiRequest("POST", `${apiGamesPath}/${gameId}/events`, event);
      return res.json();
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      setSelectedEvent(newEvent);
      toast({ title: "已新增事件" });
    },
    onError: () => {
      toast({ title: "新增失敗", variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `${apiEventsPath}/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      if (selectedEvent?.id === deletedId) {
        setSelectedEvent(null);
      }
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      toast({ title: "已刪除事件" });
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<GameEvent> }) => {
      const res = await apiRequest("PATCH", `${apiEventsPath}/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedEvent) => {
      queryClient.invalidateQueries({ queryKey: [apiGamesPath, gameId, 'events'] });
      setLocalEdits(prev => {
        const next = { ...prev };
        delete next[updatedEvent.id];
        return next;
      });
      setSelectedEvent(updatedEvent);
      toast({ title: "已儲存事件" });
    },
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
    },
  });

  const addEvent = () => {
    createEventMutation.mutate({
      name: "新事件",
      eventType: "qrcode",
      triggerConfig: { qrCodeId: "" },
      rewardConfig: { type: "points", value: 10 },
    });
  };

  const updateEvent = (id: string, updates: Partial<GameEvent>) => {
    setLocalEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
    if (selectedEvent?.id === id) {
      setSelectedEvent({ ...selectedEvent, ...updates });
    }
  };

  const deleteEvent = (id: string) => {
    deleteEventMutation.mutate(id);
  };

  const getEventWithEdits = (event: GameEvent): GameEvent => {
    const edits = localEdits[event.id];
    return edits ? { ...event, ...edits } : event;
  };

  const getEventTypeInfo = (type: string) => {
    return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0];
  };

  if (gameId === "new") {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>請先儲存遊戲後再新增事件</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5" />
              事件列表
            </CardTitle>
            <Button 
              size="sm" 
              onClick={addEvent} 
              disabled={createEventMutation.isPending}
              data-testid="button-add-event"
            >
              <Plus className="w-4 h-4 mr-1" />
              {createEventMutation.isPending ? "新增中..." : "新增事件"}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">載入中...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">尚未建立任何事件</p>
                <p className="text-xs mt-1">事件可在特定條件下觸發獎勵或頁面跳轉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((event) => {
                  const displayEvent = getEventWithEdits(event);
                  const typeInfo = getEventTypeInfo(displayEvent.eventType);
                  return (
                    <div
                      key={event.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedEvent?.id === event.id
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-accent/30 hover:bg-accent"
                      }`}
                      onClick={() => setSelectedEvent(displayEvent)}
                      data-testid={`event-item-${event.id}`}
                    >
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                        <typeInfo.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{displayEvent.name}</p>
                        <p className="text-xs text-muted-foreground">{typeInfo.label}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteEvent(event.id);
                        }}
                        disabled={deleteEventMutation.isPending}
                        data-testid={`button-delete-event-${event.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        {selectedEvent ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">編輯事件</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">事件名稱</label>
                <Input
                  value={selectedEvent.name}
                  onChange={(e) => updateEvent(selectedEvent.id, { name: e.target.value })}
                  placeholder="輸入事件名稱"
                  data-testid="input-event-name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">觸發類型</label>
                <Select
                  value={selectedEvent.eventType}
                  onValueChange={(value) => {
                    let triggerConfig = {};
                    switch (value) {
                      case "qrcode":
                        triggerConfig = { qrCodeId: "" };
                        break;
                      case "gps":
                        triggerConfig = { lat: 25.033, lng: 121.565, radius: 50 };
                        break;
                      case "shooting":
                        triggerConfig = { minScore: 100 };
                        break;
                      case "timer":
                        triggerConfig = { delaySeconds: 60 };
                        break;
                    }
                    updateEvent(selectedEvent.id, { eventType: value, triggerConfig });
                  }}
                >
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-accent/30 rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium block">觸發條件設定</label>
                <TriggerConfigEditor
                  eventType={selectedEvent.eventType}
                  config={selectedEvent.triggerConfig}
                  onChange={(triggerConfig) => updateEvent(selectedEvent.id, { triggerConfig })}
                />
              </div>

              <div className="bg-accent/30 rounded-lg p-4 space-y-3">
                <label className="text-sm font-medium block">獎勵設定</label>
                <RewardConfigEditor
                  config={selectedEvent.rewardConfig}
                  pages={pages}
                  onChange={(rewardConfig) => updateEvent(selectedEvent.id, { rewardConfig })}
                />
              </div>

              {localEdits[selectedEvent.id] && (
                <Button
                  className="w-full"
                  onClick={() => {
                    const edits = localEdits[selectedEvent.id];
                    if (edits) {
                      updateEventMutation.mutate({ 
                        id: selectedEvent.id, 
                        data: edits 
                      });
                    }
                  }}
                  disabled={updateEventMutation.isPending}
                  data-testid="button-save-event"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateEventMutation.isPending ? "儲存中..." : "儲存事件"}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>選擇一個事件進行編輯</p>
              <p className="text-sm mt-1">或點擊「新增事件」建立新事件</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function TriggerConfigEditor({ 
  eventType, 
  config, 
  onChange 
}: { 
  eventType: string; 
  config: any; 
  onChange: (config: any) => void;
}) {
  switch (eventType) {
    case "qrcode":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">QR Code ID</label>
          <Input
            value={config.qrCodeId || ""}
            onChange={(e) => onChange({ ...config, qrCodeId: e.target.value })}
            placeholder="QR-001"
            data-testid="trigger-qrcode-id"
          />
        </div>
      );
    case "gps":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">緯度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.lat || 25.033}
                onChange={(e) => onChange({ ...config, lat: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lat"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">經度</label>
              <Input
                type="number"
                step="0.0001"
                value={config.lng || 121.565}
                onChange={(e) => onChange({ ...config, lng: parseFloat(e.target.value) })}
                data-testid="trigger-gps-lng"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">觸發半徑 (公尺)</label>
            <Input
              type="number"
              value={config.radius || 50}
              onChange={(e) => onChange({ ...config, radius: parseInt(e.target.value) })}
              data-testid="trigger-gps-radius"
            />
          </div>
        </div>
      );
    case "shooting":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">最低分數</label>
          <Input
            type="number"
            value={config.minScore || 100}
            onChange={(e) => onChange({ ...config, minScore: parseInt(e.target.value) })}
            data-testid="trigger-shooting-score"
          />
        </div>
      );
    case "timer":
      return (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">延遲秒數</label>
          <Input
            type="number"
            value={config.delaySeconds || 60}
            onChange={(e) => onChange({ ...config, delaySeconds: parseInt(e.target.value) })}
            data-testid="trigger-timer-delay"
          />
        </div>
      );
    default:
      return null;
  }
}

function RewardConfigEditor({
  config,
  pages,
  onChange,
}: {
  config: any;
  pages: Page[];
  onChange: (config: any) => void;
}) {
  const getPageTypeInfo = (type: string) => {
    return PAGE_TYPES.find(t => t.value === type) || { label: type, icon: FileText, color: "bg-gray-500/20 text-gray-400" };
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">獎勵類型</label>
        <Select
          value={config.type || "points"}
          onValueChange={(value) => {
            let newConfig = { type: value };
            switch (value) {
              case "points":
                newConfig = { ...newConfig, value: 10 } as any;
                break;
              case "item":
                newConfig = { ...newConfig, itemId: "" } as any;
                break;
              case "unlock_page":
                newConfig = { ...newConfig, pageId: "" } as any;
                break;
              case "message":
                newConfig = { ...newConfig, message: "" } as any;
                break;
            }
            onChange(newConfig);
          }}
        >
          <SelectTrigger data-testid="select-reward-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REWARD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <span className="flex items-center gap-2">
                  <type.icon className="w-4 h-4" />
                  {type.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {config.type === "points" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">分數</label>
          <Input
            type="number"
            value={config.value || 10}
            onChange={(e) => onChange({ ...config, value: parseInt(e.target.value) })}
            data-testid="reward-points-value"
          />
        </div>
      )}

      {config.type === "item" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">道具 ID</label>
          <Input
            value={config.itemId || ""}
            onChange={(e) => onChange({ ...config, itemId: e.target.value })}
            placeholder="輸入道具 ID"
            data-testid="reward-item-id"
          />
        </div>
      )}

      {config.type === "unlock_page" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">目標頁面</label>
          <Select
            value={config.pageId || ""}
            onValueChange={(value) => onChange({ ...config, pageId: value })}
          >
            <SelectTrigger data-testid="reward-page-select">
              <SelectValue placeholder="選擇頁面" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p, idx) => {
                const info = getPageTypeInfo(p.pageType);
                return (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      <info.icon className="w-4 h-4" />
                      #{idx + 1} {info.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {config.type === "message" && (
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">訊息內容</label>
          <Textarea
            value={config.message || ""}
            onChange={(e) => onChange({ ...config, message: e.target.value })}
            placeholder="輸入要顯示的訊息..."
            rows={3}
            data-testid="reward-message"
          />
        </div>
      )}
    </div>
  );
}

function ButtonConfigEditor({ 
  config, 
  updateField, 
  allPages 
}: { 
  config: any; 
  updateField: (field: string, value: any) => void;
  allPages: Page[];
}) {
  const getPageTypeInfo = (type: string) => {
    return PAGE_TYPES.find(t => t.value === type) || { label: type, icon: FileText, color: "bg-gray-500/20 text-gray-400" };
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">提示文字</label>
        <Input
          value={config.prompt || ""}
          onChange={(e) => updateField("prompt", e.target.value)}
          placeholder="請選擇一個選項..."
          data-testid="config-button-prompt"
        />
      </div>
      
      <div>
        <label className="text-sm font-medium mb-3 block flex items-center gap-2">
          按鈕選項
          <Badge variant="secondary" className="text-xs">條件分支</Badge>
        </label>
        <div className="space-y-3">
          {(config.buttons || []).map((btn: any, i: number) => (
            <Card key={i} className="p-3">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={btn.text || ""}
                    onChange={(e) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = { ...newButtons[i], text: e.target.value };
                      updateField("buttons", newButtons);
                    }}
                    placeholder={`按鈕文字 ${i + 1}`}
                    className="flex-1"
                    data-testid={`config-button-text-${i}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => {
                      const newButtons = config.buttons.filter((_: any, idx: number) => idx !== i);
                      updateField("buttons", newButtons);
                    }}
                    data-testid={`config-button-delete-${i}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground shrink-0 w-16">跳轉到:</label>
                  <Select
                    value={btn.nextPageId || "_next"}
                    onValueChange={(value) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = { 
                        ...newButtons[i], 
                        nextPageId: value === "_next" ? undefined : value 
                      };
                      updateField("buttons", newButtons);
                    }}
                  >
                    <SelectTrigger className="flex-1" data-testid={`config-button-next-${i}`}>
                      <SelectValue placeholder="選擇目標頁面" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_next">
                        <span className="flex items-center gap-2">
                          <ChevronDown className="w-4 h-4" />
                          下一頁 (順序)
                        </span>
                      </SelectItem>
                      <SelectItem value="_end">
                        <span className="flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          結束遊戲
                        </span>
                      </SelectItem>
                      {allPages.map((p, idx) => {
                        const info = getPageTypeInfo(p.pageType);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <info.icon className="w-4 h-4" />
                              #{idx + 1} {info.label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="text-xs text-muted-foreground shrink-0 w-16">獎勵分數:</label>
                  <Input
                    type="number"
                    value={btn.rewardPoints || 0}
                    onChange={(e) => {
                      const newButtons = [...config.buttons];
                      newButtons[i] = { ...newButtons[i], rewardPoints: parseInt(e.target.value) || 0 };
                      updateField("buttons", newButtons);
                    }}
                    placeholder="0"
                    className="w-24"
                    data-testid={`config-button-points-${i}`}
                  />
                  <span className="text-xs text-muted-foreground">分</span>
                </div>
              </div>
            </Card>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              updateField("buttons", [...(config.buttons || []), { text: "", nextPageId: undefined, rewardPoints: 0 }]);
            }}
            data-testid="button-add-button"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增選項
          </Button>
        </div>
      </div>
    </div>
  );
}
