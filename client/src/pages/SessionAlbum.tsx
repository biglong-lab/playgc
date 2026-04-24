// 📸 Session 相簿頁 — 展示該 session 所有玩家拍的照片
// 支援：整張下載、個別分享、整本 session 分享、空狀態、lightbox 預覽

import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useFieldLink } from "@/hooks/useFieldLink";
import {
  ArrowLeft, Camera, Download, Share2, X as XIcon,
  Calendar, Trophy, Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";

interface AlbumPhoto {
  publicId: string;
  url: string;
  width: number;
  height: number;
  createdAt: string;
}

interface AlbumResponse {
  sessionId: string;
  gameId: string;
  playerName: string | null;
  teamName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  score: number;
  photos: AlbumPhoto[];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "—";
  }
}

export default function SessionAlbum() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();
  const { toast } = useToast();
  const [lightboxPhoto, setLightboxPhoto] = useState<AlbumPhoto | null>(null);

  const { data, isLoading, error } = useQuery<AlbumResponse>({
    queryKey: [`/api/sessions/${sessionId}/album`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/album`);
      return res.json();
    },
    enabled: !!sessionId,
  });

  const handleDownload = async (photo: AlbumPhoto) => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-${sessionId}-${photo.publicId.split("/").pop()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "下載完成", duration: 1200 });
    } catch {
      toast({ title: "下載失敗", variant: "destructive" });
    }
  };

  const handleShare = async (photo: AlbumPhoto) => {
    try {
      if (typeof navigator.share === "function") {
        const res = await fetch(photo.url);
        const blob = await res.blob();
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        const canShareFiles =
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [file] });
        if (canShareFiles) {
          await navigator.share({
            title: "CHITO 遊戲紀念",
            text: "我在遊戲中的紀念照",
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: "CHITO 遊戲紀念",
          text: "我在遊戲中的紀念照",
          url: photo.url,
        });
        return;
      }
      await navigator.clipboard.writeText(photo.url);
      toast({ title: "已複製圖片連結" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  const handleShareAlbum = async () => {
    const albumUrl = `${window.location.origin}/album/${sessionId}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "我的 CHITO 遊戲相簿",
          text: `本次遊戲共 ${photos.length} 張照片`,
          url: albumUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(albumUrl);
      toast({ title: "已複製相簿連結", description: "可貼到社群分享" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  const photos = data?.photos ?? [];

  return (
    <div className="min-h-screen bg-background" data-testid="session-album-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(link("/home"))}
          data-testid="btn-album-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">遊戲相簿</h1>
          <p className="text-xs text-muted-foreground truncate">
            Session #{sessionId?.slice(0, 8)}
          </p>
        </div>
        {photos.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleShareAlbum}
            className="gap-1"
            data-testid="btn-share-album"
          >
            <Share2 className="w-4 h-4" />
            分享相簿
          </Button>
        )}
      </header>

      {/* Session meta info */}
      {data && (
        <div className="px-4 py-3 bg-muted/30 border-b space-y-1 text-xs text-muted-foreground" data-testid="album-meta">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" />
            <span>分數 {data.score}</span>
            {data.teamName && (
              <>
                <span>·</span>
                <UsersIcon className="w-3.5 h-3.5" />
                <span>{data.teamName}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDateTime(data.startedAt)}</span>
            {data.completedAt && (
              <>
                <span>→</span>
                <span>{formatDateTime(data.completedAt)}</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Photos grid */}
      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Camera}
            title="無法載入相簿"
            description={error instanceof Error ? error.message : "請稍後再試"}
          />
        ) : photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="還沒有照片"
            description="這次遊戲沒有拍攝任何照片"
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="album-grid">
            {photos.map((photo, idx) => (
              <button
                key={photo.publicId}
                className="relative aspect-square rounded overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                onClick={() => setLightboxPhoto(photo)}
                data-testid={`album-photo-${idx}`}
              >
                <img
                  src={photo.url}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0" data-testid="album-lightbox">
          <div className="relative">
            {lightboxPhoto && (
              <>
                <img
                  src={lightboxPhoto.url}
                  alt=""
                  className="w-full max-h-[70vh] object-contain bg-black"
                />
                <DialogClose asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-2 right-2 bg-background/60 backdrop-blur"
                    data-testid="btn-lightbox-close"
                  >
                    <XIcon className="w-5 h-5" />
                  </Button>
                </DialogClose>
              </>
            )}
          </div>
          {lightboxPhoto && (
            <div className="flex gap-2 p-3 border-t">
              <Button
                variant="outline"
                className="flex-1 gap-1"
                onClick={() => handleDownload(lightboxPhoto)}
                data-testid="btn-lightbox-download"
              >
                <Download className="w-4 h-4" />
                下載
              </Button>
              <Button
                className="flex-1 gap-1"
                onClick={() => handleShare(lightboxPhoto)}
                data-testid="btn-lightbox-share"
              >
                <Share2 className="w-4 h-4" />
                分享
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
