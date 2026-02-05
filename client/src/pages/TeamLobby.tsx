import { useState, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuthContext } from "@/contexts/AuthContext";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { 
  Users, 
  Copy, 
  Check, 
  Play, 
  LogOut, 
  Crown, 
  Loader2,
  RefreshCw,
  ArrowLeft,
  UserPlus,
  Wifi,
  WifiOff
} from "lucide-react";
import type { Game, Team, TeamMember, User } from "@shared/schema";

interface TeamWithDetails extends Team {
  members: (TeamMember & { user: User })[];
  game: Game;
  leader: User;
}

export default function TeamLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { dbUser } = useAuthContext();
  
  const [accessCode, setAccessCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [copied, setCopied] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  
  const currentUserId = dbUser?.id;

  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
  });

  const { data: myTeam, isLoading: teamLoading, refetch: refetchTeam } = useQuery<TeamWithDetails | null>({
    queryKey: ["/api/games", gameId, "my-team"],
    enabled: !!gameId,
    refetchInterval: 5000,
  });

  const { isConnected: wsConnected, sendReady } = useTeamWebSocket({
    teamId: myTeam?.id,
    userId: currentUserId,
    userName: dbUser?.firstName || dbUser?.email || "Player",
    onMemberJoined: (userId, userName) => {
      toast({ title: `${userName} 加入了隊伍` });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onMemberLeft: (userId, userName) => {
      toast({ title: `${userName} 離開了隊伍` });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onReadyUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", `/api/games/${gameId}/teams`, data);
      return response.json();
    },
    onSuccess: (team) => {
      toast({ title: "隊伍已創建" });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "創建失敗", 
        description: error?.message || "無法創建隊伍",
        variant: "destructive" 
      });
    },
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (data: { accessCode: string }) => {
      const response = await apiRequest("POST", "/api/teams/join", data);
      return response.json();
    },
    onSuccess: (team) => {
      toast({ title: "已加入隊伍" });
      setAccessCode("");
      setShowJoinForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "加入失敗", 
        description: error?.message || "無法加入隊伍",
        variant: "destructive" 
      });
    },
  });

  const updateReadyMutation = useMutation({
    mutationFn: async (data: { isReady: boolean }) => {
      const response = await apiRequest("PATCH", `/api/teams/${myTeam?.id}/ready`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "更新失敗", 
        variant: "destructive" 
      });
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/teams/${myTeam?.id}/leave`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "已離開隊伍" });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "離開失敗", 
        variant: "destructive" 
      });
    },
  });

  const startGameMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/teams/${myTeam?.id}/start`, {});
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "遊戲開始！" });
      setLocation(`/game/${gameId}?session=${data.sessionId}`);
    },
    onError: (error: any) => {
      toast({ 
        title: "開始失敗", 
        description: error?.message || "無法開始遊戲",
        variant: "destructive" 
      });
    },
  });

  const handleCopyCode = useCallback(() => {
    if (myTeam?.accessCode) {
      navigator.clipboard.writeText(myTeam.accessCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "組隊碼已複製" });
    }
  }, [myTeam?.accessCode, toast]);

  const handleCreateTeam = () => {
    createTeamMutation.mutate({ name: teamName || "" });
  };

  const handleJoinTeam = () => {
    if (!accessCode.trim()) {
      toast({ title: "請輸入組隊碼", variant: "destructive" });
      return;
    }
    joinTeamMutation.mutate({ accessCode: accessCode.trim().toUpperCase() });
  };

  const isLeader = myTeam?.leaderId === currentUserId;
  const myMembership = myTeam?.members.find(m => m.userId === currentUserId);
  const allReady = myTeam?.members.every(m => m.isReady) || false;
  const hasEnoughPlayers = (myTeam?.members.length || 0) >= (myTeam?.minPlayers || 2);

  if (gameLoading || teamLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">找不到此遊戲</p>
            <Button onClick={() => setLocation("/home")} className="mt-4" data-testid="button-back-games">
              返回遊戲列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (game.gameMode !== "team") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">此遊戲為個人模式，不需要組隊</p>
            <Button onClick={() => setLocation(`/game/${gameId}`)} className="mt-4" data-testid="button-start-solo">
              開始遊戲
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!myTeam) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
          <div className="px-4 py-3 flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/home")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">{game.title}</h1>
              <p className="text-sm text-muted-foreground">團隊模式 - 組隊大廳</p>
            </div>
          </div>
        </header>

        <main className="container max-w-md py-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                加入或創建隊伍
              </CardTitle>
              <CardDescription>
                此遊戲需要 {game.minTeamPlayers || 2} 至 {game.maxTeamPlayers || 6} 位玩家一起進行
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {showJoinForm ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">輸入組隊碼</label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="例如：ABC123"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        className="font-mono text-center text-lg tracking-widest"
                        data-testid="input-access-code"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => setShowJoinForm(false)}
                      data-testid="button-cancel-join"
                    >
                      取消
                    </Button>
                    <Button 
                      className="flex-1 gap-2"
                      onClick={handleJoinTeam}
                      disabled={joinTeamMutation.isPending || accessCode.length < 6}
                      data-testid="button-confirm-join"
                    >
                      {joinTeamMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      加入隊伍
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">隊伍名稱（選填）</label>
                    <Input
                      placeholder="例如：勇者小隊"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      maxLength={50}
                      data-testid="input-team-name"
                    />
                  </div>
                  <Button 
                    className="w-full gap-2"
                    onClick={handleCreateTeam}
                    disabled={createTeamMutation.isPending}
                    data-testid="button-create-team"
                  >
                    {createTeamMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Users className="w-4 h-4" />
                    )}
                    創建隊伍
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">或</span>
                    </div>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setShowJoinForm(true)}
                    data-testid="button-show-join"
                  >
                    <UserPlus className="w-4 h-4" />
                    輸入組隊碼加入
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setLocation("/home")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">{myTeam.name}</h1>
              <p className="text-sm text-muted-foreground">{game.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-muted-foreground" />
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => refetchTeam()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-md py-6 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>組隊碼</span>
              <Badge variant={myTeam.status === "ready" ? "default" : "secondary"}>
                {myTeam.status === "forming" && "組隊中"}
                {myTeam.status === "ready" && "準備完成"}
                {myTeam.status === "playing" && "遊戲中"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-lg p-4 text-center">
                <span className="font-mono text-3xl font-bold tracking-[0.3em]" data-testid="text-access-code">
                  {myTeam.accessCode}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={handleCopyCode}
                data-testid="button-copy-code"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              分享此組隊碼給朋友，讓他們加入隊伍
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              隊伍成員 ({myTeam.members.length}/{myTeam.maxPlayers || 6})
            </CardTitle>
            <CardDescription>
              需要至少 {myTeam.minPlayers || 2} 位玩家才能開始
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {myTeam.members.map((member) => (
              <div 
                key={member.id}
                className="flex items-center gap-3 p-2 rounded-lg hover-elevate"
                data-testid={`member-${member.userId}`}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={member.user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {member.user?.firstName?.[0] || member.user?.email?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {member.user?.firstName || member.user?.email?.split("@")[0] || "玩家"}
                    </span>
                    {member.role === "leader" && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {member.role === "leader" ? "隊長" : "隊員"}
                  </p>
                </div>
                <Badge variant={member.isReady ? "default" : "outline"}>
                  {member.isReady ? "準備完成" : "未準備"}
                </Badge>
              </div>
            ))}

            {myTeam.members.length < (myTeam.maxPlayers || 6) && (
              <div className="flex items-center gap-3 p-2 rounded-lg border border-dashed opacity-50">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <span className="text-sm text-muted-foreground">
                  等待更多玩家加入...
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {!hasEnoughPlayers && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              需要再有 {(myTeam.minPlayers || 2) - myTeam.members.length} 位玩家加入才能開始遊戲
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <Button
            className="w-full gap-2"
            variant={myMembership?.isReady ? "secondary" : "default"}
            onClick={() => updateReadyMutation.mutate({ isReady: !myMembership?.isReady })}
            disabled={updateReadyMutation.isPending}
            data-testid="button-ready"
          >
            {updateReadyMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : myMembership?.isReady ? (
              <Check className="w-4 h-4" />
            ) : null}
            {myMembership?.isReady ? "取消準備" : "準備完成"}
          </Button>

          {myTeam.leaderId && (
            <Button
              className="w-full gap-2"
              onClick={() => startGameMutation.mutate()}
              disabled={!hasEnoughPlayers || !allReady || startGameMutation.isPending}
              data-testid="button-start-game"
            >
              {startGameMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              開始遊戲
            </Button>
          )}

          <Button
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={() => leaveTeamMutation.mutate()}
            disabled={leaveTeamMutation.isPending}
            data-testid="button-leave-team"
          >
            {leaveTeamMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            離開隊伍
          </Button>
        </div>
      </main>
    </div>
  );
}
