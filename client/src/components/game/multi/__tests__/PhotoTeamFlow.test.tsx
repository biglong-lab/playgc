import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── mock 相機 hook（路徑從 __tests__/ 往上兩層）────────────────────────────────
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
  PhotoPreview: () => <div data-testid="photo-preview" />,
  UploadingView: () => <div data-testid="uploading-view" />,
}));
vi.mock("../../photo-mission/PhotoSuccessView", () => ({
  default: ({ testId }: { testId?: string }) => <div data-testid={testId ?? "photo-success"} />,
}));

// ── mock tanstack query ─────────────────────────────────────────────────────────
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue({ compositeUrl: "http://test.jpg" }) }),
  useQuery: () => ({ data: null }),
}));

// ── mock toast & auth & websocket ──────────────────────────────────────────────
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1", firstName: "Alice" } }) }));
vi.mock("@/hooks/use-team-websocket", () => ({ useTeamWebSocket: vi.fn() }));

// ── mock api ───────────────────────────────────────────────────────────────────
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({ json: async () => ({ state: null }) }),
  apiRequestWithTimeout: vi.fn().mockResolvedValue({ json: async () => ({ publicId: "pid", url: "http://t.jpg" }) }),
}));
vi.mock("@/lib/photo-save", () => ({
  savePhotoToAlbum: vi.fn().mockResolvedValue({ method: "download", ok: true }),
  getSaveToastMessage: () => ({}),
}));
vi.mock("@/lib/event-report", () => ({ reportClientEvent: vi.fn() }));

// ── mock PhotoTeamGather ───────────────────────────────────────────────────────
vi.mock("../PhotoTeamGather", () => ({
  default: () => <div data-testid="photo-team-gather-mock" />,
}));

import PhotoTeamFlow from "../PhotoTeamFlow";

const baseConfig = {
  targetKeywords: [],
  onSuccess: {},
  teamConfig: { captureMode: "collage" as const, minMembers: 2, maxMembers: 4, layoutMode: "grid" as const },
} as Parameters<typeof PhotoTeamFlow>[0]["config"];

const defaultProps = {
  config: baseConfig,
  onComplete: vi.fn(),
  sessionId: "s1",
  gameId: "g1",
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

describe("PhotoTeamFlow", () => {
  it("gather 模式委派給 PhotoTeamGather", () => {
    const gatherConfig = { ...baseConfig, teamConfig: { ...baseConfig.teamConfig, captureMode: "gather" as const } };
    render(<PhotoTeamFlow {...defaultProps} config={gatherConfig} />);
    expect(screen.getByTestId("photo-team-gather-mock")).toBeTruthy();
  });

  it("captureMode 未定義時 fallback 到 gather 模式", () => {
    const noModeConfig = { ...baseConfig, teamConfig: undefined };
    render(<PhotoTeamFlow {...defaultProps} config={noModeConfig as typeof baseConfig} />);
    expect(screen.getByTestId("photo-team-gather-mock")).toBeTruthy();
  });

  it("collage 模式顯示 intro", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(screen.getByTestId("photo-team-intro")).toBeTruthy();
  });

  it("collage intro 顯示自定義標題", () => {
    const cfg = { ...baseConfig, title: "隊員合照任務" };
    render(<PhotoTeamFlow {...defaultProps} config={cfg} />);
    expect(screen.getByTestId("photo-team-intro").textContent).toContain("隊員合照任務");
  });

  it("collage intro 無 title 顯示預設文字", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(screen.getByTestId("photo-team-intro").textContent).toContain("團體合影");
  });

  it("collage intro 顯示開始按鈕", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(screen.getByTestId("btn-team-start")).toBeTruthy();
  });

  it("collage intro 顯示隊員最小數", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(screen.getByTestId("photo-team-intro").textContent).toContain("2");
  });

  it("collage intro 顯示 instruction", () => {
    const cfg = { ...baseConfig, instruction: "大家站好！" };
    render(<PhotoTeamFlow {...defaultProps} config={cfg} />);
    expect(screen.getByTestId("photo-team-intro").textContent).toContain("大家站好！");
  });

  it("按開始進入 select_count 階段", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    expect(screen.getByTestId("photo-team-select-count")).toBeTruthy();
  });

  it("select_count 顯示隊員數量按鈕", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    expect(screen.getByTestId("btn-team-count-2")).toBeTruthy();
    expect(screen.getByTestId("btn-team-count-4")).toBeTruthy();
  });

  it("select_count 顯示第一位名字輸入框", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    expect(screen.getByTestId("input-team-first-name")).toBeTruthy();
  });

  it("select_count 點擊數字選取隊員數", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-count-3"));
    expect(screen.getByTestId("btn-team-count-3").className).toContain("ring-2");
  });

  it("select_count 輸入第一位名字", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    const nameInput = screen.getByTestId("input-team-first-name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "阿榮" } });
    expect(nameInput.value).toBe("阿榮");
  });

  it("開始拍攝呼叫 startCamera", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    expect(mockCamera.startCamera).toHaveBeenCalled();
  });

  it("shooting 階段且 mode=initializing 顯示初始化 UI", () => {
    mockCamera.mode = "initializing";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    expect(screen.getByTestId("camera-initializing")).toBeTruthy();
  });

  it("cancel init 後回到 intro", () => {
    mockCamera.mode = "initializing";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    fireEvent.click(screen.getByTestId("btn-cancel-init"));
    expect(screen.getByTestId("photo-team-intro")).toBeTruthy();
  });

  it("shooting 階段有 cameraError 時顯示錯誤救援", () => {
    mockCamera.cameraError = "相機被拒絕";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    expect(screen.getByTestId("camera-error-rescue")).toBeTruthy();
  });

  it("camera-error 有重試按鈕", () => {
    mockCamera.cameraError = "相機失敗";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    expect(screen.getByTestId("btn-retry-camera")).toBeTruthy();
  });

  it("camera-error 有從相簿選擇按鈕", () => {
    mockCamera.cameraError = "相機失敗";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    expect(screen.getByTestId("btn-pick-from-gallery")).toBeTruthy();
  });

  it("camera-error 取消按鈕呼叫 cancelCamera", () => {
    mockCamera.cameraError = "相機失敗";
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-team-start"));
    fireEvent.click(screen.getByTestId("btn-team-start-shooting"));
    fireEvent.click(screen.getByTestId("btn-cancel-shooting"));
    expect(mockCamera.cancelCamera).toHaveBeenCalled();
  });
});
