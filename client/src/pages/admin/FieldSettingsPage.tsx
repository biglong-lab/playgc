// 場域設定頁面 — AI Key、配額、功能開關、品牌、視覺主題
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Settings2, Palette, Save, Eye, EyeOff, Loader2, ShieldCheck, Image as ImageIcon, Type, Sparkles, ExternalLink, FileText, Plus, Trash2, ChevronUp, ChevronDown, Target, MapPin, Camera, Users, Swords, Landmark, ShoppingBag, Coffee, Puzzle, QrCode, Compass, Star, Clock, Gamepad2, Trophy, Zap, Shield, HelpCircle, Megaphone, AlertCircle, Download, Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { FieldTheme, FieldHighlight } from "@shared/schema";
import { applyTheme } from "@/lib/themeUtils";
import { THEME_PRESETS, findMatchingPreset } from "@/lib/themePresets";
import { UploadImageButton } from "@/components/shared/UploadImageButton";
import { encodePreviewTheme, PREVIEW_QUERY_KEY } from "@/providers/FieldThemeProvider";
import { useUnsavedWarning } from "@/hooks/useUnsavedWarning";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";

interface FieldSettingsResponse {
  enableAI?: boolean;
  hasGeminiApiKey: boolean;
  maxGames?: number;
  maxConcurrentSessions?: number;
  enablePayment?: boolean;
  enableTeamMode?: boolean;
  enableCompetitiveMode?: boolean;
  // 🆕 模組開關
  enableShootingMission?: boolean;
  enableBattleArena?: boolean;
  enableChapters?: boolean;
  enablePhotoMission?: boolean;
  enableGpsMission?: boolean;
  // 🆕 介紹內容
  tagline?: string;
  highlights?: FieldHighlight[];
  /** 🆕 場域公告 banner */
  announcement?: string;
  /** 🆕 公告時效起/訖（ISO YYYY-MM-DD）*/
  announcementStartAt?: string;
  announcementEndAt?: string;
  /** 🆕 公告嚴重程度 */
  announcementSeverity?: "info" | "urgent";
  primaryColor?: string;        // legacy
  welcomeMessage?: string;
  theme?: FieldTheme;            // 🆕 視覺主題
}

export default function FieldSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 取得目前管理員的場域 ID
  const { data: meData } = useQuery<{ fieldId: string }>({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/me");
      return res.json();
    },
  });

  const fieldId = meData?.fieldId;

  const { data: settings, isLoading } = useQuery<FieldSettingsResponse>({
    queryKey: ["/api/admin/fields", fieldId, "settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/fields/${fieldId}/settings`);
      return res.json();
    },
    enabled: Boolean(fieldId),
  });

  // 🆕 Tab 狀態同步到 URL query — 使用 useTabQueryParam 共用 hook
  const VALID_TABS = ["intro", "features", "brand", "ai"] as const;
  const [activeTab, handleTabChange] = useTabQueryParam(VALID_TABS, "intro");

  if (!fieldId) {
    return (
      <UnifiedAdminLayout title="場域設定">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          載入中...
        </div>
      </UnifiedAdminLayout>
    );
  }

  return (
    <UnifiedAdminLayout title="場域設定">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
        {/* 🆕 匯出/匯入場域設定 */}
        <div className="flex justify-end mb-4">
          <ExportImportButtons fieldId={fieldId} settings={settings} />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="intro" className="gap-2">
              <FileText className="w-4 h-4" /> 場域介紹
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Settings2 className="w-4 h-4" /> 功能模組
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-2">
              <Palette className="w-4 h-4" /> 視覺主題
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" /> AI 設定
            </TabsTrigger>
          </TabsList>

          <TabsContent value="intro">
            <IntroTab fieldId={fieldId} settings={settings} />
          </TabsContent>
          <TabsContent value="features">
            <FeaturesTab fieldId={fieldId} settings={settings} />
          </TabsContent>
          <TabsContent value="brand">
            <BrandTab fieldId={fieldId} settings={settings} />
          </TabsContent>
          <TabsContent value="ai">
            <AiSettingsTab fieldId={fieldId} settings={settings} />
          </TabsContent>
        </Tabs>
        </>
      )}
    </UnifiedAdminLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🆕 匯出 / 匯入場域設定 JSON
// ═══════════════════════════════════════════════════════════════

function ExportImportButtons({
  fieldId,
  settings,
}: {
  fieldId: string;
  settings?: FieldSettingsResponse;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleExport = () => {
    if (!settings) {
      toast({ title: "尚未載入設定，無法匯出", variant: "destructive" });
      return;
    }
    // 只匯出可移植欄位（排除 hasGeminiApiKey 這種狀態欄位）
    const portable = {
      tagline: settings.tagline,
      welcomeMessage: settings.welcomeMessage,
      announcement: settings.announcement,
      announcementStartAt: settings.announcementStartAt,
      announcementEndAt: settings.announcementEndAt,
      highlights: settings.highlights,
      theme: settings.theme,
      enableShootingMission: settings.enableShootingMission,
      enableBattleArena: settings.enableBattleArena,
      enableChapters: settings.enableChapters,
      enablePhotoMission: settings.enablePhotoMission,
      enableGpsMission: settings.enableGpsMission,
      enablePayment: settings.enablePayment,
      enableTeamMode: settings.enableTeamMode,
      enableCompetitiveMode: settings.enableCompetitiveMode,
      maxGames: settings.maxGames,
      maxConcurrentSessions: settings.maxConcurrentSessions,
      _exportedAt: new Date().toISOString(),
      _version: "1.0",
    };
    const blob = new Blob([JSON.stringify(portable, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `field-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "✓ 已匯出場域設定",
      description: "JSON 檔已下載，可分享或當作範本保存",
    });
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (!confirm(`確定要從「${file.name}」匯入設定？\n會覆蓋當前場域的：模組開關、亮點、公告、主題、tagline 等。\nAI Key、聯絡資訊不會受影響。`)) {
        return;
      }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (typeof data !== "object" || data === null) {
          throw new Error("JSON 格式不正確");
        }
        // 移除元資訊 key
        const { _exportedAt, _version, ...settingsToApply } = data;
        void _exportedAt;
        void _version;
        const res = await apiRequest(
          "PATCH",
          `/api/admin/fields/${fieldId}/settings`,
          settingsToApply,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || "匯入失敗");
        }
        queryClient.invalidateQueries({
          queryKey: ["/api/admin/fields", fieldId, "settings"],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
        toast({
          title: "✓ 已匯入場域設定",
          description: "設定已套用，可能需要重整頁面看到完整變化",
        });
      } catch (err) {
        toast({
          title: "匯入失敗",
          description: err instanceof Error ? err.message : "未知錯誤",
          variant: "destructive",
        });
      }
    };
    input.click();
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="gap-1.5"
        data-testid="btn-export-settings"
      >
        <Download className="w-3.5 h-3.5" />
        匯出 JSON
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleImport}
        className="gap-1.5"
        data-testid="btn-import-settings"
      >
        <Upload className="w-3.5 h-3.5" />
        匯入 JSON
      </Button>
    </div>
  );
}

// ============================================================================
// AI 設定 Tab
// ============================================================================

function AiSettingsTab({ fieldId, settings }: { fieldId: string; settings?: FieldSettingsResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [enableAI, setEnableAI] = useState(settings?.enableAI ?? true);

  useEffect(() => {
    if (settings) setEnableAI(settings.enableAI ?? true);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
      toast({ title: "已儲存 AI 設定" });
      setApiKey("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "未知錯誤";
      toast({
        title: "儲存失敗",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleSaveKey = () => {
    saveMutation.mutate({ geminiApiKey: apiKey });
  };

  const handleClearKey = () => {
    saveMutation.mutate({ geminiApiKey: "" });
  };

  const handleToggleAI = (checked: boolean) => {
    setEnableAI(checked);
    saveMutation.mutate({ enableAI: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5" /> AI 功能設定
        </CardTitle>
        <CardDescription>
          設定場域專屬的 AI API Key，用於照片驗證和文字語意評分。
          支援 <b>Google Gemini</b>（AIza 開頭）或 <b>OpenRouter</b>（sk-or- 開頭）。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI 總開關 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">AI 功能</p>
            <p className="text-sm text-muted-foreground">啟用照片驗證和語意評分功能</p>
          </div>
          <Switch
            checked={enableAI}
            onCheckedChange={handleToggleAI}
            disabled={saveMutation.isPending}
            data-testid="switch-enable-ai"
          />
        </div>

        {/* API Key */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            <p className="font-medium">AI API Key <span className="text-xs text-muted-foreground">(Gemini 或 OpenRouter)</span></p>
          </div>

          {settings?.hasGeminiApiKey ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 font-mono text-sm">
                ••••••••••••••••••••
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearKey}
                disabled={saveMutation.isPending}
              >
                清除
              </Button>
            </div>
          ) : (
            <p className="text-sm text-amber-600">尚未設定 API Key，將使用系統預設金鑰</p>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy...（Gemini）或 sk-or-v1-...（OpenRouter）"
                className="pr-10"
                data-testid="input-api-key"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              onClick={handleSaveKey}
              disabled={!apiKey.trim() || saveMutation.isPending}
              className="gap-2"
              data-testid="button-save-key"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              儲存
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            API Key 會以 AES-256-GCM 加密存儲，僅在 AI 呼叫時解密使用
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 功能與配額 Tab
// ============================================================================

function FeaturesTab({ fieldId, settings }: { fieldId: string; settings?: FieldSettingsResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [maxGames, setMaxGames] = useState(settings?.maxGames ?? 0);
  const [maxSessions, setMaxSessions] = useState(settings?.maxConcurrentSessions ?? 0);
  const [enablePayment, setEnablePayment] = useState(settings?.enablePayment ?? false);
  const [enableTeamMode, setEnableTeamMode] = useState(settings?.enableTeamMode ?? true);
  const [enableCompetitive, setEnableCompetitive] = useState(settings?.enableCompetitiveMode ?? true);
  // 🆕 場域模組開關
  const [enableShooting, setEnableShooting] = useState(settings?.enableShootingMission ?? false);
  const [enableBattle, setEnableBattle] = useState(settings?.enableBattleArena ?? false);
  const [enableChapters, setEnableChapters] = useState(settings?.enableChapters ?? false);
  const [enablePhoto, setEnablePhoto] = useState(settings?.enablePhotoMission ?? false);
  const [enableGps, setEnableGps] = useState(settings?.enableGpsMission ?? false);

  useEffect(() => {
    if (!settings) return;
    setMaxGames(settings.maxGames ?? 0);
    setMaxSessions(settings.maxConcurrentSessions ?? 0);
    setEnablePayment(settings.enablePayment ?? false);
    setEnableTeamMode(settings.enableTeamMode ?? true);
    setEnableCompetitive(settings.enableCompetitiveMode ?? true);
    setEnableShooting(settings.enableShootingMission ?? false);
    setEnableBattle(settings.enableBattleArena ?? false);
    setEnableChapters(settings.enableChapters ?? false);
    setEnablePhoto(settings.enablePhotoMission ?? false);
    setEnableGps(settings.enableGpsMission ?? false);
  }, [settings]);

  // 🆕 未儲存變更警示
  const hasUnsavedChanges = Boolean(
    settings &&
      (maxGames !== (settings.maxGames ?? 0) ||
        maxSessions !== (settings.maxConcurrentSessions ?? 0) ||
        enablePayment !== (settings.enablePayment ?? false) ||
        enableTeamMode !== (settings.enableTeamMode ?? true) ||
        enableCompetitive !== (settings.enableCompetitiveMode ?? true) ||
        enableShooting !== (settings.enableShootingMission ?? false) ||
        enableBattle !== (settings.enableBattleArena ?? false) ||
        enableChapters !== (settings.enableChapters ?? false) ||
        enablePhoto !== (settings.enablePhotoMission ?? false) ||
        enableGps !== (settings.enableGpsMission ?? false)),
  );
  useUnsavedWarning(hasUnsavedChanges);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      toast({ title: "已儲存功能設定" });
    },
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      maxGames,
      maxConcurrentSessions: maxSessions,
      enablePayment,
      enableTeamMode,
      enableCompetitiveMode: enableCompetitive,
      enableShootingMission: enableShooting,
      enableBattleArena: enableBattle,
      enableChapters,
      enablePhotoMission: enablePhoto,
      enableGpsMission: enableGps,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> 功能模組
        </CardTitle>
        <CardDescription>
          控制本場域啟用哪些任務模組和配額。未啟用的模組不會顯示於玩家端。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 場域任務模組 */}
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">場域任務模組</h3>
            <p className="text-xs text-muted-foreground mt-1">
              決定本場域的遊戲可以使用哪些任務類型（例：無硬體靶機就關閉射擊）
            </p>
          </div>
          <ToggleRow
            label="🎯 射擊任務"
            description="硬體靶機射擊（僅有實體靶機的場域才啟用）"
            helpText="需要實體 Arduino 靶機設備才能使用。啟用後：玩家端遊戲可加入射擊關卡、後台側邊欄顯示「🔌 設備管理」菜單。"
            checked={enableShooting}
            onChange={setEnableShooting}
            testId="switch-shooting"
          />
          <ToggleRow
            label="⚔️ 水彈對戰 PK 擂台"
            description="對戰場地預約系統（僅有水彈/漆彈場地才啟用）"
            helpText="提供多人對戰場地預約 + 排名系統。啟用後：玩家 Home 顯示「水彈對戰 PK 擂台」快速入口、後台側邊欄顯示「⚔️ 對戰中心」5 個菜單。僅有實體水彈 / 漆彈場地的場域才需啟用。"
            checked={enableBattle}
            onChange={setEnableBattle}
            testId="switch-battle"
          />
          <ToggleRow
            label="📍 GPS 定位任務"
            description="地點導航與打卡"
            helpText="啟用後：遊戲可加入地點導航關卡，玩家手機需開啟定位權限，抵達指定座標才觸發任務完成。適合景點巡禮、市集走踏類遊戲。"
            checked={enableGps}
            onChange={setEnableGps}
            testId="switch-gps"
          />
          <ToggleRow
            label="📷 拍照驗證任務"
            description="AI 照片識別任務"
            helpText="啟用後：遊戲可加入拍照關卡，玩家上傳照片後透過 AI（Gemini/OpenRouter）驗證內容是否符合要求。需先在「AI 設定」Tab 設好 API Key。"
            checked={enablePhoto}
            onChange={setEnablePhoto}
            testId="switch-photo"
          />
          <ToggleRow
            label="📖 章節制遊戲"
            description="多章節任務結構（劇情推進）"
            helpText="啟用後：遊戲可拆分多個章節，玩家需依序完成（或依解鎖規則），適合有劇情連貫性的主題遊戲。不啟用時遊戲只能用單一頁面模式。"
            checked={enableChapters}
            onChange={setEnableChapters}
            testId="switch-chapters"
          />
        </div>

        {/* 通用功能 */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">通用功能</h3>
          <ToggleRow
            label="💰 收費功能"
            description="允許遊戲設定收費和兌換碼"
            helpText="啟用後：遊戲可設定收費或兌換碼才能進入，後台側邊欄顯示「💰 財務中心」（4 個菜單：營收/商品/兌換碼/交易）。若場域為免費開放，不用啟用。"
            checked={enablePayment}
            onChange={setEnablePayment}
            testId="switch-payment"
          />
          <ToggleRow
            label="👥 團隊模式"
            description="允許遊戲使用團隊分組功能"
            helpText="啟用後：遊戲可設定多人組隊，隊員共享進度、即時聊天、共同完成任務。適合大型團體活動。"
            checked={enableTeamMode}
            onChange={setEnableTeamMode}
            testId="switch-team"
          />
          <ToggleRow
            label="🏆 競賽/接力模式"
            description="允許遊戲使用競賽和接力賽功能"
            helpText="啟用後：遊戲可設定競賽模式（多人同時爭第一）或接力賽（隊員依序完成），適合比賽、賽事類活動。"
            checked={enableCompetitive}
            onChange={setEnableCompetitive}
            testId="switch-competitive"
          />
        </div>

        {/* 配額 */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">配額</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium mb-1 block">最大遊戲數</label>
              <Input
                type="number"
                value={maxGames}
                onChange={(e) => setMaxGames(parseInt(e.target.value) || 0)}
                min={0}
                placeholder="0 = 無限"
                data-testid="input-max-games"
              />
              <p className="text-xs text-muted-foreground mt-1">0 表示無限制</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">最大同時場次</label>
              <Input
                type="number"
                value={maxSessions}
                onChange={(e) => setMaxSessions(parseInt(e.target.value) || 0)}
                min={0}
                placeholder="0 = 無限"
                data-testid="input-max-sessions"
              />
              <p className="text-xs text-muted-foreground mt-1">0 表示無限制</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending || !hasUnsavedChanges}
            className="gap-2"
            data-testid="button-save-features"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存設定
          </Button>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              有未儲存變更
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 🆕 場域介紹 Tab — tagline + highlights 編輯
// ============================================================================

/** 常用 icon 選項（配合 Landing.tsx ICON_MAP） */
const HIGHLIGHT_ICON_OPTIONS: Array<{ value: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
  { value: "Sparkles", label: "✨ 預設", Icon: Sparkles },
  { value: "Target", label: "🎯 射擊靶", Icon: Target },
  { value: "MapPin", label: "📍 地點", Icon: MapPin },
  { value: "Camera", label: "📷 相機", Icon: Camera },
  { value: "Users", label: "👥 團隊", Icon: Users },
  { value: "Swords", label: "⚔️ 對戰", Icon: Swords },
  { value: "Landmark", label: "🏛️ 古蹟", Icon: Landmark },
  { value: "ShoppingBag", label: "🛍️ 市集", Icon: ShoppingBag },
  { value: "Coffee", label: "☕ 咖啡", Icon: Coffee },
  { value: "Puzzle", label: "🧩 解謎", Icon: Puzzle },
  { value: "QrCode", label: "📱 QR", Icon: QrCode },
  { value: "Compass", label: "🧭 探索", Icon: Compass },
  { value: "Gamepad2", label: "🎮 遊戲", Icon: Gamepad2 },
  { value: "Trophy", label: "🏆 獎盃", Icon: Trophy },
  { value: "Star", label: "⭐ 星星", Icon: Star },
  { value: "Clock", label: "⏰ 時間", Icon: Clock },
  { value: "Zap", label: "⚡ 閃電", Icon: Zap },
  { value: "Shield", label: "🛡️ 盾牌", Icon: Shield },
];

function IntroTab({ fieldId, settings }: { fieldId: string; settings?: FieldSettingsResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tagline, setTagline] = useState(settings?.tagline ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcomeMessage ?? "");
  const [highlights, setHighlights] = useState<FieldHighlight[]>(settings?.highlights ?? []);
  // 🆕 場域公告
  const [announcement, setAnnouncement] = useState(settings?.announcement ?? "");
  const [announcementStartAt, setAnnouncementStartAt] = useState(settings?.announcementStartAt ?? "");
  const [announcementEndAt, setAnnouncementEndAt] = useState(settings?.announcementEndAt ?? "");
  const [announcementSeverity, setAnnouncementSeverity] = useState<"info" | "urgent">(
    settings?.announcementSeverity ?? "info",
  );

  useEffect(() => {
    if (!settings) return;
    setTagline(settings.tagline ?? "");
    setWelcomeMessage(settings.welcomeMessage ?? "");
    setHighlights(settings.highlights ?? []);
    setAnnouncement(settings.announcement ?? "");
    setAnnouncementStartAt(settings.announcementStartAt ?? "");
    setAnnouncementEndAt(settings.announcementEndAt ?? "");
    setAnnouncementSeverity(settings.announcementSeverity ?? "info");
  }, [settings]);

  // 🆕 判斷是否有未儲存變更（跟 settings 比對）
  const hasUnsavedChanges = Boolean(
    settings &&
      (tagline !== (settings.tagline ?? "") ||
        welcomeMessage !== (settings.welcomeMessage ?? "") ||
        announcement !== (settings.announcement ?? "") ||
        announcementStartAt !== (settings.announcementStartAt ?? "") ||
        announcementEndAt !== (settings.announcementEndAt ?? "") ||
        announcementSeverity !== (settings.announcementSeverity ?? "info") ||
        JSON.stringify(highlights) !== JSON.stringify(settings.highlights ?? [])),
  );
  useUnsavedWarning(hasUnsavedChanges);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      toast({ title: "已儲存場域介紹" });
    },
    onError: (err: unknown) => {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const handleAddHighlight = () => {
    if (highlights.length >= 10) {
      toast({ title: "最多 10 項亮點", variant: "destructive" });
      return;
    }
    setHighlights([...highlights, { icon: "Sparkles", title: "", description: "" }]);
  };

  const handleUpdate = (i: number, patch: Partial<FieldHighlight>) => {
    setHighlights((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  };

  const handleRemove = (i: number) => {
    setHighlights((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleMove = (i: number, dir: -1 | 1) => {
    const newIdx = i + dir;
    if (newIdx < 0 || newIdx >= highlights.length) return;
    const next = [...highlights];
    [next[i], next[newIdx]] = [next[newIdx], next[i]];
    setHighlights(next);
  };

  const handleSave = () => {
    // 驗證：每個 highlight 必須有 title
    const invalid = highlights.find((h) => !h.title.trim());
    if (invalid) {
      toast({ title: "每個亮點都需要標題", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      tagline: tagline.trim(),
      welcomeMessage: welcomeMessage.trim(),
      announcement: announcement.trim(),
      announcementStartAt: announcementStartAt.trim(),
      announcementEndAt: announcementEndAt.trim(),
      announcementSeverity,
      highlights: highlights.map((h) => ({
        icon: h.icon || "Sparkles",
        title: h.title.trim(),
        description: h.description?.trim() || undefined,
      })),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* 左側：編輯面板 */}
      <div className="lg:col-span-3 space-y-4">
      {/* Tagline + 歡迎訊息 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> 基本介紹
          </CardTitle>
          <CardDescription>
            顯示於 CHITO 平台首頁的場域卡、本場域 Landing 頁面
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">場域 Slogan（tagline）</label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="例：金門賈村 · 戰術沉浸式體驗"
              maxLength={200}
              data-testid="input-tagline"
            />
            <p className="text-xs text-muted-foreground mt-1">
              顯示於平台首頁場域卡片 + 本場域 Landing 頁 Hero 區。建議 20-50 字。
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">歡迎訊息（較長）</label>
            <Input
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="例：歡迎來到賈村，準備好挑戰了嗎？"
              maxLength={500}
              data-testid="input-welcome-message-intro"
            />
            <p className="text-xs text-muted-foreground mt-1">
              顯示於玩家端 Home Banner 和 Landing Hero 下方。可與 tagline 互補。
            </p>
          </div>

          {/* 🆕 場域公告（含時效） */}
          <div>
            <label className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              📢 場域公告
              <span className="text-xs text-muted-foreground font-normal">
                （顯示於 Landing 和 Home 頂部橫幅；空白 = 不顯示）
              </span>
            </label>
            <Textarea
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="例：4/28 園區保養維護，當日遊戲暫停。"
              maxLength={500}
              rows={2}
              data-testid="input-announcement"
            />
            <p className="text-xs text-muted-foreground mt-1 mb-3">
              用於臨時通知：活動、維護、特價、開放時間異動等。建議 50 字內。
            </p>

            {/* 🆕 公告時效 + 嚴重程度 */}
            {announcement.trim() && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md bg-muted/30 border">
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">
                    開始顯示日（可選）
                  </label>
                  <Input
                    type="date"
                    value={announcementStartAt}
                    onChange={(e) => setAnnouncementStartAt(e.target.value)}
                    data-testid="input-announcement-start"
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    留空 = 即時顯示
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">
                    結束顯示日（可選）
                  </label>
                  <Input
                    type="date"
                    value={announcementEndAt}
                    onChange={(e) => setAnnouncementEndAt(e.target.value)}
                    data-testid="input-announcement-end"
                    className="text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    留空 = 永久顯示
                  </p>
                </div>
                {/* 🆕 嚴重程度 */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium mb-1 block text-muted-foreground">
                    顯示樣式
                  </label>
                  <Select
                    value={announcementSeverity}
                    onValueChange={(v) => setAnnouncementSeverity(v as "info" | "urgent")}
                  >
                    <SelectTrigger className="text-xs" data-testid="select-announcement-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>一般通知（琥珀色 · 玩家可關閉）</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span>緊急通知（紅色 · 玩家不可關閉）</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    緊急通知建議用在：颱風停業、場地臨時關閉、重大變更等必看訊息
                  </p>
                </div>
                {/* 狀態提示 */}
                <div className="sm:col-span-2">
                  <AnnouncementSchedulePreview
                    startAt={announcementStartAt}
                    endAt={announcementEndAt}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Highlights 列表編輯 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> 場域亮點（Feature Section）
              </CardTitle>
              <CardDescription>
                顯示於本場域 Landing 頁的特色介紹區塊，建議 3-5 項。每個場域可有不同的亮點。
              </CardDescription>
            </div>
            <Button
              onClick={handleAddHighlight}
              variant="outline"
              size="sm"
              disabled={highlights.length >= 10}
              className="gap-1.5"
              data-testid="button-add-highlight"
            >
              <Plus className="w-4 h-4" /> 新增亮點
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {highlights.length === 0 && (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                尚未設定亮點 — 點「新增亮點」開始編輯
              </p>
            </div>
          )}
          {highlights.map((h, i) => (
            <HighlightEditor
              key={i}
              index={i}
              highlight={h}
              isFirst={i === 0}
              isLast={i === highlights.length - 1}
              onChange={(patch) => handleUpdate(i, patch)}
              onRemove={() => handleRemove(i)}
              onMoveUp={() => handleMove(i, -1)}
              onMoveDown={() => handleMove(i, 1)}
            />
          ))}
          {highlights.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              目前 {highlights.length} 項 / 最多 10 項
            </p>
          )}
        </CardContent>
      </Card>

      {/* 儲存（有未存變更時加警示視覺） */}
      <div className="flex justify-end sticky bottom-4 z-10 items-center gap-3">
        {hasUnsavedChanges && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium shadow-lg">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            有未儲存變更
          </div>
        )}
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || !hasUnsavedChanges}
          className="gap-2 shadow-lg"
          size="lg"
          data-testid="button-save-intro"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          儲存場域介紹
        </Button>
      </div>
      </div>

      {/* 🆕 右側：前台即時預覽 */}
      <Card className="lg:col-span-2 lg:sticky lg:top-6 h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="w-4 h-4" />
            前台預覽
          </CardTitle>
          <CardDescription className="text-xs">
            即時顯示編輯後的呈現樣貌（存檔後與實際前台一致）
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IntroPreview
            tagline={tagline}
            welcomeMessage={welcomeMessage}
            highlights={highlights}
            announcement={announcement}
            announcementStartAt={announcementStartAt}
            announcementEndAt={announcementEndAt}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/** 🆕 公告時效狀態預覽 — 提示此刻是否顯示中 */
function AnnouncementSchedulePreview({
  startAt,
  endAt,
}: {
  startAt: string;
  endAt: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const notYet = startAt && today < startAt;
  const expired = endAt && today > endAt;

  if (notYet) {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        尚未開始 — 將於 {startAt} 起顯示
      </p>
    );
  }
  if (expired) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        已過期 — 結束日 {endAt}，不再顯示
      </p>
    );
  }
  if (endAt) {
    return (
      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        顯示中 — 至 {endAt} 結束
      </p>
    );
  }
  return (
    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" />
      顯示中 — 無結束日
    </p>
  );
}

/** 🆕 場域介紹即時預覽 — 模擬前台 Landing 的視覺（縮小版） */
function IntroPreview({
  tagline,
  welcomeMessage,
  highlights,
  announcement,
  announcementStartAt,
  announcementEndAt,
}: {
  tagline: string;
  welcomeMessage: string;
  highlights: FieldHighlight[];
  announcement: string;
  announcementStartAt: string;
  announcementEndAt: string;
}) {
  // 判斷公告目前是否會顯示（跟 API isAnnouncementActive 相同邏輯）
  const today = new Date().toISOString().split("T")[0];
  const announcementActive = Boolean(
    announcement.trim() &&
      (!announcementStartAt || today >= announcementStartAt) &&
      (!announcementEndAt || today <= announcementEndAt),
  );

  return (
    <div className="rounded-lg overflow-hidden border bg-background">
      {/* 🆕 公告 banner（有內容就顯示在預覽中；若不在時效內加灰色提示） */}
      {announcement.trim() && (
        <div
          className={`border-b px-3 py-2 flex items-start gap-1.5 text-[10px] leading-snug ${
            announcementActive
              ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
              : "bg-muted/50 border-muted-foreground/20 text-muted-foreground line-through opacity-60"
          }`}
          title={announcementActive ? "目前會顯示" : "不在時效內，不會顯示"}
        >
          <Megaphone className="w-3 h-3 shrink-0 mt-0.5" />
          <span className="flex-1">{announcement}</span>
        </div>
      )}

      {/* Hero 區 */}
      <div className="relative bg-gradient-to-br from-primary/10 via-background to-background p-5 text-center">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 mb-3">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-display uppercase tracking-wider text-primary">
            Real-world · Local · Play
          </span>
        </div>
        <h1 className="font-display text-2xl font-black mb-2 tracking-tight">
          場域名稱
        </h1>
        {tagline ? (
          <p className="text-xs text-muted-foreground font-chinese">{tagline}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40 italic">尚未設定 Tagline</p>
        )}
        {welcomeMessage && (
          <p className="text-[11px] text-muted-foreground/80 mt-2 leading-relaxed max-w-[220px] mx-auto">
            {welcomeMessage}
          </p>
        )}
      </div>

      {/* Feature Section（highlights）*/}
      <div className="border-t p-4 bg-muted/20">
        <p className="text-[9px] uppercase tracking-wider font-display text-primary mb-2 text-center">
          Mission Types
        </p>
        {highlights.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic text-center py-4">
            尚未加入亮點
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {highlights.slice(0, 6).map((h, i) => {
              const iconDef =
                HIGHLIGHT_ICON_OPTIONS.find((o) => o.value === h.icon) ??
                HIGHLIGHT_ICON_OPTIONS[0];
              const Icon = iconDef.Icon;
              return (
                <div
                  key={i}
                  className="rounded-md border bg-card p-2 flex flex-col gap-1"
                >
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="font-semibold text-[10px] leading-tight truncate">
                    {h.title || "（無標題）"}
                  </p>
                  {h.description && (
                    <p className="text-[9px] text-muted-foreground leading-tight line-clamp-2">
                      {h.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {highlights.length > 6 && (
          <p className="text-[9px] text-muted-foreground text-center mt-2">
            ...還有 {highlights.length - 6} 項
          </p>
        )}
      </div>
    </div>
  );
}

/** 單一亮點編輯列（icon 選擇 + title + description + 排序 + 刪除） */
function HighlightEditor({
  index,
  highlight,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  index: number;
  highlight: FieldHighlight;
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<FieldHighlight>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const selectedIcon =
    HIGHLIGHT_ICON_OPTIONS.find((o) => o.value === highlight.icon) ?? HIGHLIGHT_ICON_OPTIONS[0];
  const IconComp = selectedIcon.Icon;

  return (
    <div className="border-2 rounded-lg p-3 space-y-2.5 hover:border-primary/30 transition-colors" data-testid={`highlight-${index}`}>
      <div className="flex items-start gap-2">
        {/* Icon 選擇 */}
        <div className="shrink-0">
          <Select value={highlight.icon || "Sparkles"} onValueChange={(v) => onChange({ icon: v })}>
            <SelectTrigger className="w-[52px] h-[52px] p-0 flex items-center justify-center" data-testid={`select-icon-${index}`}>
              <IconComp className="w-6 h-6 text-primary" />
            </SelectTrigger>
            <SelectContent>
              {HIGHLIGHT_ICON_OPTIONS.map((opt) => {
                const IC = opt.Icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <IC className="w-4 h-4" />
                      <span>{opt.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* title + description */}
        <div className="flex-1 space-y-2">
          <Input
            value={highlight.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="亮點標題（必填）"
            maxLength={50}
            data-testid={`input-title-${index}`}
          />
          <Input
            value={highlight.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="亮點描述（選填）"
            maxLength={200}
            data-testid={`input-desc-${index}`}
          />
        </div>

        {/* 操作按鈕 */}
        <div className="flex flex-col gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={isFirst}
            title="上移"
          >
            <ChevronUp className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={isLast}
            title="下移"
          >
            <ChevronDown className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            title="刪除"
            data-testid={`btn-remove-${index}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 品牌 / 視覺主題 Tab
// ============================================================================

const LAYOUT_OPTIONS: { value: NonNullable<FieldTheme["layoutTemplate"]>; label: string; desc: string }[] = [
  { value: "classic", label: "經典版", desc: "header + 卡片網格（目前預設）" },
  { value: "card", label: "大尺寸卡片", desc: "大圖卡片滑動瀏覽" },
  { value: "fullscreen", label: "滿版沉浸", desc: "每個遊戲佔整螢幕，滑動切換" },
  { value: "minimal", label: "極簡列表", desc: "純列表、單色、極簡" },
];

const FONT_OPTIONS: {
  value: NonNullable<FieldTheme["fontFamily"]>;
  label: string;
  previewFont: string;
  sample: string;
}[] = [
  {
    value: "default",
    label: "預設字體（系統）",
    previewFont: "Noto Sans TC, sans-serif",
    sample: "賈村 Jiachun",
  },
  {
    value: "serif",
    label: "襯線（文藝）",
    previewFont: "Noto Serif TC, serif",
    sample: "后浦小鎮",
  },
  {
    value: "mono",
    label: "等寬（科技感）",
    previewFont: "JetBrains Mono, monospace",
    sample: "Console_Mode",
  },
  {
    value: "display",
    label: "展示字體（遊戲感）",
    previewFont: "Bungee, Noto Sans TC, sans-serif",
    sample: "ARCADE",
  },
];

function BrandTab({ fieldId, settings }: { fieldId: string; settings?: FieldSettingsResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcomeMessage ?? "");
  const [theme, setTheme] = useState<FieldTheme>({});
  const [previewOn, setPreviewOn] = useState(false);

  // settings 載入後同步到 state（取 theme 或 legacy primaryColor）
  useEffect(() => {
    if (!settings) return;
    setWelcomeMessage(settings.welcomeMessage ?? "");
    const t = settings.theme || {};
    setTheme({
      primaryColor: t.primaryColor || settings.primaryColor || "#f97316",
      accentColor: t.accentColor || "",
      backgroundColor: t.backgroundColor || "",
      textColor: t.textColor || "",
      layoutTemplate: t.layoutTemplate || "classic",
      coverImageUrl: t.coverImageUrl || "",
      brandingLogoUrl: t.brandingLogoUrl || "",
      fontFamily: t.fontFamily || "default",
    });
  }, [settings]);

  // 🆕 未儲存變更警示
  const hasUnsavedChanges = Boolean(
    settings &&
      (welcomeMessage !== (settings.welcomeMessage ?? "") ||
        JSON.stringify(theme) !== JSON.stringify(settings.theme ?? {})),
  );
  useUnsavedWarning(hasUnsavedChanges);

  // 即時預覽：套到 document，切換關閉時還原
  useEffect(() => {
    if (!previewOn) return;
    const revert = applyTheme(theme);
    return revert;
  }, [previewOn, theme]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fields"] });
      toast({ title: "已儲存視覺主題" });
    },
    onError: (err: unknown) => {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "未知錯誤",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    // 只傳有值的欄位（空字串 URL 視為清除）
    const cleanedTheme: FieldTheme = {};
    if (theme.primaryColor) cleanedTheme.primaryColor = theme.primaryColor;
    if (theme.accentColor) cleanedTheme.accentColor = theme.accentColor;
    if (theme.backgroundColor) cleanedTheme.backgroundColor = theme.backgroundColor;
    if (theme.textColor) cleanedTheme.textColor = theme.textColor;
    if (theme.layoutTemplate) cleanedTheme.layoutTemplate = theme.layoutTemplate;
    if (theme.fontFamily) cleanedTheme.fontFamily = theme.fontFamily;
    if (theme.coverImageUrl) cleanedTheme.coverImageUrl = theme.coverImageUrl;
    if (theme.brandingLogoUrl) cleanedTheme.brandingLogoUrl = theme.brandingLogoUrl;

    saveMutation.mutate({
      // legacy 同時也寫以保相容
      primaryColor: theme.primaryColor,
      welcomeMessage,
      theme: cleanedTheme,
    });
  };

  const updateTheme = (patch: Partial<FieldTheme>) =>
    setTheme((prev) => ({ ...prev, ...patch }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* 左側：設定面板 */}
      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" /> 視覺主題
              </CardTitle>
              <CardDescription>色系、版面、字體、底圖 — 打造場域獨有風格</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">即時預覽</label>
              <Switch checked={previewOn} onCheckedChange={setPreviewOn} data-testid="switch-preview" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 🆕 快速套用預設主題 */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              快速套用預設
              <span className="text-xs text-muted-foreground font-normal">
                （點一下一鍵換成該配色）
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {THEME_PRESETS.map((p) => {
                const isActive = findMatchingPreset(theme) === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setTheme((prev) => ({
                        ...prev,
                        ...p.theme,
                      }))
                    }
                    className={`text-left p-3 rounded-lg border transition-all hover:shadow-md ${
                      isActive
                        ? "border-primary ring-1 ring-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`preset-${p.id}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">{p.icon}</span>
                      <span className="font-medium text-sm">{p.label}</span>
                      {isActive && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded ml-auto">
                          使用中
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mb-1.5">
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: p.theme.primaryColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: p.theme.accentColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: p.theme.backgroundColor }}
                      />
                      <span
                        className="w-4 h-4 rounded-full border border-black/10"
                        style={{ backgroundColor: p.theme.textColor }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* 顏色 4 色 */}
          <div className="grid grid-cols-2 gap-4">
            <ColorField
              label="主色調"
              hint="按鈕、Link、強調"
              value={theme.primaryColor || ""}
              onChange={(v) => updateTheme({ primaryColor: v })}
              testId="color-primary"
            />
            <ColorField
              label="輔色"
              hint="Badge、次要按鈕"
              value={theme.accentColor || ""}
              onChange={(v) => updateTheme({ accentColor: v })}
              testId="color-accent"
            />
            <ColorField
              label="背景色"
              hint="整頁底色"
              value={theme.backgroundColor || ""}
              onChange={(v) => updateTheme({ backgroundColor: v })}
              testId="color-background"
            />
            <ColorField
              label="文字色"
              hint="主要文字"
              value={theme.textColor || ""}
              onChange={(v) => updateTheme({ textColor: v })}
              testId="color-text"
            />
          </div>

          {/* 版面模板 */}
          <div>
            <label className="text-sm font-medium mb-1 block">版面模板</label>
            <Select
              value={theme.layoutTemplate || "classic"}
              onValueChange={(v) => updateTheme({ layoutTemplate: v as NonNullable<FieldTheme["layoutTemplate"]> })}
            >
              <SelectTrigger data-testid="select-layout">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <div>
                      <div className="font-medium">{o.label}</div>
                      <div className="text-xs text-muted-foreground">{o.desc}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 字體 */}
          <div>
            <label className="text-sm font-medium mb-1 block flex items-center gap-2">
              <Type className="w-4 h-4" /> 字體風格
            </label>
            <Select
              value={theme.fontFamily || "default"}
              onValueChange={(v) => updateTheme({ fontFamily: v as NonNullable<FieldTheme["fontFamily"]> })}
            >
              <SelectTrigger data-testid="select-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    <div className="flex items-center justify-between gap-4 w-full">
                      <span>{o.label}</span>
                      <span
                        className="text-sm opacity-70"
                        style={{ fontFamily: o.previewFont }}
                      >
                        {o.sample}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 底圖（上傳或貼 URL） */}
          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> 場域封面圖
            </label>
            <UploadImageButton
              endpoint={`/api/admin/fields/${fieldId}/cloudinary-cover`}
              currentUrl={theme.coverImageUrl}
              onUploaded={(url) => updateTheme({ coverImageUrl: url })}
              label="上傳封面圖"
              hint="建議 1920×1080（16:9），最大 10MB。用於玩家端遊戲列表頂部。"
              maxBytes={10 * 1024 * 1024}
              testId="btn-upload-cover"
            />
            <Input
              value={theme.coverImageUrl || ""}
              onChange={(e) => updateTheme({ coverImageUrl: e.target.value })}
              placeholder="或直接貼 https:// URL"
              className="font-mono text-xs mt-2"
              data-testid="input-cover-url"
            />
          </div>

          {/* Logo（上傳或貼 URL） */}
          <div>
            <label className="text-sm font-medium mb-2 block">Logo（覆蓋場域預設 logo）</label>
            <UploadImageButton
              endpoint={`/api/admin/fields/${fieldId}/cloudinary-logo`}
              currentUrl={theme.brandingLogoUrl}
              onUploaded={(url) => updateTheme({ brandingLogoUrl: url })}
              label="上傳 Logo"
              hint="建議正方形或透明 PNG，最大 5MB。顯示於 header 左上角。"
              maxBytes={5 * 1024 * 1024}
              testId="btn-upload-logo"
            />
            <Input
              value={theme.brandingLogoUrl || ""}
              onChange={(e) => updateTheme({ brandingLogoUrl: e.target.value })}
              placeholder="或直接貼 https:// URL"
              className="font-mono text-xs mt-2"
              data-testid="input-logo-url"
            />
          </div>

          {/* 歡迎訊息 */}
          <div>
            <label className="text-sm font-medium mb-1 block">歡迎訊息</label>
            <Input
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="歡迎來到我們的實境遊戲！"
              data-testid="input-welcome-message"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || !hasUnsavedChanges}
              className="gap-2"
              data-testid="button-save-brand"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              儲存視覺主題
            </Button>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                有未儲存變更
              </div>
            )}

            {/* 🆕 在新分頁預覽玩家端（不需儲存也能看） */}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const encoded = encodePreviewTheme(theme);
                const url = `/home?${PREVIEW_QUERY_KEY}=${encoded}`;
                window.open(url, "_blank", "noopener");
              }}
              className="gap-2"
              data-testid="button-preview-in-new-tab"
            >
              <ExternalLink className="w-4 h-4" />
              在新分頁看玩家端
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 提示：「新分頁預覽」會把目前設定編碼到網址，就算還沒儲存也能先看效果；
            關閉分頁就消失，不影響正式場域。
          </p>
        </CardContent>
      </Card>

      {/* 右側：預覽 */}
      <Card className="lg:col-span-2 lg:sticky lg:top-6 h-fit">
        <CardHeader>
          <CardTitle className="text-base">預覽</CardTitle>
          <CardDescription>
            {previewOn ? "🟢 全站即時預覽中（儲存前全頁都會套用）" : "下方為示意卡片"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemePreviewCard theme={theme} />
        </CardContent>
      </Card>
    </div>
  );
}

/** 顏色輸入欄（色票 + hex 輸入） */
function ColorField({
  label, hint, value, onChange, testId,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1 block">{label}</label>
      {hint && <p className="text-xs text-muted-foreground mb-1">{hint}</p>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded border cursor-pointer shrink-0"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-xs"
          data-testid={testId}
        />
      </div>
    </div>
  );
}

/** 主題預覽卡 — 顯示色票 + mock 元件 */
function ThemePreviewCard({ theme }: { theme: FieldTheme }) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        backgroundColor: theme.backgroundColor || undefined,
        color: theme.textColor || undefined,
      }}
    >
      {/* 色票 */}
      <div className="flex gap-2 mb-4">
        <Swatch color={theme.primaryColor} label="主" />
        <Swatch color={theme.accentColor} label="輔" />
        <Swatch color={theme.backgroundColor} label="背" />
        <Swatch color={theme.textColor} label="字" />
      </div>

      {/* Mock 標題 */}
      <div className="mb-3 font-bold text-lg" style={{ color: theme.textColor }}>
        場域大廳
      </div>
      <div className="text-xs opacity-70 mb-3">版面：{theme.layoutTemplate || "classic"}</div>

      {/* Mock 按鈕 */}
      <div className="flex gap-2 mb-3">
        <button
          className="px-3 py-1 rounded text-xs font-medium text-white"
          style={{ backgroundColor: theme.primaryColor || "#f97316" }}
        >
          開始遊戲
        </button>
        <button
          className="px-3 py-1 rounded text-xs border"
          style={{ borderColor: theme.accentColor || theme.primaryColor || "#999" }}
        >
          地圖
        </button>
      </div>

      {/* Mock 底圖 */}
      {theme.coverImageUrl && (
        <div
          className="h-24 rounded bg-cover bg-center mb-2 border"
          style={{ backgroundImage: `url(${theme.coverImageUrl})` }}
        />
      )}
      {theme.brandingLogoUrl && (
        <div className="flex items-center gap-2 text-xs">
          <img src={theme.brandingLogoUrl} alt="logo" className="h-6 object-contain" />
          <span className="opacity-60">Logo 預覽</span>
        </div>
      )}
    </div>
  );
}

function Swatch({ color, label }: { color?: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="w-10 h-10 rounded border shrink-0"
        style={{ backgroundColor: color || "transparent" }}
      />
      <span className="text-[10px] opacity-60 mt-0.5">{label}</span>
    </div>
  );
}

// ============================================================================
// 共用元件
// ============================================================================

function ToggleRow({
  label, description, helpText, checked, onChange, testId,
}: {
  label: string;
  description: string;
  /** 🆕 hover 小問號時顯示的完整說明 */
  helpText?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-medium text-sm">{label}</p>
          {helpText && (
            <Tooltip delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/50 hover:text-primary transition-colors cursor-help shrink-0"
                  aria-label={`${label} 說明`}
                  data-testid={`${testId}-help`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px] text-xs">
                <p className="font-semibold mb-1">{label}</p>
                <p className="leading-relaxed">{helpText}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}
