// 📸 PhotoWallPage — pageType="photo_wall" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PhotoWall, { type PhotoWallConfig, type PhotoWallState, type PhotoEntry } from "./PhotoWall";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PhotoWallPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function PhotoWallPage({ page, sessionId, gameId, pageId, onComplete }: PhotoWallPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: PhotoWallConfig } | PhotoWallConfig | null) ?? null;
  const config: PhotoWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PhotoWallConfig | null)) ?? {
      title: "📸 活動照片牆",
      prompt: "上傳一張今天的照片！",
      allowCaption: true,
      showAuthor: true,
    };

  const defaultState: PhotoWallState = { photos: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<PhotoWallState>({
    gameId, sessionId, pageId, type: "photo_wall", defaultState,
  });

  const handleUploadPhoto = useCallback(async (photoUrl: string, caption?: string) => {
    const newEntry: PhotoEntry = {
      id: Math.random().toString(36).slice(2, 10),
      userId: myUserId,
      userName: myUserName,
      photoUrl,
      caption,
      likedBy: [],
      submittedAt: Date.now(),
    };
    const filtered = state.photos.filter((p: PhotoEntry) => p.userId !== myUserId);
    await updateState({ photos: [...filtered, newEntry] });
    if (onComplete) onComplete();
  }, [state.photos, myUserId, myUserName, updateState, onComplete]);

  const handleLike = useCallback(async (photoId: string) => {
    const updated = state.photos.map((p: PhotoEntry) => {
      if (p.id !== photoId) return p;
      const alreadyLiked = p.likedBy.includes(myUserId);
      const likedBy = alreadyLiked
        ? p.likedBy.filter((id: string) => id !== myUserId)
        : [...p.likedBy, myUserId];
      return { ...p, likedBy };
    });
    await updateState({ photos: updated });
  }, [state.photos, myUserId, updateState]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <PhotoWall
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onUploadPhoto={handleUploadPhoto}
      onLike={handleLike}
    />
  );
}
