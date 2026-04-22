// 🎯 通用 Arduino 裝置選擇器
//
// 用途：ShootingMission 或其他需要硬體裝置引用的地方
// 取代：管理員手寫 deviceId 字串（TARGET_001 etc.）
//
// value 是 arduinoDevices.deviceId（硬體 unique ID，非 UUID），對應 MQTT topic。
// 顯示：deviceName + 線上狀態 dot + 電量
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Radio, AlertTriangle, Battery, WifiOff } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface ArduinoDevice {
  id: string;
  deviceId: string | null; // 硬體 ID (e.g. TARGET_001)
  deviceName: string;
  deviceType?: string | null;
  status?: string | null; // online / offline / error / maintenance
  batteryLevel?: number | null;
  lastHeartbeat?: string | null;
}

interface DeviceSelectProps {
  value?: string;
  onChange: (deviceId: string) => void;
  /** 允許「不限裝置（任何）」選項 */
  allowEmpty?: boolean;
  /** 過濾特定 deviceType（例：只顯示 shooting_target） */
  filterType?: string;
  placeholder?: string;
  className?: string;
  testId?: string;
}

function statusColor(status?: string | null) {
  switch (status) {
    case "online":
      return "bg-emerald-500";
    case "error":
      return "bg-red-500";
    case "maintenance":
      return "bg-amber-500";
    default:
      return "bg-gray-400";
  }
}

function statusLabel(status?: string | null) {
  switch (status) {
    case "online":
      return "線上";
    case "offline":
      return "離線";
    case "error":
      return "錯誤";
    case "maintenance":
      return "維護中";
    default:
      return "未知";
  }
}

export function DeviceSelect({
  value,
  onChange,
  allowEmpty = false,
  filterType,
  placeholder = "選擇硬體裝置...",
  className,
  testId,
}: DeviceSelectProps) {
  const { data: devices, isLoading } = useQuery<ArduinoDevice[]>({
    queryKey: ["/api/admin/devices"],
    queryFn: () => fetchWithAdminAuth("/api/admin/devices"),
    staleTime: 30_000, // 30s cache，狀態變動夠快
  });

  const filtered = filterType
    ? devices?.filter((d) => d.deviceType === filterType)
    : devices;

  const existingDevice = value && filtered?.find((d) => d.deviceId === value);
  const hasValueButNotFound = !!value && filtered && !existingDevice;

  return (
    <Select
      value={value || "__empty__"}
      onValueChange={(v) => onChange(v === "__empty__" ? "" : v)}
    >
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue
          placeholder={isLoading ? "載入裝置清單..." : placeholder}
        />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && (
          <SelectItem value="__empty__">
            <span className="text-muted-foreground">不指定（任何裝置）</span>
          </SelectItem>
        )}

        {filtered?.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground">
            {filterType
              ? `尚無 ${filterType} 類型的裝置`
              : "尚無已註冊的硬體裝置"}
            <br />
            請先到「裝置管理」註冊 Arduino 設備
          </div>
        )}

        {filtered?.map((device) => {
          if (!device.deviceId) return null; // 沒有硬體 ID 的裝置無法選（無法對應 MQTT）
          const isOnline = device.status === "online";
          return (
            <SelectItem key={device.id} value={device.deviceId}>
              <span className="flex items-center gap-2">
                {isOnline ? (
                  <Radio className="w-3 h-3 text-emerald-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gray-400" />
                )}
                <span>{device.deviceName}</span>
                <code className="text-xs text-muted-foreground">
                  ({device.deviceId})
                </code>
                <span
                  className={`w-2 h-2 rounded-full ${statusColor(device.status)}`}
                  title={statusLabel(device.status)}
                />
                {typeof device.batteryLevel === "number" && device.batteryLevel < 30 && (
                  <Badge variant="outline" className="text-xs gap-1 text-amber-600">
                    <Battery className="w-3 h-3" />
                    {device.batteryLevel}%
                  </Badge>
                )}
              </span>
            </SelectItem>
          );
        })}

        {hasValueButNotFound && (
          <SelectItem value={value}>
            <span className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              舊資料：{value}（裝置可能已移除，建議重選）
            </span>
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
