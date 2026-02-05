import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Target, Timer, Crosshair, Award, Zap, Radio, AlertTriangle } from "lucide-react";
import type { ShootingMissionConfig } from "@shared/schema";

interface ShootingMissionPageProps {
  config: ShootingMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: any) => void;
}

interface HitRecord {
  position: { x: number; y: number };
  score: number;
  zone: string;
  deviceId?: string;
  timestamp?: string;
}

export default function ShootingMissionPage({ config, onComplete, sessionId }: ShootingMissionPageProps) {
  const { toast } = useToast();
  const { t } = useI18n();
  const [isStarted, setIsStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(config.timeLimit);
  const [hits, setHits] = useState<HitRecord[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const requiredHits = config.requiredHits || 5;
  const targetScore = config.targetScore || config.minScore || 60;
  const hitProgress = (hits.length / requiredHits) * 100;
  
  const getZoneMessage = (zone: string) => {
    switch (zone) {
      case "bullseye": return t("shooting.bullseye");
      case "inner": return t("shooting.inner");
      case "outer": return t("shooting.outer");
      default: return t("shooting.outer");
    }
  };

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus("connecting");
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      setIsConnected(true);
      
      ws.send(JSON.stringify({
        type: "join",
        sessionId: sessionId,
        userId: "shooting-player",
        userName: "玩家",
      }));

      toast({
        title: t("shooting.connected"),
        description: "",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "shooting_hit" && isStarted && !isCompleted) {
          const record = data.record;
          
          const zoneScore = calculateZoneScore(record.hitZone || "outer");
          const hit: HitRecord = {
            position: {
              x: record.hitPosition?.x ?? Math.random() * 100,
              y: record.hitPosition?.y ?? Math.random() * 100,
            },
            score: record.points || zoneScore,
            zone: record.hitZone || "outer",
            deviceId: record.deviceId,
            timestamp: record.timestamp,
          };

          setHits((prev) => [...prev, hit]);
          setTotalScore((prev) => prev + hit.score);

          toast({
            title: getZoneMessage(hit.zone),
            description: `+${hit.score} 分`,
          });
        }
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setIsConnected(false);
      
      if (isStarted && !isCompleted) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
      setIsConnected(false);
    };
  }, [sessionId, isStarted, isCompleted, toast, t]);

  const calculateZoneScore = (zone: string): number => {
    switch (zone) {
      case "bullseye": return 100;
      case "inner": return 50;
      case "outer": return 25;
      default: return 10;
    }
  };

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isStarted || isCompleted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleMissionEnd();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, isCompleted]);

  const simulateHit = useCallback(() => {
    if (isCompleted) return;

    const zones = [
      { name: "bullseye", score: 100, probability: 0.1 },
      { name: "inner", score: 50, probability: 0.3 },
      { name: "outer", score: 25, probability: 0.4 },
      { name: "miss", score: 0, probability: 0.2 },
    ];

    const rand = Math.random();
    let cumulative = 0;
    let selectedZone = zones[zones.length - 1];

    for (const zone of zones) {
      cumulative += zone.probability;
      if (rand <= cumulative) {
        selectedZone = zone;
        break;
      }
    }

    if (selectedZone.score > 0) {
      const hit: HitRecord = {
        position: {
          x: Math.random() * 100,
          y: Math.random() * 100,
        },
        score: selectedZone.score,
        zone: selectedZone.name,
      };

      setHits((prev) => [...prev, hit]);
      setTotalScore((prev) => prev + selectedZone.score);

      toast({
        title: getZoneMessage(selectedZone.name),
        description: `+${selectedZone.score} 分`,
      });
    } else {
      toast({
        title: t("shooting.miss"),
        description: "",
        variant: "destructive",
      });
    }
  }, [isCompleted, toast, t]);

  useEffect(() => {
    if (isStarted && !isCompleted && hits.length >= requiredHits) {
      handleMissionEnd();
    }
  }, [hits.length, isStarted, isCompleted, requiredHits]);

  const handleStart = () => {
    setIsStarted(true);
    connectWebSocket();
    toast({
      title: "任務開始!",
      description: "準備射擊!",
    });
  };

  const handleMissionEnd = () => {
    setIsCompleted(true);
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    const scoreTarget = config.targetScore || config.minScore;
    const success = hits.length >= requiredHits && 
      (!scoreTarget || totalScore >= scoreTarget);

    if (success) {
      toast({
        title: config.onSuccess?.message || "任務完成!",
        description: `總分: ${totalScore}`,
      });
      setTimeout(() => {
        const grantItems = config.onSuccess?.grantItem 
          ? [config.onSuccess.grantItem] 
          : config.successReward?.items;
        onComplete({ 
          points: totalScore, 
          items: grantItems 
        });
      }, 2000);
    } else {
      toast({
        title: "任務失敗",
        description: hits.length < requiredHits 
          ? `需要 ${requiredHits} 次命中` 
          : `需要 ${scoreTarget} 分以上`,
        variant: "destructive",
      });
      setTimeout(() => {
        onComplete({ points: 0 });
      }, 2000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case "connected": return <Zap className="w-3 h-3" />;
      case "connecting": return <Radio className="w-3 h-3 animate-pulse" />;
      default: return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const getConnectionLabel = () => {
    switch (connectionStatus) {
      case "connected": return "靶機已連接";
      case "connecting": return "連接中...";
      default: return "未連接";
    }
  };

  if (!isStarted) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-glow">
              <Target className="w-10 h-10 text-primary" />
            </div>
            
            <h2 className="text-2xl font-display font-bold mb-2">射擊任務</h2>
            <p className="text-muted-foreground mb-6">
              在時限內完成指定次數的命中
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">時間限制</p>
                <p className="font-number text-2xl text-primary">{formatTime(config.timeLimit)}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-sm text-muted-foreground mb-1">需要命中</p>
                <p className="font-number text-2xl text-primary">{requiredHits} 次</p>
              </div>
            </div>

            {config.minScore && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-6">
                <p className="text-sm text-warning">
                  需要達到 {config.minScore} 分以上才能過關
                </p>
              </div>
            )}

            <Button 
              onClick={handleStart} 
              size="lg" 
              className="w-full gap-2"
              data-testid="button-start-mission"
            >
              <Crosshair className="w-5 h-5" />
              開始任務
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col p-4">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Card className="bg-card/80">
          <CardContent className="p-3 text-center">
            <Timer className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="font-number text-2xl text-warning">{formatTime(timeLeft)}</p>
            <p className="text-xs text-muted-foreground">剩餘時間</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/80">
          <CardContent className="p-3 text-center">
            <Target className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="font-number text-2xl text-success">{hits.length}</p>
            <p className="text-xs text-muted-foreground">命中數</p>
          </CardContent>
        </Card>
        
        <Card className="bg-card/80">
          <CardContent className="p-3 text-center">
            <Award className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="font-number text-2xl text-primary">{totalScore}</p>
            <p className="text-xs text-muted-foreground">總分</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">任務進度</span>
          <span className="text-sm font-number text-primary">{hits.length}/{requiredHits}</span>
        </div>
        <Progress value={Math.min(hitProgress, 100)} className="h-2" />
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 rounded-full bg-gradient-radial from-success via-warning to-destructive opacity-80 animate-targetPulse border-4 border-primary" />
          
          <div className="absolute inset-8 rounded-full bg-gradient-radial from-success via-warning to-destructive opacity-90 border-2 border-white/30" />
          
          <div className="absolute inset-16 rounded-full bg-gradient-radial from-success to-success-foreground opacity-95 border-2 border-white/30" />
          
          <div className="absolute inset-[45%] rounded-full bg-destructive border-2 border-white shadow-lg" />

          {hits.slice(-5).map((hit, index) => (
            <div
              key={index}
              className="absolute w-3 h-3 rounded-full bg-yellow-400 border-2 border-white shadow-lg animate-pulse"
              style={{
                left: `${hit.position.x}%`,
                top: `${hit.position.y}%`,
                transform: "translate(-50%, -50%)",
              }}
              data-testid={`hit-marker-${index}`}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        <Badge 
          variant={connectionStatus === "connected" ? "default" : connectionStatus === "connecting" ? "secondary" : "destructive"} 
          className="gap-1"
        >
          {getConnectionIcon()}
          {getConnectionLabel()}
        </Badge>
        
        {config.deviceId && (
          <Badge variant="outline" className="gap-1">
            <Radio className="w-3 h-3" />
            設備: {config.deviceId}
          </Badge>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>等待靶機訊號...</p>
        <p className="text-xs mt-1">請使用場域內的射擊設備進行遊戲</p>
      </div>
    </div>
  );
}
