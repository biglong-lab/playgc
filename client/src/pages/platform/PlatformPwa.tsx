// 📱 PWA 管理
//
// 顯示 Service Worker / Manifest / Push 通知配置狀態
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Bell, Cloud, CheckCircle2, XCircle } from "lucide-react";

interface PwaStatus {
  manifest: {
    name: string;
    shortName: string;
    themeColor: string;
    backgroundColor: string;
    display: string;
    orientation: string;
  };
  serviceWorker: {
    enabled: boolean;
    strategy: string;
    autoUpdate: boolean;
    skipWaiting: boolean;
    clientsClaim: boolean;
  };
  push: {
    enabled: boolean;
    vapidPublicSet: boolean;
    vapidPrivateSet: boolean;
    publicKey: string | null;
  };
  notes: string[];
}

export default function PlatformPwa() {
  const { isAuthenticated } = useAdminAuth();

  const { data, isLoading } = useQuery<PwaStatus>({
    queryKey: ["/api/platform/pwa-status"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/pwa-status")).json(),
    enabled: isAuthenticated,
  });

  return (
    <PlatformAdminLayout title="PWA 管理">
      <Card className="mb-4 border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-1">📱 漸進式網頁應用程式 (PWA)</p>
          <p className="text-xs text-muted-foreground">
            此頁顯示 PWA 配置狀態。修改設定請改 vite.config.ts 與 .env，重新部署即生效（玩家會自動更新）。
          </p>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <Card><CardContent className="p-4">載入中...</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {/* App Manifest */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">App Manifest</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <ManifestField label="App 名稱" value={data.manifest.name} />
                <ManifestField label="短名稱" value={data.manifest.shortName} />
                <ManifestField label="主題色" value={data.manifest.themeColor} colorPreview />
                <ManifestField label="背景色" value={data.manifest.backgroundColor} colorPreview />
                <ManifestField label="顯示模式" value={data.manifest.display} />
                <ManifestField label="螢幕方向" value={data.manifest.orientation} />
              </div>
            </CardContent>
          </Card>

          {/* Service Worker */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Cloud className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Service Worker</h3>
                <Badge className="bg-emerald-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  啟用中
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <ManifestField label="生成策略" value={data.serviceWorker.strategy} mono />
                <ManifestField
                  label="自動更新"
                  value={data.serviceWorker.autoUpdate ? "✅ 啟用" : "❌ 停用"}
                />
                <ManifestField
                  label="skipWaiting"
                  value={data.serviceWorker.skipWaiting ? "✅ 啟用（部署後立即生效）" : "❌ 停用"}
                />
                <ManifestField
                  label="clientsClaim"
                  value={data.serviceWorker.clientsClaim ? "✅ 啟用" : "❌ 停用"}
                />
              </div>
            </CardContent>
          </Card>

          {/* Push 通知 */}
          <Card className={data.push.enabled ? "" : "border-l-4 border-l-amber-500"}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Push 通知 (Web Push)</h3>
                {data.push.enabled ? (
                  <Badge className="bg-emerald-500">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    可用
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    未配置 VAPID
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  {data.push.vapidPublicSet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <code className="text-xs font-mono">VITE_VAPID_PUBLIC_KEY</code>
                </div>
                <div className="flex items-center gap-2">
                  {data.push.vapidPrivateSet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive" />
                  )}
                  <code className="text-xs font-mono">VAPID_PRIVATE_KEY</code>
                </div>
              </div>
              {data.push.publicKey && (
                <div className="mt-3 p-2 bg-muted/30 rounded">
                  <div className="text-[10px] text-muted-foreground">Public Key（遮罩）</div>
                  <code className="text-xs font-mono">{data.push.publicKey}</code>
                </div>
              )}
              {!data.push.enabled && (
                <div className="mt-3 p-2 bg-amber-500/10 rounded text-xs text-amber-700">
                  💡 設定 VAPID 金鑰可啟用 Web Push 通知。產生指令：
                  <code className="block mt-1 font-mono">npx web-push generate-vapid-keys</code>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 注意事項 */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-semibold mb-2">💡 操作提示</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {data.notes.map((note, i) => (
                  <li key={i}>• {note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </PlatformAdminLayout>
  );
}

function ManifestField({
  label,
  value,
  mono,
  colorPreview,
}: {
  label: string;
  value: string;
  mono?: boolean;
  colorPreview?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground w-20 shrink-0">{label}：</span>
      {colorPreview && (
        <span
          className="w-4 h-4 rounded border shrink-0"
          style={{ backgroundColor: value }}
        />
      )}
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}
