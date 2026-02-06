// 裝置統計與日誌面板
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings, Target, FileText, RefreshCw, Info, Crosshair, RotateCcw
} from "lucide-react";
import type { DeviceLog } from "@shared/schema";
import type { DeviceStatistics } from "./types";

interface DeviceStatsProps {
  stats: DeviceStatistics | undefined;
  logs: DeviceLog[] | undefined;
  onCommand: (command: string) => void;
  isPending: boolean;
}

export default function DeviceStats({ stats, logs, onCommand, isPending }: DeviceStatsProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="w-4 h-4" />
            設備控制
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand("ping")}
              disabled={isPending}
              className="gap-1"
              data-testid="button-cmd-ping"
            >
              <RefreshCw className="w-3 h-3" />
              Ping
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand("status")}
              disabled={isPending}
              className="gap-1"
              data-testid="button-cmd-status"
            >
              <Info className="w-3 h-3" />
              狀態
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand("calibrate")}
              disabled={isPending}
              className="gap-1"
              data-testid="button-cmd-calibrate"
            >
              <Crosshair className="w-3 h-3" />
              校準
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCommand("reboot")}
              disabled={isPending}
              className="gap-1 text-destructive"
              data-testid="button-cmd-reboot"
            >
              <RotateCcw className="w-3 h-3" />
              重啟
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4" />
            射擊統計
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">總命中數</p>
                  <p className="font-number text-xl font-bold">{stats.totalHits}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">總得分</p>
                  <p className="font-number text-xl font-bold">{stats.totalScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">平均得分</p>
                  <p className="font-number text-xl font-bold">{stats.averageScore?.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">最高分</p>
                  <p className="font-number text-xl font-bold text-primary">{stats.highestScore}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              暫無統計資料
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            設備日誌
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {logs && logs.length > 0 ? (
              <div className="space-y-2">
                {logs.slice(0, 10).map((log, index) => (
                  <div key={index} className="text-xs border-b border-border pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {log.logType}
                      </Badge>
                      <span className="text-muted-foreground">
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString() : ""}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground truncate">{log.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                暫無日誌
              </p>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}
