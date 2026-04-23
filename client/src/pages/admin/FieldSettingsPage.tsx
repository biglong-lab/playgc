// 場域設定頁面 — AI Key、配額、功能開關、品牌、視覺主題
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Settings2, Palette, Save, Eye, EyeOff, Loader2, ShieldCheck, Image as ImageIcon, Type, Sparkles } from "lucide-react";
import type { FieldTheme } from "@shared/schema";
import { applyTheme } from "@/lib/themeUtils";
import { THEME_PRESETS, findMatchingPreset } from "@/lib/themePresets";
import { UploadImageButton } from "@/components/shared/UploadImageButton";

interface FieldSettingsResponse {
  enableAI?: boolean;
  hasGeminiApiKey: boolean;
  maxGames?: number;
  maxConcurrentSessions?: number;
  enablePayment?: boolean;
  enableTeamMode?: boolean;
  enableCompetitiveMode?: boolean;
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
        <Tabs defaultValue="ai" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai" className="gap-2">
              <Bot className="w-4 h-4" /> AI 設定
            </TabsTrigger>
            <TabsTrigger value="features" className="gap-2">
              <Settings2 className="w-4 h-4" /> 功能與配額
            </TabsTrigger>
            <TabsTrigger value="brand" className="gap-2">
              <Palette className="w-4 h-4" /> 品牌
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <AiSettingsTab fieldId={fieldId} settings={settings} />
          </TabsContent>
          <TabsContent value="features">
            <FeaturesTab fieldId={fieldId} settings={settings} />
          </TabsContent>
          <TabsContent value="brand">
            <BrandTab fieldId={fieldId} settings={settings} />
          </TabsContent>
        </Tabs>
      )}
    </UnifiedAdminLayout>
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

  useEffect(() => {
    if (!settings) return;
    setMaxGames(settings.maxGames ?? 0);
    setMaxSessions(settings.maxConcurrentSessions ?? 0);
    setEnablePayment(settings.enablePayment ?? false);
    setEnableTeamMode(settings.enableTeamMode ?? true);
    setEnableCompetitive(settings.enableCompetitiveMode ?? true);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
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
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> 功能與配額
        </CardTitle>
        <CardDescription>
          控制場域可用的功能和資源上限
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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

        {/* 功能開關 */}
        <div className="space-y-4">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">功能開關</h3>
          <ToggleRow
            label="收費功能"
            description="允許遊戲設定收費和兌換碼"
            checked={enablePayment}
            onChange={setEnablePayment}
            testId="switch-payment"
          />
          <ToggleRow
            label="團隊模式"
            description="允許遊戲使用團隊分組功能"
            checked={enableTeamMode}
            onChange={setEnableTeamMode}
            testId="switch-team"
          />
          <ToggleRow
            label="競賽/接力模式"
            description="允許遊戲使用競賽和接力賽功能"
            checked={enableCompetitive}
            onChange={setEnableCompetitive}
            testId="switch-competitive"
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="gap-2"
          data-testid="button-save-features"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          儲存設定
        </Button>
      </CardContent>
    </Card>
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

const FONT_OPTIONS: { value: NonNullable<FieldTheme["fontFamily"]>; label: string }[] = [
  { value: "default", label: "預設字體（系統）" },
  { value: "serif", label: "襯線（文藝）" },
  { value: "mono", label: "等寬（科技感）" },
  { value: "display", label: "展示字體（遊戲感）" },
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
                    {o.label}
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

          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="gap-2"
            data-testid="button-save-brand"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            儲存視覺主題
          </Button>
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
  label, description, checked, onChange, testId,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}
