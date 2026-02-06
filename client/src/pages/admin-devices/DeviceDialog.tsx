// 裝置新增/編輯對話框
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
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
}

export default function DeviceDialog({
  open,
  onOpenChange,
  isEditing,
  formData,
  setFormData,
  onSubmit,
  isPending,
}: DeviceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{isEditing ? "編輯設備" : "新增設備"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
              <SelectTrigger data-testid={isEditing ? "select-edit-device-type" : "select-device-type"}>
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
            <Label>MQTT Topic</Label>
            <Input
              value={formData.mqttTopic || ""}
              onChange={(e) => setFormData({ ...formData, mqttTopic: e.target.value })}
              placeholder="例如: jiachun/targets/device-001"
              data-testid={isEditing ? "input-edit-mqtt-topic" : "input-mqtt-topic"}
            />
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
            {isPending ? (isEditing ? "更新中..." : "新增中...") : (isEditing ? "更新" : "新增")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
