import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width?: number;
  height?: number;
  bytes: number;
  resource_type: string;
  duration?: number;
}

export type ResourceType = "image" | "video" | "raw";

export class CloudinaryService {
  private isConfigured(): boolean {
    return !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );
  }

  async uploadImage(
    base64Data: string,
    options?: {
      folder?: string;
      publicId?: string;
      transformation?: object[];
    }
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定，請設定 CLOUDINARY_CLOUD_NAME、CLOUDINARY_API_KEY 和 CLOUDINARY_API_SECRET 環境變數");
    }

    const uploadOptions: Record<string, any> = {
      resource_type: "image",
      folder: options?.folder || "jiachun-game",
    };

    if (options?.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    if (options?.transformation) {
      uploadOptions.transformation = options.transformation;
    }

    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resource_type: result.resource_type,
    };
  }

  async uploadGamePhoto(
    base64Data: string,
    gameId: string,
    sessionId?: number
  ): Promise<CloudinaryUploadResult> {
    const folder = sessionId
      ? `jiachun-game/games/${gameId}/sessions/${sessionId}`
      : `jiachun-game/games/${gameId}`;

    return this.uploadImage(base64Data, {
      folder,
      transformation: [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  async uploadGameCover(
    base64Data: string,
    gameId: string
  ): Promise<CloudinaryUploadResult> {
    // 不做伺服器端 transformation，讓前端 OptimizedImage 的 preset 統一套用
    // 原本伺服器做 fill+quality 導致前端再套 preset 變成雙層 transformation → 破圖
    return this.uploadImage(base64Data, {
      folder: `jiachun-game/covers`,
      publicId: `game-${gameId}`,
    });
  }

  /** 🎨 場域封面圖（hero / 玩家端遊戲列表頂部） */
  async uploadFieldCover(
    base64Data: string,
    fieldId: string
  ): Promise<CloudinaryUploadResult> {
    return this.uploadImage(base64Data, {
      folder: `jiachun-game/fields/covers`,
      publicId: `field-${fieldId}-cover`,
      transformation: [
        // 場域封面建議 16:9 landscape
        { width: 1920, height: 1080, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  /** 🎨 場域 Logo（顯示於 header 左上） */
  async uploadFieldLogo(
    base64Data: string,
    fieldId: string
  ): Promise<CloudinaryUploadResult> {
    return this.uploadImage(base64Data, {
      folder: `jiachun-game/fields/logos`,
      publicId: `field-${fieldId}-logo`,
      transformation: [
        // Logo 限制最大 512x512，保持透明度
        { width: 512, height: 512, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定");
    }

    await cloudinary.uploader.destroy(publicId);
  }

  async uploadVideo(
    base64Data: string,
    options?: {
      folder?: string;
      publicId?: string;
    }
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定");
    }

    const uploadOptions: Record<string, any> = {
      resource_type: "video",
      folder: options?.folder || "jiachun-game/videos",
    };

    if (options?.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
      resource_type: result.resource_type,
      duration: result.duration,
    };
  }

  async uploadAudio(
    base64Data: string,
    options?: {
      folder?: string;
      publicId?: string;
    }
  ): Promise<CloudinaryUploadResult> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定");
    }

    const uploadOptions: Record<string, any> = {
      resource_type: "video",
      folder: options?.folder || "jiachun-game/audio",
    };

    if (options?.publicId) {
      uploadOptions.public_id = options.publicId;
    }

    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      url: result.url,
      format: result.format,
      bytes: result.bytes,
      resource_type: result.resource_type,
      duration: result.duration,
    };
  }

  async uploadGameMedia(
    base64Data: string,
    gameId: string,
    mediaType: "image" | "video" | "audio"
  ): Promise<CloudinaryUploadResult> {
    const folder = `jiachun-game/games/${gameId}/${mediaType}s`;

    if (mediaType === "video") {
      return this.uploadVideo(base64Data, { folder });
    } else if (mediaType === "audio") {
      return this.uploadAudio(base64Data, { folder });
    } else {
      return this.uploadImage(base64Data, {
        folder,
        transformation: [
          { width: 1200, height: 1200, crop: "limit" },
          { quality: "auto", fetch_format: "auto" },
        ],
      });
    }
  }

  async uploadPlayerPhoto(
    base64Data: string,
    gameId: string,
    sessionId: string
  ): Promise<CloudinaryUploadResult> {
    const folder = `jiachun-game/games/${gameId}/player-photos/${sessionId}`;
    const timestamp = Date.now();

    return this.uploadImage(base64Data, {
      folder,
      publicId: `photo-${timestamp}`,
      transformation: [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
  }

  /**
   * 🆕 v2: 列出某 session 的所有玩家照片（相簿用）
   * 用 Cloudinary Search API 依 folder 過濾
   */
  async listSessionPhotos(gameId: string, sessionId: string): Promise<Array<{
    publicId: string;
    url: string;
    width: number;
    height: number;
    createdAt: string;
  }>> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定");
    }

    const folder = `jiachun-game/games/${gameId}/player-photos/${sessionId}`;
    try {
      const result = await cloudinary.search
        .expression(`folder:${folder}/*`)
        .sort_by("created_at", "desc")
        .max_results(200)
        .execute();

      return (result.resources || []).map((r: {
        public_id: string;
        secure_url: string;
        width: number;
        height: number;
        created_at: string;
      }) => ({
        publicId: r.public_id,
        url: r.secure_url,
        width: r.width,
        height: r.height,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("[cloudinary] listSessionPhotos 失敗:", err);
      return [];
    }
  }

  /**
   * 🆕 v2: 列出某使用者所有照片（個人相簿用）
   * 注：需 DB 知道該 user 所有 session IDs 才能查全。此方法依 folder pattern 查單一 session。
   */
  async listUserPhotos(sessionIds: string[]): Promise<Array<{
    publicId: string;
    url: string;
    sessionId: string;
    createdAt: string;
  }>> {
    if (!this.isConfigured() || sessionIds.length === 0) {
      return [];
    }

    // Cloudinary search expression OR
    const expressions = sessionIds
      .slice(0, 20)   // 最多 20 個 session 避免 query 爆
      .map((sid) => `folder:jiachun-game/games/*/player-photos/${sid}/*`)
      .join(" OR ");

    try {
      const result = await cloudinary.search
        .expression(expressions)
        .sort_by("created_at", "desc")
        .max_results(500)
        .execute();

      return (result.resources || []).map((r: {
        public_id: string;
        secure_url: string;
        folder?: string;
        created_at: string;
      }) => {
        // 從 folder 路徑抽 sessionId
        const match = r.folder?.match(/player-photos\/([^/]+)/);
        const sessionId = match ? match[1] : "";
        return {
          publicId: r.public_id,
          url: r.secure_url,
          sessionId,
          createdAt: r.created_at,
        };
      });
    } catch (err) {
      console.error("[cloudinary] listUserPhotos 失敗:", err);
      return [];
    }
  }

  getStatus(): { configured: boolean; cloudName?: string } {
    const configured = this.isConfigured();
    return {
      configured,
      cloudName: configured ? process.env.CLOUDINARY_CLOUD_NAME : undefined,
    };
  }
}

export const cloudinaryService = new CloudinaryService();
