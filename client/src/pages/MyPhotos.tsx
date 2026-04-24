// 🖼️ 我的照片（個人相簿） — 聚合所有 session 的拍照紀念
// 依 session 分組顯示，每張可單獨下載/分享

import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useFieldLink } from "@/hooks/useFieldLink";
import {
  ArrowLeft, Camera, Download, Share2, X as XIcon, Image as ImageIcon,
  DownloadCloud, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import EmptyState from "@/components/shared/EmptyState";

interface UserPhoto {
  publicId: string;
  url: string;
  sessionId: string;
  gameId: string | null;
  teamName: string | null;
  startedAt: string | null;
  createdAt: string;
}

interface UserPhotosResponse {
  photos: UserPhoto[];
  total: number;
}

function dateKey(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return "unknown";
  }
}

function dateLabel(key: string): string {
  if (key === "unknown") return "未知日期";
  const [y, m, d] = key.split("-");
  return `${y}/${m}/${d}`;
}

export default function MyPhotos() {
  const [, setLocation] = useLocation();
  const link = useFieldLink();
  const { toast } = useToast();
  const [lightboxPhoto, setLightboxPhoto] = useState<UserPhoto | null>(null);
  // 🆕 v2: 批次下載狀態
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  const { data, isLoading, error } = useQuery<UserPhotosResponse>({
    queryKey: ["/api/me/photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/me/photos");
      return res.json();
    },
  });

  const photos = data?.photos ?? [];

  // 依 createdAt 分組（每天一群）
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, UserPhoto[]>();
    for (const p of photos) {
      const k = dateKey(p.createdAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    // 依日期 desc
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [photos]);

  const handleDownload = async (photo: UserPhoto) => {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chito-${photo.publicId.split("/").pop()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast({ title: "下載完成", duration: 1200 });
    } catch {
      toast({ title: "下載失敗", variant: "destructive" });
    }
  };

  const handleShare = async (photo: UserPhoto) => {
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
            title: "CHITO 紀念照",
            text: "我的 CHITO 遊戲紀念照",
            files: [file],
          });
          return;
        }
        await navigator.share({
          title: "CHITO 紀念照",
          url: photo.url,
        });
        return;
      }
      await navigator.clipboard.writeText(photo.url);
      toast({ title: "已複製連結" });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      toast({ title: "分享失敗", variant: "destructive" });
    }
  };

  const goToSessionAlbum = (sessionId: string) => {
    setLocation(link(`/album/${sessionId}`));
  };

  return (
    <div className="min-h-screen bg-background" data-testid="my-photos-page">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation(link("/me"))}
          data-testid="btn-my-photos-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4" />
            我的紀念照
          </h1>
          <p className="text-xs text-muted-foreground">
            共 {photos.length} 張照片
          </p>
        </div>
      </header>

      <main className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="aspect-square rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={Camera}
            title="無法載入"
            description={error instanceof Error ? error.message : "請稍後再試"}
          />
        ) : photos.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="還沒有紀念照"
            description="玩遊戲拍照後，紀念照會自動保留在這裡"
          />
        ) : (
          <div className="space-y-6" data-testid="my-photos-groups">
            {groupedByDate.map(([key, group]) => (
              <section key={key} data-testid={`photo-group-${key}`}>
                <header className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-medium">{dateLabel(key)}</h2>
                  <span className="text-xs text-muted-foreground">
                    {group.length} 張
                  </span>
                </header>
                <div className="grid grid-cols-3 gap-2">
                  {group.map((photo, idx) => (
                    <button
                      key={photo.publicId}
                      className="relative aspect-square rounded overflow-hidden bg-muted hover:opacity-90 transition-opacity group"
                      onClick={() => setLightboxPhoto(photo)}
                      data-testid={`my-photo-${idx}`}
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      {photo.teamName && (
                        <span className="absolute bottom-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                          {photo.teamName}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      <Dialog open={!!lightboxPhoto} onOpenChange={(open) => !open && setLightboxPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 gap-0" data-testid="my-photos-lightbox">
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
                  >
                    <XIcon className="w-5 h-5" />
                  </Button>
                </DialogClose>
              </>
            )}
          </div>
          {lightboxPhoto && (
            <div className="p-3 border-t space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={() => handleDownload(lightboxPhoto)}
                >
                  <Download className="w-4 h-4" />
                  下載
                </Button>
                <Button
                  className="flex-1 gap-1"
                  onClick={() => handleShare(lightboxPhoto)}
                >
                  <Share2 className="w-4 h-4" />
                  分享
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => goToSessionAlbum(lightboxPhoto.sessionId)}
                data-testid="btn-go-session-album"
              >
                看這次遊戲的完整相簿 →
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
