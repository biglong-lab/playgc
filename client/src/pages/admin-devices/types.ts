// 裝置管理共用型別

export interface MqttStatus {
  connected: boolean;
  reconnectAttempts: number;
}

export interface DeviceStatistics {
  deviceId: string;
  deviceName: string;
  period: string;
  totalHits: number;
  totalScore: number;
  averageScore: number;
  highestScore: number;
  hitsByZone: Record<string, number>;
}
