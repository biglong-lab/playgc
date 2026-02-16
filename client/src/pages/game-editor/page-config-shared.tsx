// 頁面設定編輯器 - 共用區塊（獎勵、地圖定位）
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Gift, MapPin } from "lucide-react";
import ItemRewardPicker from "@/components/ItemRewardPicker";

export interface SharedSectionProps {
  config: Record<string, any>;
  updateField: (field: string, value: any) => void;
  gameId: string;
}

// 獎勵設定區塊
export function RewardsSection({ config, updateField, gameId }: SharedSectionProps) {
  return (
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
}

// 位置設定區塊
export function LocationSettingsSection({ config, updateField }: Omit<SharedSectionProps, 'gameId'>) {
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
}
