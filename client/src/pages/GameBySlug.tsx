import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Gamepad2,
  Clock,
  Users,
  MapPin,
  Play,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface Field {
  id: string;
  name: string;
  address: string | null;
}

interface Game {
  id: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
  difficulty: string | null;
  estimatedTime: number | null;
  maxPlayers: number | null;
  status: string | null;
  field: Field | null;
  isIsolated: boolean | null;
  locationLockEnabled: boolean | null;
  lockLocationName: string | null;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "簡單",
  medium: "中等",
  hard: "困難",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-500/10 text-green-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  hard: "bg-red-500/10 text-red-500",
};

export default function GameBySlug() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: game, isLoading, error } = useQuery<Game>({
    queryKey: ["/api/g", slug],
    queryFn: async () => {
      const response = await fetch(`/api/g/${slug}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("遊戲不存在或已被移除");
        }
        throw new Error("無法載入遊戲資訊");
      }
      return response.json();
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">載入遊戲中...</p>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>無法找到遊戲</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : "此連結可能已失效或遊戲不存在"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (game.status !== "published") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
            <CardTitle>遊戲尚未開放</CardTitle>
            <CardDescription>
              此遊戲目前尚未發布，請稍後再試
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {game.coverImageUrl && (
        <div className="h-48 relative bg-muted">
          <img
            src={game.coverImageUrl}
            alt={game.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
        </div>
      )}
      
      <div className="max-w-lg mx-auto p-4 -mt-8 relative">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-game-title">
              {game.title}
            </CardTitle>
            {game.field && (
              <CardDescription className="flex items-center justify-center gap-1">
                <MapPin className="w-4 h-4" />
                {game.field.name}
              </CardDescription>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {game.description && (
              <p className="text-muted-foreground text-center" data-testid="text-game-description">
                {game.description}
              </p>
            )}
            
            <div className="flex justify-center gap-4 flex-wrap">
              {game.difficulty && (
                <Badge className={DIFFICULTY_COLORS[game.difficulty]} variant="secondary">
                  {DIFFICULTY_LABELS[game.difficulty]}
                </Badge>
              )}
              {game.estimatedTime && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {game.estimatedTime} 分鐘
                </Badge>
              )}
              {game.maxPlayers && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  最多 {game.maxPlayers} 人
                </Badge>
              )}
            </div>
            
            {game.locationLockEnabled && game.lockLocationName && (
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  需要在指定地點才能開始遊戲
                </p>
                <p className="font-medium mt-1">{game.lockLocationName}</p>
              </div>
            )}
            
            <div className="pt-4">
              <Button 
                className="w-full h-12 text-lg"
                onClick={() => setLocation(`/game/${game.id}`)}
                data-testid="button-start-game"
              >
                <Play className="w-5 h-5 mr-2" />
                開始遊戲
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
