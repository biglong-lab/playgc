import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminStaffLayout from "@/components/AdminStaffLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  QrCode, 
  Download, 
  Copy, 
  Check, 
  RefreshCw,
  ExternalLink,
  Search,
  Gamepad2
} from "lucide-react";

interface Game {
  id: string;
  title: string;
  status: string | null;
  publicSlug: string | null;
  qrCodeUrl: string | null;
  isIsolated: boolean | null;
  createdAt: string;
}

async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已發布",
  archived: "已封存",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-500/10 text-yellow-500",
  published: "bg-green-500/10 text-green-500",
  archived: "bg-gray-500/10 text-gray-500",
};

export default function AdminStaffQRCodes() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: games = [], isLoading } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
    queryFn: () => fetchWithAdminAuth("/api/admin/games"),
  });

  const generateQRMutation = useMutation({
    mutationFn: async (gameId: string) => {
      return fetchWithAdminAuth(`/api/admin/games/${gameId}/qrcode`, {
        method: "POST",
      });
    },
    onSuccess: (data, gameId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({
        title: "QR Code 已生成",
        description: "遊戲 QR Code 已成功生成",
      });
      const game = games.find(g => g.id === gameId);
      if (game) {
        setSelectedGame({ ...game, qrCodeUrl: data.qrCodeUrl, publicSlug: data.publicSlug || game.publicSlug });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "生成失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const regenerateQRMutation = useMutation({
    mutationFn: async (gameId: string) => {
      return fetchWithAdminAuth(`/api/admin/games/${gameId}/regenerate-slug`, {
        method: "POST",
      });
    },
    onSuccess: (data, gameId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games"] });
      toast({
        title: "QR Code 已重新生成",
        description: "遊戲連結已更新，舊連結將失效",
      });
      const game = games.find(g => g.id === gameId);
      if (game) {
        setSelectedGame({ ...game, qrCodeUrl: data.qrCodeUrl, publicSlug: data.publicSlug });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "重新生成失敗",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredGames = games.filter(game =>
    game.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGameUrl = (slug: string | null) => {
    if (!slug) return null;
    return `${window.location.origin}/g/${slug}`;
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(true);
      toast({ title: "已複製連結" });
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast({ title: "複製失敗", variant: "destructive" });
    }
  };

  const handleDownloadQR = (game: Game) => {
    if (!game.qrCodeUrl) return;
    
    const link = document.createElement("a");
    link.href = game.qrCodeUrl;
    link.download = `${game.title}-qrcode.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminStaffLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">QR Code 管理</h1>
            <p className="text-muted-foreground">管理遊戲 QR Code 和公開連結</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              遊戲 QR Code
            </CardTitle>
            <CardDescription>
              為遊戲生成 QR Code，玩家可以掃描進入遊戲
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜尋遊戲..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-games"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">載入中...</div>
            ) : filteredGames.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "找不到符合的遊戲" : "尚無遊戲"}
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>遊戲名稱</TableHead>
                      <TableHead>狀態</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>公開連結</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGames.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{game.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[game.status || "draft"]}>
                            {STATUS_LABELS[game.status || "draft"]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {game.qrCodeUrl ? (
                            <Badge variant="outline" className="text-green-500 border-green-500/30">
                              已生成
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              未生成
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {game.publicSlug ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              /g/{game.publicSlug}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {game.qrCodeUrl ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedGame(game)}
                                  data-testid={`button-view-qr-${game.id}`}
                                >
                                  <QrCode className="h-4 w-4 mr-1" />
                                  查看
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDownloadQR(game)}
                                  data-testid={`button-download-qr-${game.id}`}
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => generateQRMutation.mutate(game.id)}
                                disabled={generateQRMutation.isPending}
                                data-testid={`button-generate-qr-${game.id}`}
                              >
                                <QrCode className="h-4 w-4 mr-1" />
                                生成
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selectedGame} onOpenChange={(open) => !open && setSelectedGame(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                {selectedGame?.title} - QR Code
              </DialogTitle>
              <DialogDescription>
                玩家可以掃描此 QR Code 進入遊戲
              </DialogDescription>
            </DialogHeader>

            {selectedGame && (
              <div className="space-y-4">
                {selectedGame.qrCodeUrl ? (
                  <div className="flex justify-center">
                    <div className="bg-white p-4 rounded-lg">
                      <img
                        src={selectedGame.qrCodeUrl}
                        alt={`${selectedGame.title} QR Code`}
                        className="w-48 h-48"
                        data-testid="img-qr-code"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    尚未生成 QR Code
                  </div>
                )}

                {selectedGame.publicSlug && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">遊戲連結</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={getGameUrl(selectedGame.publicSlug) || ""}
                        readOnly
                        className="font-mono text-sm"
                        data-testid="input-game-url"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleCopyUrl(getGameUrl(selectedGame.publicSlug)!)}
                        data-testid="button-copy-url"
                      >
                        {copiedUrl ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => window.open(getGameUrl(selectedGame.publicSlug)!, "_blank")}
                        data-testid="button-open-url"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 justify-end pt-4">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadQR(selectedGame)}
                    disabled={!selectedGame.qrCodeUrl}
                    data-testid="button-download-qr-dialog"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下載 QR Code
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => regenerateQRMutation.mutate(selectedGame.id)}
                    disabled={regenerateQRMutation.isPending}
                    data-testid="button-regenerate-qr"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${regenerateQRMutation.isPending ? "animate-spin" : ""}`} />
                    重新生成
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminStaffLayout>
  );
}
