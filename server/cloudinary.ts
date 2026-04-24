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
   * 🆕 v2: 產生 session 相簿 ZIP 下載 URL（Cloudinary 原生 archive 功能）
   * @param gameId - 遊戲 ID
   * @param sessionId - session ID
   * @returns signed archive URL 或 null（若無照片）
   *
   * 優點：一個 zip 檔取代批次下載，手機桌面 UX 一致、大量照片也順
   */
  async createSessionArchiveUrl(
    gameId: string,
    sessionId: string,
  ): Promise<string | null> {
    if (!this.isConfigured()) {
      throw new Error("Cloudinary 尚未設定");
    }
    const prefix = `jiachun-game/games/${gameId}/player-photos/${sessionId}`;
    try {
      // 先檢查 folder 是否有資源（避免產生空 zip）
      const search = await cloudinary.search
        .expression(`folder:${prefix}/*`)
        .max_results(1)
        .execute();
      if (!search.resources?.length) return null;

      // Cloudinary download_zip_url: 即時產生 signed URL，使用者訪問時才實際打包
      // 無需 upload API，純簽章式 URL
      const url = cloudinary.utils.download_zip_url({
        resource_type: "image",
        prefixes: [prefix],
      });
      return url;
    } catch (err) {
      console.error("[cloudinary] createSessionArchiveUrl 失敗:", err);
      return null;
    }
  }

  /**
   * 🆕 v2: 產生使用者跨 session 相簿 ZIP（多 session prefix 一次打包）
   */
  async createUserArchiveUrl(sessionIds: string[]): Promise<string | null> {
    if (!this.isConfigured() || sessionIds.length === 0) {
      return null;
    }
    const prefixes = sessionIds
      .slice(0, 20)   // 最多 20 個 session 避免 URL 過長
      .map((sid) => `jiachun-game/games`)   // 需要 gameId... 但這個 helper 不知道 gameId 組合
      // 退而求其次：用 resource search expression OR
      ;
    try {
      // 用 public_ids 太冗長；改用 search 取得所有 publicIds 再丟到 archive
      const photos = await this.listUserPhotos(sessionIds);
      if (photos.length === 0) return null;
      const url = cloudinary.utils.download_zip_url({
        resource_type: "image",
        public_ids: photos.map((p) => p.publicId),
      });
      return url;
    } catch (err) {
      console.error("[cloudinary] createUserArchiveUrl 失敗:", err);
      return null;
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

  /**
   * 🆕 v2: 取得 Cloudinary 帳號用量（Admin API usage endpoint）
   * 回傳本月使用量 + 限額 + 百分比，供管理後台儀表板
   */
  async getUsage(): Promise<{
    plan?: string;
    credits?: { used: number; limit: number; percent: number };
    storage?: { used: number; limit: number; percent: number };
    bandwidth?: { used: number; limit: number; percent: number };
    transformations?: { used: number; limit: number; percent: number };
    requests?: number;
    resources?: number;
    derivedResources?: number;
    error?: string;
  }> {
    if (!this.isConfigured()) {
      return { error: "Cloudinary 尚未設定" };
    }
    try {
      // @ts-expect-error - Cloudinary SDK types 不完整
      const usage = await cloudinary.api.usage();

      // Free plan: storage 25GB / bandwidth 25GB / transformations 25k/month
      const toPercent = (used: number, limit: number): number => {
        if (!limit || limit === 0) return 0;
        return Math.round((used / limit) * 100);
      };

      return {
        plan: usage.plan,
        credits: usage.credits
          ? {
              used: usage.credits.usage ?? 0,
              limit: usage.credits.limit ?? 0,
              percent: toPercent(usage.credits.usage ?? 0, usage.credits.limit ?? 0),
            }
          : undefined,
        storage: usage.storage
          ? {
              used: usage.storage.usage ?? 0,
              limit: usage.storage.limit ?? 0,
              percent: toPercent(usage.storage.usage ?? 0, usage.storage.limit ?? 0),
            }
          : undefined,
        bandwidth: usage.bandwidth
          ? {
              used: usage.bandwidth.usage ?? 0,
              limit: usage.bandwidth.limit ?? 0,
              percent: toPercent(usage.bandwidth.usage ?? 0, usage.bandwidth.limit ?? 0),
            }
          : undefined,
        transformations: usage.transformations
          ? {
              used: usage.transformations.usage ?? 0,
              limit: usage.transformations.limit ?? 0,
              percent: toPercent(usage.transformations.usage ?? 0, usage.transformations.limit ?? 0),
            }
          : undefined,
        requests: usage.requests,
        resources: usage.resources,
        derivedResources: usage.derived_resources,
      };
    } catch (err) {
      console.error("[cloudinary] getUsage 失敗:", err);
      return {
        error: err instanceof Error ? err.message : "取得用量失敗",
      };
    }
  }
}

export const cloudinaryService = new CloudinaryService();
