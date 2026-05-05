// 📸 PhotoWall — 多人照片牆元件（純 UI）
// 每位玩家上傳一張照片（Cloudinary URL），形成共同相簿
// 適用：活動留影、員工旅遊紀念、課程學習成果展示

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Camera, ImagePlus, Heart } from "lucide-react";

export interface PhotoEntry {
  id: string;
  userId: string;
  userName: string;
  photoUrl: string;
  caption?: string;
  likedBy: string[];
  submittedAt: number;
}

export interface PhotoWallConfig {
  title?: string;
  prompt?: string;
  allowCaption?: boolean;
  showAuthor?: boolean;
  maxPhotos?: number;
}

export interface PhotoWallState extends Record<string, unknown> {
  photos: PhotoEntry[];
}

interface PhotoWallProps {
  config: PhotoWallConfig;
  state: PhotoWallState;
  myUserId: string;
  myUserName: string;
  onUploadPhoto: (photoUrl: string, caption?: string) => Promise<void>;
  onLike: (photoId: string) => Promise<void>;
}

export default function PhotoWall({ config, state, myUserId, onUploadPhoto, onLike }: PhotoWallProps) {
  const [urlInput, setUrlInput] = useState("");
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myPhoto = state.photos.find((p) => p.userId === myUserId);
  const hasSubmitted = !!myPhoto;
  const showAuthor = config.showAuthor !== false;
  const allowCaption = config.allowCaption !== false;
  const trimmedUrl = urlInput.trim();
  const isValidUrl = trimmedUrl.startsWith("http");

  const handleSubmit = async () => {
    if (!isValidUrl || isSubmitting || hasSubmitted) return;
    setIsSubmitting(true);
    try {
      await onUploadPhoto(trimmedUrl, caption.trim() || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = (photoId: string) => {
    void onLike(photoId);
  };

  const sortedPhotos = state.photos.slice().sort((a, b) => b.submittedAt - a.submittedAt);

  return (
    <div className="space-y-4" data-testid="photo-wall-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="photo-wall-title">
              <Camera className="w-5 h-5 text-pink-500" />
              {config.title ?? "📸 活動照片牆"}
            </CardTitle>
            {state.photos.length > 0 && (
              <Badge variant="outline" data-testid="photo-count">
                {state.photos.length} 張
              </Badge>
            )}
          </div>
          {config.prompt && (
            <p className="text-sm text-muted-foreground" data-testid="photo-prompt">{config.prompt}</p>
          )}
        </CardHeader>
        <CardContent>
          {hasSubmitted ? (
            <div className="py-3 text-center space-y-2" data-testid="photo-submitted">
              <p className="text-sm text-green-600 font-medium">✅ 照片已上傳！</p>
              {myPhoto && (
                <img
                  src={myPhoto.photoUrl}
                  alt={myPhoto.caption ?? "我的照片"}
                  className="w-full max-h-40 object-cover rounded-lg"
                  data-testid="my-photo-preview"
                />
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="貼上照片網址（Cloudinary / imgur…）"
                  className="text-sm"
                  data-testid="photo-url-input"
                />
              </div>
              {allowCaption && (
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="加上一句說明（選填）"
                  className="text-sm"
                  maxLength={60}
                  data-testid="photo-caption-input"
                />
              )}
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={!isValidUrl || isSubmitting}
                data-testid="photo-submit-btn"
              >
                <ImagePlus className="w-4 h-4 mr-2" />
                上傳到照片牆
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {sortedPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-2" data-testid="photo-wall-grid">
          {sortedPhotos.map((photo) => {
            const liked = photo.likedBy.includes(myUserId);
            return (
              <div
                key={photo.id}
                className="relative rounded-xl overflow-hidden border border-border bg-muted"
                data-testid={`photo-card-${photo.id}`}
              >
                <img
                  src={photo.photoUrl}
                  alt={photo.caption ?? photo.userName}
                  className="w-full aspect-square object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  {photo.caption && (
                    <p className="text-white text-xs line-clamp-1">{photo.caption}</p>
                  )}
                  {showAuthor && (
                    <p className="text-white/70 text-xs">— {photo.userName}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleLike(photo.id)}
                  className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 flex items-center gap-1 text-xs"
                  data-testid={`like-btn-${photo.id}`}
                >
                  <Heart className={`w-3 h-3 ${liked ? "fill-rose-500 text-rose-500" : "text-gray-400"}`} />
                  <span data-testid={`like-count-${photo.id}`}>{photo.likedBy.length}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
