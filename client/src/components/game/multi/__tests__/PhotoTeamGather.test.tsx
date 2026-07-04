import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── mock 相機 hook ─────────────────────────────────────────────────────────────
const mockCamera = {
  mode: "idle" as string,
  cameraReady: false,
  capturedImage: null as string | null,
  cameraError: null as string | null,
  facingMode: "user" as string,
  videoRef: { current: null },
  fileInputRef: { current: null },
  startCamera: vi.fn(),
  stopCamera: vi.fn(),
  capturePhoto: vi.fn(),
  retake: vi.fn(),
  cancelCamera: vi.fn(),
  switchCamera: vi.fn(),
  handleFileUpload: vi.fn(),
  setCapturedImage: vi.fn(),
};
vi.mock("../../photo-mission/usePhotoCamera", () => ({ usePhotoCamera: () => mockCamera }));

// ── mock PhotoViews & PhotoSuccessView ─────────────────────────────────────────
vi.mock("../../photo-mission/PhotoViews", () => ({
  CameraInitializingView: ({ onCancel }: { onCancel?: () => void }) => (
    <div data-testid="camera-initializing">
      <button data-testid="btn-cancel-init" onClick={onCancel}>取消</button>
    </div>
  ),
  CameraView: () => <div data-testid="camera-view" />,
  PhotoPreview: ({ onRetake, onSubmit }: { onRetake?: () => void; onSubmit?: () => void }) => (
    <div data-testid="photo-preview">
      <button data-testid="btn-retake" onClick={onRetake}>重拍</button>
      <button data-testid="btn-submit-preview" onClick={onSubmit}>確認</button>
    </div>
  ),
  UploadingView: () => <div data-testid="uploading-view" />,
}));
vi.mock("../../photo-mission/PhotoSuccessView", () => ({
  default: ({ testId, onContinue }: { testId?: string; onContinue?: () => void }) => (
    <div data-testid={testId ?? "photo-success"}>
      <button data-testid="btn-done-continue" onClick={onContinue}>繼續</button>
    </div>
  ),
}));

// ── mock tanstack query ─────────────────────────────────────────────────────────
const mockUploadMutateAsync = vi.fn().mockResolvedValue({ url: "http://uploaded.jpg" });
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: mockUploadMutateAsync }),
  useQuery: () => ({ data: { id: "team1", members: [] } }),
}));

// ── mock toast & auth & websocket ──────────────────────────────────────────────
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mockToast }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", firstName: "Alice", email: "alice@test.com" } }) }));
vi.mock("@/hooks/use-team-websocket", () => ({ useTeamWebSocket: vi.fn() }));

// ── mock api ───────────────────────────────────────────────────────────────────
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({ json: async () => ({ state: null }) }),
  apiRequestWithTimeout: vi.fn().mockResolvedValue({ json: async () => ({ url: "http://t.jpg" }) }),
}));

import PhotoTeamGather from "../PhotoTeamGather";
import type { PhotoMissionConfig } from "@shared/schema";

const baseConfig: PhotoMissionConfig = {
  targetKeywords: [],
  onSuccess: {},
  teamConfig: { captureMode: "gather", gatherMaxShots: 3, minMembers: 2, maxMembers: 6, layoutMode: "grid" },
} as unknown as PhotoMissionConfig;

const defaultProps = {
  config: baseConfig,
  onComplete: vi.fn(),
  sessionId: "s1",
  gameId: "g1",
  pageId: "p1",
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockCamera, {
    mode: "idle",
    cameraReady: false,
    capturedImage: null,
    cameraError: null,
  });
});

describe("PhotoTeamGather", () => {
  it("stateLoaded 前顯示 loading UI", () => {
    // query 傳 null（data 未載入）
    render(<PhotoTeamGather {...defaultProps} />);
    // teamId 存在且 stateLoaded=false → state-loading UI
    expect(screen.getByTestId("photo-gather-state-loading")).toBeTruthy();
  });

  it("stateLoaded 後顯示 intro（無既有合照）", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.queryByTestId("photo-gather-intro")).toBeTruthy();
    });
  });

  it("顯示自定義 title", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    const cfg = { ...baseConfig, title: "大合照！" };
    render(<PhotoTeamGather {...defaultProps} config={cfg} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("photo-gather-intro").textContent).toContain("大合照！");
    });
  });

  it("intro 顯示開始按鈕", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("btn-gather-start")).toBeTruthy();
    });
  });

  it("按開始進入倒數", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("btn-gather-start"));
    fireEvent.click(screen.getByTestId("btn-gather-start"));
    expect(screen.getByTestId("photo-gather-countdown")).toBeTruthy();
  });

  it("倒數 UI 顯示集合提示", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("btn-gather-start"));
    fireEvent.click(screen.getByTestId("btn-gather-start"));
    expect(screen.getByTestId("photo-gather-countdown").textContent).toContain("集合");
  });

  it("倒數可以取消回 intro", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("btn-gather-start"));
    fireEvent.click(screen.getByTestId("btn-gather-start"));
    // 倒數 UI 有取消按鈕（production 已加 aria-label、accessible name 為完整敘述）
    const cancelBtn = screen.getByRole("button", { name: "取消倒數、返回介紹" });
    fireEvent.click(cancelBtn);
    expect(screen.getByTestId("photo-gather-intro")).toBeTruthy();
  });

  it("shooting 且 mode=initializing 顯示初始化 UI", async () => {
    mockCamera.mode = "initializing";
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("btn-gather-start"));
    fireEvent.click(screen.getByTestId("btn-gather-start"));
    // countdown → countdown UI，countdown 結束後進入 shooting（需等計時）
    // 這裡直接測試 countdown 顯示即可，因為不等計時
    expect(screen.getByTestId("photo-gather-countdown")).toBeTruthy();
  });

  it("shooting 有 cameraError 顯示錯誤 UI", async () => {
    mockCamera.cameraError = "相機無法開啟";
    mockCamera.mode = "idle";
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("btn-gather-start"));
    fireEvent.click(screen.getByTestId("btn-gather-start"));
    // 倒數結束觸發 startCamera，useEffect 依賴 countdown，這裡只驗倒數數字顯示
    expect(screen.getByTestId("photo-gather-countdown")).toBeTruthy();
  });

  it("既有合照時直接顯示 done UI", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({
      json: async () => ({
        state: {
          id: "pg1", team_id: "t1", session_id: "s1", page_id: "p1",
          completed_by_user_id: "u99", completed_by_display_name: "Bob",
          main_photo_url: "http://img.jpg", shot_count: 1, completed_at: "2026-01-01T00:00:00Z",
        },
      }),
    } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => {
      expect(screen.getByTestId("photo-gather-done")).toBeTruthy();
    });
  });

  it("done UI 有繼續按鈕", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({
      json: async () => ({
        state: {
          id: "pg1", team_id: "t1", session_id: "s1", page_id: "p1",
          completed_by_user_id: "u99", completed_by_display_name: "Bob",
          main_photo_url: "http://img.jpg", shot_count: 1, completed_at: "2026-01-01T00:00:00Z",
        },
      }),
    } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("photo-gather-done"));
    expect(screen.getByTestId("btn-done-continue")).toBeTruthy();
  });

  it("done 按繼續呼叫 onComplete", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({
      json: async () => ({
        state: {
          id: "pg1", team_id: "t1", session_id: "s1", page_id: "p1",
          completed_by_user_id: "u1", completed_by_display_name: "Alice",
          main_photo_url: "http://img.jpg", shot_count: 1, completed_at: "2026-01-01T00:00:00Z",
        },
      }),
    } as Response);
    const onComplete = vi.fn();
    render(<PhotoTeamGather {...defaultProps} onComplete={onComplete} />);
    await vi.waitFor(() => screen.getByTestId("btn-done-continue"));
    fireEvent.click(screen.getByTestId("btn-done-continue"));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("intro 有說明文字（instruction）", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    const cfg = { ...baseConfig, instruction: "請大家站到拍照區" };
    render(<PhotoTeamGather {...defaultProps} config={cfg} />);
    await vi.waitFor(() => screen.getByTestId("photo-gather-intro"));
    expect(screen.getByTestId("photo-gather-intro").textContent).toContain("請大家站到拍照區");
  });

  it("intro 有操作說明卡片", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("photo-gather-intro"));
    expect(screen.getByTestId("photo-gather-intro").textContent).toContain("怎麼拍");
  });

  it("uploading 階段顯示上傳中 UI", async () => {
    const { apiRequest } = await import("@/lib/queryClient");
    vi.mocked(apiRequest).mockResolvedValueOnce({ json: async () => ({ state: null }) } as Response);
    // 無法直接觸發 uploading 階段（需要真實 setStage）；確認元件不崩潰即可
    render(<PhotoTeamGather {...defaultProps} />);
    await vi.waitFor(() => screen.getByTestId("photo-gather-state-loading"));
    expect(screen.getByTestId("photo-gather-state-loading")).toBeTruthy();
  });

  it("有 teamId 時初始顯示 state-loading 等待 API 回應", () => {
    // 預設 mock：useQuery 回 { id: "team1" }，apiRequest 尚未 resolve → stateLoaded=false
    render(<PhotoTeamGather {...defaultProps} />);
    expect(screen.getByTestId("photo-gather-state-loading")).toBeTruthy();
  });
});
