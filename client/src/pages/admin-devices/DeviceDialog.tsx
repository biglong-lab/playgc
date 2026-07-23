// 裝置新增/編輯對話框
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import type { InsertArduinoDevice } from "@shared/schema";
import { DEVICE_TYPES } from "./constants";

interface DeviceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditing: boolean;
  formData: Partial<InsertArduinoDevice>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<InsertArduinoDevice>>>;
  onSubmit: () => void;
  isPending: boolean;
  /** 目前登入場域代號，用於預覽自動產生的 MQTT topic */
  fieldCode?: string;
}

export default function DeviceDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isPending,
  fieldCode,
}: DeviceDialogProps) {
  const topicPreview =
    formData.deviceId && fieldCode
      ? `chito/v1/${fieldCode}/${formData.deviceId}/…`
      : "填寫硬體 ID 後自動產生";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "編輯設備" : "新增設備"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              硬體 ID <span className="text-destructive">*</span>
            </Label>
            <Input
              value={formData.deviceId || ""}
              onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
              placeholder="例如: TARGET_001"
              disabled={isEditing}
              data-testid={isEditing ? "input-edit-device-id" : "input-device-id"}
            />
            <p className="text-xs text-muted-foreground">
              需與韌體燒錄的 ID 完全一致；心跳與命中都靠它比對。建立後不可修改。
            </p>
          </div>
          <div className="space-y-2">
            <Label>設備名稱</Label>
            <Input
              value={formData.deviceName || ""}
              onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })}
              placeholder="例如: 射擊靶機 A1"
              data-testid={isEditing ? "input-edit-device-name" : "input-device-name"}
            />
          </div>
          <div className="space-y-2">
            <Label>設備類型</Label>
            <Select
              value={formData.deviceType || "shooting_target"}
              onValueChange={(v) => setFormData({ ...formData, deviceType: v })}
            >
              <SelectTrigger
                data-testid={isEditing ? "select-edit-device-type" : "select-device-type"}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEVICE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>MQTT Topic（系統自動產生）</Label>
            <Input
              value={topicPreview}
              readOnly
              disabled
              className="text-muted-foreground"
              data-testid={isEditing ? "input-edit-mqtt-topic" : "input-mqtt-topic"}
            />
            <p className="text-xs text-muted-foreground">
              依 MQTT v1 契約由系統產生，不需手填（結尾 channel 為 event / state / command 等）。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>緯度</Label>
              <Input
                value={formData.locationLat || ""}
                onChange={(e) => setFormData({ ...formData, locationLat: e.target.value })}
                placeholder="例如: 24.1234"
                data-testid={isEditing ? "input-edit-location-lat" : "input-location-lat"}
              />
            </div>
            <div className="space-y-2">
              <Label>經度</Label>
              <Input
                value={formData.locationLng || ""}
                onChange={(e) => setFormData({ ...formData, locationLng: e.target.value })}
                placeholder="例如: 120.5678"
                data-testid={isEditing ? "input-edit-location-lng" : "input-location-lng"}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button
            onClick={onSubmit}
            disabled={isPending}
            data-testid={isEditing ? "button-update-device" : "button-submit-device"}
          >
            {isPending ? (isEditing ? "更新中..." : "新增中...") : isEditing ? "更新" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
