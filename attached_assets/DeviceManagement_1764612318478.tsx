/**
 * 賈村競技體驗場 - 設備管理頁面
 * 
 * 功能:
 * - 顯示所有設備列表
 * - 即時顯示設備狀態
 * - 控制設備 (開始/停止/重置/測試)
 * - 控制 LED 燈
 * - 查看射擊記錄與統計
 * - 查看設備日誌
 * 
 * 檔案位置: client/src/pages/Admin/DeviceManagement.tsx
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Power, 
  RotateCcw, 
  TestTube,
  Lightbulb,
  Target,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Device {
  id: number;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  location: string | null;
  status: 'online' | 'offline' | 'error';
  lastHeartbeat: string | null;
  batteryLevel: number | null;
  firmwareVersion: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShootingRecord {
  id: number;
  deviceId: string;
  gameSessionId: number | null;
  targetZone: string;
  score: number;
  hitTimestamp: string;
}

interface DeviceStatistics {
  deviceId: string;
  period: string;
  totalHits: number;
  totalScore: number;
  avgScore: number;
  records: number;
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [shootingRecords, setShootingRecords] = useState<ShootingRecord[]>([]);
  const [statistics, setStatistics] = useState<DeviceStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  // 載入設備列表
  useEffect(() => {
    fetchDevices();
    
    // 建立 WebSocket 連線以接收即時更新
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket 已連線');
    };
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket 錯誤:', error);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket 已斷線');
    };
    
    setWs(websocket);
    
    // 清理
    return () => {
      websocket.close();
    };
  }, []);

  // 處理 WebSocket 訊息
  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'device_message') {
      // 設備訊息更新,重新載入設備列表
      fetchDevices();
      
      // 如果是當前選中的設備,更新相關資訊
      if (selectedDevice && message.deviceId === selectedDevice.deviceId) {
        if (message.action === 'hit') {
          fetchShootingRecords(selectedDevice.deviceId);
          fetchStatistics(selectedDevice.deviceId);
        }
      }
      
      // 顯示通知
      if (message.action === 'hit') {
        toast({
          title: '射擊命中!',
          description: `設備 ${message.deviceId} 得分: ${message.data.score}`,
        });
      }
    }
  };

  // 取得設備列表
  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/devices');
      if (!response.ok) throw new Error('取得設備列表失敗');
      const data = await response.json();
      setDevices(data);
    } catch (error) {
      console.error('取得設備列表失敗:', error);
      toast({
        title: '錯誤',
        description: '取得設備列表失敗',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // 取得射擊記錄
  const fetchShootingRecords = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/shooting-records?limit=50`);
      if (!response.ok) throw new Error('取得射擊記錄失敗');
      const data = await response.json();
      setShootingRecords(data);
    } catch (error) {
      console.error('取得射擊記錄失敗:', error);
    }
  };

  // 取得統計資訊
  const fetchStatistics = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/statistics?days=7`);
      if (!response.ok) throw new Error('取得統計資訊失敗');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('取得統計資訊失敗:', error);
    }
  };

  // 選擇設備
  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
    fetchShootingRecords(device.deviceId);
    fetchStatistics(device.deviceId);
  };

  // 發送控制指令
  const sendControlCommand = async (deviceId: string, command: string, params?: any) => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, ...params }),
      });
      
      if (!response.ok) throw new Error('發送控制指令失敗');
      
      toast({
        title: '成功',
        description: `已發送 ${command} 指令`,
      });
    } catch (error) {
      console.error('發送控制指令失敗:', error);
      toast({
        title: '錯誤',
        description: '發送控制指令失敗',
        variant: 'destructive',
      });
    }
  };

  // 控制 LED
  const controlLED = async (deviceId: string, color: string, mode: string = 'solid') => {
    try {
      const response = await fetch(`/api/devices/${deviceId}/led`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color, mode }),
      });
      
      if (!response.ok) throw new Error('控制 LED 失敗');
      
      toast({
        title: '成功',
        description: `LED 已設定為 ${color}`,
      });
    } catch (error) {
      console.error('控制 LED 失敗:', error);
      toast({
        title: '錯誤',
        description: '控制 LED 失敗',
        variant: 'destructive',
      });
    }
  };

  // 取得狀態徽章
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      online: { label: '在線', variant: 'success' as const, icon: Wifi },
      offline: { label: '離線', variant: 'secondary' as const, icon: WifiOff },
      error: { label: '錯誤', variant: 'destructive' as const, icon: Activity },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Activity className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">載入設備資訊中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">設備管理</h1>
        <p className="text-muted-foreground">管理與監控所有 Arduino 射擊靶機設備</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左側: 設備列表 */}
        <div className="lg:col-span-1">
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">設備列表</h2>
            
            {devices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>尚無設備</p>
              </div>
            ) : (
              <div className="space-y-2">
                {devices.map((device) => (
                  <button
                    key={device.id}
                    onClick={() => handleSelectDevice(device)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedDevice?.id === device.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{device.deviceName}</span>
                      {getStatusBadge(device.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>ID: {device.deviceId}</p>
                      {device.location && <p>位置: {device.location}</p>}
                      {device.lastHeartbeat && (
                        <p>最後心跳: {new Date(device.lastHeartbeat).toLocaleString('zh-TW')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 右側: 設備詳細資訊與控制 */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <div className="space-y-6">
              {/* 設備資訊卡片 */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">{selectedDevice.deviceName}</h2>
                  {getStatusBadge(selectedDevice.status)}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">設備 ID</p>
                    <p className="font-mono">{selectedDevice.deviceId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">設備類型</p>
                    <p>{selectedDevice.deviceType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">IP 位址</p>
                    <p className="font-mono">{selectedDevice.ipAddress || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">韌體版本</p>
                    <p>{selectedDevice.firmwareVersion || 'N/A'}</p>
                  </div>
                </div>

                {/* 控制按鈕 */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold mb-2">設備控制</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => sendControlCommand(selectedDevice.deviceId, 'start', { game_id: 0 })}
                        disabled={selectedDevice.status !== 'online'}
                        className="flex items-center gap-2"
                      >
                        <Power className="w-4 h-4" />
                        開始
                      </Button>
                      <Button
                        onClick={() => sendControlCommand(selectedDevice.deviceId, 'stop')}
                        disabled={selectedDevice.status !== 'online'}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Power className="w-4 h-4" />
                        停止
                      </Button>
                      <Button
                        onClick={() => sendControlCommand(selectedDevice.deviceId, 'reset')}
                        disabled={selectedDevice.status !== 'online'}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" />
                        重置
                      </Button>
                      <Button
                        onClick={() => sendControlCommand(selectedDevice.deviceId, 'test')}
                        disabled={selectedDevice.status !== 'online'}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <TestTube className="w-4 h-4" />
                        測試
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold mb-2">LED 控制</h3>
                    <div className="flex flex-wrap gap-2">
                      {['red', 'green', 'blue', 'yellow', 'purple', 'cyan', 'white', 'off'].map((color) => (
                        <Button
                          key={color}
                          onClick={() => controlLED(selectedDevice.deviceId, color)}
                          disabled={selectedDevice.status !== 'online'}
                          variant="outline"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Lightbulb className="w-3 h-3" />
                          {color === 'off' ? '關閉' : color.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              {/* 統計資訊卡片 */}
              {statistics && (
                <Card className="p-6">
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    統計資訊 ({statistics.period})
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{statistics.totalHits}</p>
                      <p className="text-sm text-muted-foreground">總命中數</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{statistics.totalScore}</p>
                      <p className="text-sm text-muted-foreground">總分數</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-primary">{statistics.avgScore}</p>
                      <p className="text-sm text-muted-foreground">平均分數</p>
                    </div>
                  </div>
                </Card>
              )}

              {/* 射擊記錄卡片 */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  最近射擊記錄
                </h3>
                {shootingRecords.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">尚無射擊記錄</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2">時間</th>
                          <th className="text-left py-2">遊戲 ID</th>
                          <th className="text-left py-2">命中區域</th>
                          <th className="text-right py-2">分數</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shootingRecords.map((record) => (
                          <tr key={record.id} className="border-b">
                            <td className="py-2">
                              {new Date(record.hitTimestamp).toLocaleString('zh-TW')}
                            </td>
                            <td className="py-2">{record.gameSessionId || '-'}</td>
                            <td className="py-2">{record.targetZone}</td>
                            <td className="py-2 text-right font-semibold">{record.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Target className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">請選擇設備</h3>
              <p className="text-muted-foreground">從左側列表選擇一個設備以查看詳細資訊</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
