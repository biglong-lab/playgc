// 👥 PhotoTeamFlow 路由元件測試
//
// 2026-07-04 改版說明：
//   production 已於 2026-05-10 全面強制走 gather 模式（含隊長鎖）：
//   不論 captureMode 為 'gather' / 'collage' / undefined、一律委派 PhotoTeamGather。
//   （原因：業主回報「合照只能隊長拍」、collage 逐位拍 N 張無法套用隊長鎖）
//   舊測試驗證 collage 內部流程（intro → select_count → shooting）已過時、
//   本檔改驗證新契約：路由委派 + deprecation 警告 + props 完整傳遞。

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── mock 相機 hook（PhotoTeamCollage 殘留程式碼的 import 依賴、不會被渲染）────
vi.mock("../../photo-mission/usePhotoCamera", () => ({
  usePhotoCamera: () => ({}),
}));

// ── mock PhotoViews & PhotoSuccessView（同上、僅滿足模組載入）──────────────────
vi.mock("../../photo-mission/PhotoViews", () => ({
  CameraInitializingView: () => <div data-testid="camera-initializing" />,
  CameraView: () => <div data-testid="camera-view" />,
  PhotoPreview: () => <div data-testid="photo-preview" />,
  UploadingView: () => <div data-testid="uploading-view" />,
}));
vi.mock("../../photo-mission/PhotoSuccessView", () => ({
  default: () => <div data-testid="photo-success" />,
}));

// ── mock tanstack query ─────────────────────────────────────────────────────────
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutateAsync: vi.fn() }),
  useQuery: () => ({ data: null }),
}));

// ── mock toast / api / 週邊 ─────────────────────────────────────────────────────
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
  apiRequestWithTimeout: vi.fn(),
}));
vi.mock("@/lib/photo-save", () => ({
  savePhotoToAlbum: vi.fn(),
  getSaveToastMessage: () => ({}),
}));
vi.mock("@/lib/event-report", () => ({ reportClientEvent: vi.fn() }));

// ── mock PhotoTeamGather：把收到的 props 映到 DOM 供斷言（避免 vi.mock hoisting 雷）─
interface GatherMockProps {
  config: { title?: string };
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  gameId: string;
  pageId?: string;
}
vi.mock("../PhotoTeamGather", () => ({
  default: (props: GatherMockProps) => (
    <div
      data-testid="photo-team-gather-mock"
      data-session-id={props.sessionId}
      data-game-id={props.gameId}
      data-page-id={props.pageId ?? ""}
      data-config-title={props.config.title ?? ""}
    >
      <button
        data-testid="btn-gather-complete"
        onClick={() => props.onComplete({ points: 10 }, "next-page")}
      >
        完成
      </button>
    </div>
  ),
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

/** 建立指定 captureMode 的 config（沿用 baseConfig 其餘欄位） */
function configWithMode(mode: "gather" | "collage"): typeof baseConfig {
  return {
    ...baseConfig,
    teamConfig: { ...baseConfig.teamConfig, captureMode: mode },
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  // deprecation 警告不要污染測試輸出、同時可供斷言
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("PhotoTeamFlow（一律委派 PhotoTeamGather）", () => {
  it("gather 模式委派給 PhotoTeamGather", () => {
    render(<PhotoTeamFlow {...defaultProps} config={configWithMode("gather")} />);
    expect(screen.getByTestId("photo-team-gather-mock")).toBeTruthy();
  });

  it("captureMode 未定義時 fallback 到 gather 模式", () => {
    const noModeConfig = { ...baseConfig, teamConfig: undefined };
    render(<PhotoTeamFlow {...defaultProps} config={noModeConfig as typeof baseConfig} />);
    expect(screen.getByTestId("photo-team-gather-mock")).toBeTruthy();
  });

  it("collage 模式（已 deprecated）也委派給 PhotoTeamGather", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(screen.getByTestId("photo-team-gather-mock")).toBeTruthy();
  });

  it("collage 模式發出 deprecation 警告", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("collage"),
    );
  });

  it("gather 模式不發 deprecation 警告", () => {
    render(<PhotoTeamFlow {...defaultProps} config={configWithMode("gather")} />);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("sessionId / gameId 傳遞給 PhotoTeamGather", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    const gather = screen.getByTestId("photo-team-gather-mock");
    expect(gather.getAttribute("data-session-id")).toBe("s1");
    expect(gather.getAttribute("data-game-id")).toBe("g1");
  });

  it("pageId 傳遞給 PhotoTeamGather（server-driven 持久化用）", () => {
    render(<PhotoTeamFlow {...defaultProps} pageId="p9" />);
    expect(
      screen.getByTestId("photo-team-gather-mock").getAttribute("data-page-id"),
    ).toBe("p9");
  });

  it("config 原樣傳遞給 PhotoTeamGather（含自定義 title）", () => {
    const cfg = { ...configWithMode("gather"), title: "隊員合照任務" };
    render(<PhotoTeamFlow {...defaultProps} config={cfg} />);
    expect(
      screen.getByTestId("photo-team-gather-mock").getAttribute("data-config-title"),
    ).toBe("隊員合照任務");
  });

  it("onComplete 回呼鏈路連通（獎勵 + nextPageId 原樣上拋）", () => {
    render(<PhotoTeamFlow {...defaultProps} />);
    fireEvent.click(screen.getByTestId("btn-gather-complete"));
    expect(defaultProps.onComplete).toHaveBeenCalledWith({ points: 10 }, "next-page");
  });
});
