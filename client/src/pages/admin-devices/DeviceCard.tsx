// 裝置卡片元件
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import {
  Cpu, Play, Square, Edit, Trash2, Info, Radio, Battery, FileText, Globe
} from "lucide-react";
import type { ArduinoDevice, InsertArduinoDevice } from "@shared/schema";
import { DEVICE_TYPES } from "./constants";
import DeviceDialog from "./DeviceDialog";

interface DeviceCardProps {
  device: ArduinoDevice;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCloseEdit: () => void;
  formData: Partial<InsertArduinoDevice>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<InsertArduinoDevice>>>;
  onSubmit: () => void;
  activatePending: boolean;
  deactivatePending: boolean;
  updatePending: boolean;
  deletePending: boolean;
}

export default function DeviceCard({
  device,
  isSelected,
  isEditing,
  onSelect,
  onActivate,
  onDeactivate,
  onEdit,
  onDelete,
  onCloseEdit,
  formData,
  setFormData,
  onSubmit,
  activatePending,
  deactivatePending,
  updatePending,
  deletePending,
}: DeviceCardProps) {
  return (
    <Card
      className={`relative cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
      data-testid={`card-device-${device.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              device.status === "online"
                ? "bg-success/10"
                : "bg-muted"
            }`}>
              <Cpu className={`w-5 h-5 ${
                device.status === "online"
                  ? "text-success"
                  : "text-muted-foreground"
              }`} />
            </div>
            <div>
              <CardTitle className="text-base">{device.deviceName}</CardTitle>
              <CardDescription>
                {DEVICE_TYPES.find(t => t.value === device.deviceType)?.label || device.deviceType}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={device.status === "online" ? "default" : "secondary"}
            className={device.status === "online" ? "bg-success" : ""}
          >
            {device.status === "online" ? "在線" : "離線"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {device.deviceId && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Info className="w-3 h-3" />
              <span className="truncate">ID: {device.deviceId}</span>
            </div>
          )}
          {device.mqttTopic && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Radio className="w-3 h-3" />
              <span className="truncate">{device.mqttTopic}</span>
            </div>
          )}
          {device.batteryLevel !== null && device.batteryLevel !== undefined && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Battery className="w-3 h-3" />
              <span>電量: {device.batteryLevel}%</span>
            </div>
          )}
          {device.firmwareVersion && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-3 h-3" />
              <span>韌體: {device.firmwareVersion}</span>
            </div>
          )}
          {device.ipAddress && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-3 h-3" />
              <span>IP: {device.ipAddress}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            disabled={activatePending}
            className="flex-1 gap-1"
            data-testid={`button-activate-${device.id}`}
          >
            <Play className="w-3 h-3" />
            啟動
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDeactivate();
            }}
            disabled={deactivatePending}
            className="flex-1 gap-1"
            data-testid={`button-deactivate-${device.id}`}
          >
            <Square className="w-3 h-3" />
            停用
          </Button>
          <Dialog
            open={isEditing}
            onOpenChange={(open) => !open && onCloseEdit()}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                data-testid={`button-edit-${device.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DeviceDialog
              open={isEditing}
              onOpenChange={(open) => !open && onCloseEdit()}
              isEditing={true}
              formData={formData}
              setFormData={setFormData}
              onSubmit={onSubmit}
              isPending={updatePending}
            />
          </Dialog>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={deletePending}
            className="text-destructive hover:text-destructive"
            data-testid={`button-delete-${device.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
