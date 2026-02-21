// 場域設定頁面 — AI Key、配額、功能開關、品牌
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bot, Settings2, Palette, Save, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

interface FieldSettingsResponse {
  enableAI?: boolean;
  hasGeminiApiKey: boolean;
  maxGames?: number;
  maxConcurrentSessions?: number;
  enablePayment?: boolean;
  enableTeamMode?: boolean;
  enableCompetitiveMode?: boolean;
  primaryColor?: string;
  welcomeMessage?: string;
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
      <AdminLayout title="場域設定">
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          載入中...
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="場域設定">
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
    </AdminLayout>
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
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
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
          設定場域專屬的 Gemini API Key，用於照片驗證和文字語意評分
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
            <p className="font-medium">Gemini API Key</p>
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
                placeholder="貼上新的 Gemini API Key..."
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
// 品牌 Tab
// ============================================================================

function BrandTab({ fieldId, settings }: { fieldId: string; settings?: FieldSettingsResponse }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [primaryColor, setPrimaryColor] = useState(settings?.primaryColor ?? "#6366f1");
  const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcomeMessage ?? "");

  useEffect(() => {
    if (!settings) return;
    setPrimaryColor(settings.primaryColor ?? "#6366f1");
    setWelcomeMessage(settings.welcomeMessage ?? "");
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/fields/${fieldId}/settings`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/fields", fieldId, "settings"] });
      toast({ title: "已儲存品牌設定" });
    },
    onError: () => {
      toast({ title: "儲存失敗", variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({ primaryColor, welcomeMessage });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" /> 品牌設定
        </CardTitle>
        <CardDescription>自訂場域的視覺風格</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-1 block">主色調</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded-md border cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#6366f1"
              className="w-32 font-mono"
              data-testid="input-primary-color"
            />
            <div
              className="w-10 h-10 rounded-md border"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>
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
          儲存品牌設定
        </Button>
      </CardContent>
    </Card>
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
