import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Target, Timer, Crosshair, Award, Zap, Radio, AlertTriangle } from "lucide-react";
import type { ShootingMissionConfig } from "@shared/schema";
import {
  validateHit,
  validateFinalScore,
  isSimulationAllowed,
} from "@/lib/shootingValidation";
import { logWarning } from "@/lib/clientLogger";

interface ShootingMissionPageProps {
  config: ShootingMissionConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
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
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const MAX_AUTO_RECONNECT = 5;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // stale-closure 防護：ws.onclose 透過 ref 讀取最新 isStarted/isCompleted
  const isStartedRef = useRef(isStarted);
  const isCompletedRef = useRef(isCompleted);
  useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);
  useEffect(() => { isCompletedRef.current = isCompleted; }, [isCompleted]);

  // 🛡️ 作弊防護：最後一次 hit 時間（用於節流檢查）
  const lastHitTimeRef = useRef<number | null>(null);

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
      setReconnectAttempts(0);

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
        
        if (data.type === "shooting_hit" && isStartedRef.current && !isCompletedRef.current) {
          const record = data.record ?? {};
          // 相容前後端欄位名稱（DB schema: targetZone / hitPosition 字串 / hitScore/score）
          // 前端原期望: hitZone / hitPosition.x/y / points
          const zone: string =
            record.hitZone ||
            record.targetZone ||
            (typeof record.hitPosition === "string" ? record.hitPosition : "outer");
          const zoneScore = calculateZoneScore(zone);
          const points: number =
            record.points ??
            record.hitScore ??
            record.score ??
            zoneScore;

          // 🛡️ 作弊防護：每筆 hit 都經過驗證
          setHits((prev) => {
            const validation = validateHit({
              score: points,
              lastHitTime: lastHitTimeRef.current,
              currentHitCount: prev.length,
              requiredHits,
            });

            if (!validation.valid) {
              // 作弊/bot 嘗試 → 丟棄這筆 hit 並記錄到伺服器
              logWarning(
                "shooting",
                "hit_rejected",
                validation.message || "hit 驗證失敗",
                {
                  reason: validation.reason,
                  score: points,
                  zone,
                  sessionId,
                  deviceId: record.deviceId,
                },
              );
              // 若是連續太快，靜默忽略（不彈 toast 避免被知道）
              // 若是分數異常，顯示紅色警告
              if (validation.reason === "score_too_high" || validation.reason === "invalid_score") {
                toast({
                  title: "⚠️ 異常命中資料",
                  description: "此次命中資料異常，已忽略",
                  variant: "destructive",
                });
              }
              return prev; // 不改 state
            }

            // 通過驗證 → 更新 lastHitTime 並加入
            lastHitTimeRef.current = Date.now();

            const posX =
              record.hitPosition && typeof record.hitPosition === "object" && typeof record.hitPosition.x === "number"
                ? record.hitPosition.x
                : Math.random() * 100;
            const posY =
              record.hitPosition && typeof record.hitPosition === "object" && typeof record.hitPosition.y === "number"
                ? record.hitPosition.y
                : Math.random() * 100;

            const hit: HitRecord = {
              position: { x: posX, y: posY },
              score: points,
              zone,
              deviceId: record.deviceId,
              timestamp: record.timestamp ?? record.hitTimestamp,
            };

            setTotalScore((s) => s + points);
            toast({
              title: getZoneMessage(zone),
              description: `+${points} 分`,
            });
            return [...prev, hit];
          });
        }
      } catch {
        // WebSocket 訊息解析失敗
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
      setIsConnected(false);

      // 讀 ref 而不是 closure 的 isStarted/isCompleted（handleStart 呼叫時 isStarted 尚未生效）
      if (isStartedRef.current && !isCompletedRef.current) {
        setReconnectAttempts((prev) => {
          const next = prev + 1;
          // 超過自動重連上限 → 停止，交給使用者手動觸發
          if (next > MAX_AUTO_RECONNECT) {
            toast({
              title: "自動重連失敗",
              description: "請點擊「手動重連」或檢查靶機網路",
              variant: "destructive",
            });
            return next;
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 3000);
          return next;
        });
      }
    };

    ws.onerror = () => {
      setConnectionStatus("disconnected");
      setIsConnected(false);
    };
  }, [sessionId, isStarted, isCompleted, toast, t]);

  const calculateZoneScore = (zone: string): number => {
    switch (zone) {
      case "bullseye":
      case "center":
        return 100;
      case "inner":
        return 50;
      case "outer":
        return 25;
      default:
        return 10;
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
      // 🛡️ 模擬命中也走相同驗證流程（避免連點 bot）
      setHits((prev) => {
        const validation = validateHit({
          score: selectedZone.score,
          lastHitTime: lastHitTimeRef.current,
          currentHitCount: prev.length,
          requiredHits,
        });

        if (!validation.valid) {
          if (validation.reason === "too_fast") {
            toast({
              title: "點太快了！",
              description: "請稍等再試（防作弊節流）",
            });
          }
          return prev;
        }

        lastHitTimeRef.current = Date.now();
        const hit: HitRecord = {
          position: {
            x: Math.random() * 100,
            y: Math.random() * 100,
          },
          score: selectedZone.score,
          zone: selectedZone.name,
        };
        setTotalScore((s) => s + selectedZone.score);
        toast({
          title: getZoneMessage(selectedZone.name),
          description: `+${selectedZone.score} 分`,
        });
        return [...prev, hit];
      });
    } else {
      toast({
        title: t("shooting.miss"),
        description: "",
        variant: "destructive",
      });
    }
  }, [isCompleted, toast, t, requiredHits]);

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

    // 🛡️ 提交前最終驗證：確保 totalScore 未被 devtools 改寫
    const finalCheck = validateFinalScore({ hits, totalScore });
    let safeTotalScore = totalScore;
    if (!finalCheck.valid) {
      logWarning(
        "shooting",
        "final_score_mismatch",
        finalCheck.message || "總分異常",
        {
          sessionId,
          totalScore,
          expectedScore: finalCheck.expectedScore,
          hitsCount: hits.length,
        },
      );
      // 使用 hits 實際總和，不信任 state
      safeTotalScore = finalCheck.expectedScore;
    }

    const scoreTarget = config.targetScore || config.minScore;
    const success = hits.length >= requiredHits &&
      (!scoreTarget || safeTotalScore >= scoreTarget);

    if (success) {
      toast({
        title: config.onSuccess?.message || "任務完成!",
        description: `總分: ${safeTotalScore}`,
      });
      setTimeout(() => {
        const grantItems = config.onSuccess?.grantItem
          ? [config.onSuccess.grantItem]
          : config.successReward?.items;
        // 優先順序：onSuccess.points（admin 指定） > successReward.points > 驗證過的 safeTotalScore
        const rewardPoints =
          config.onSuccess?.points ??
          config.successReward?.points ??
          safeTotalScore;
        onComplete(
          { points: rewardPoints, items: grantItems },
          config.nextPageId,
        );
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
        onComplete({ points: 0 }, config.nextPageId);
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

          {hits.map((hit, index) => {
            // 依區域上色：靶心紅、內圈橙、外圈黃
            const color =
              hit.zone === "bullseye" || hit.zone === "center"
                ? "bg-red-500"
                : hit.zone === "inner"
                  ? "bg-orange-400"
                  : "bg-yellow-400";
            const isLatest = index === hits.length - 1;
            return (
              <div
                key={index}
                className={`absolute w-4 h-4 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white ${
                  isLatest ? "animate-ping-once" : ""
                }`}
                style={{
                  left: `${hit.position.x}%`,
                  top: `${hit.position.y}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: index,
                }}
                data-testid={`hit-marker-${index}`}
                title={`第 ${index + 1} 發 · ${hit.score} 分`}
              >
                {index + 1}
              </div>
            );
          })}
          <style>{`
            @keyframes ping-once-kf {
              0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7); transform: translate(-50%, -50%) scale(1); }
              60% { box-shadow: 0 0 0 18px rgba(255,255,255,0); transform: translate(-50%, -50%) scale(1.4); }
              100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); transform: translate(-50%, -50%) scale(1); }
            }
            .animate-ping-once { animation: ping-once-kf 0.7s ease-out; }
          `}</style>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center justify-center gap-2">
        <div className="flex items-center justify-center gap-2 flex-wrap">
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

          {connectionStatus === "disconnected" && reconnectAttempts > 0 && (
            <Badge variant="outline" className="text-xs">
              已重試 {Math.min(reconnectAttempts, MAX_AUTO_RECONNECT)}/{MAX_AUTO_RECONNECT} 次
            </Badge>
          )}
        </div>

        {/* 手動重連按鈕（連線中或連上後隱藏）*/}
        {connectionStatus === "disconnected" && isStarted && !isCompleted && (
          <Button
            size="sm"
            variant={reconnectAttempts > MAX_AUTO_RECONNECT ? "default" : "outline"}
            onClick={() => {
              if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
              }
              setReconnectAttempts(0);
              connectWebSocket();
            }}
            data-testid="button-manual-reconnect"
            className="gap-1"
          >
            <Radio className="w-3 h-3" />
            手動重連
          </Button>
        )}
      </div>

      <div className="mt-4 text-center text-sm text-muted-foreground">
        <p>等待靶機訊號...</p>
        <p className="text-xs mt-1">請使用場域內的射擊設備進行遊戲</p>
      </div>

      {/* 開發/無硬體場地模式：提供模擬命中按鈕（production build 強制禁用） */}
      {isSimulationAllowed(config.allowSimulation) && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={simulateHit}
            data-testid="button-simulate-hit"
          >
            <Target className="w-4 h-4 mr-2" />
            模擬命中（測試）
          </Button>
        </div>
      )}
    </div>
  );
}
