// 🧪 EditableCoverImage 元件測試
//
// 鎖定今日新增的場域 hero banner / 遊戲卡封面編輯元件行為：
//   - admin 才看到編輯按鈕
//   - 點按鈕進入編輯模式
//   - 編輯模式下顯示底部工具列（換封面/重設位置/取消/完成）
//   - 取消還原 / 完成觸發 onSave 帶當前 draft 位置
//   - children（漸層覆蓋層）只在非編輯模式顯示
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import EditableCoverImage from "../EditableCoverImage";

// Mock toast — 元件用它顯示成功/失敗訊息
const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock fetchWithAdminAuth（上傳用）
const mockFetchAdmin = vi.fn();
vi.mock("@/pages/admin-staff/types", () => ({
  fetchWithAdminAuth: (...args: unknown[]) => mockFetchAdmin(...args),
}));

describe("EditableCoverImage", () => {
  beforeEach(() => {
    mockToast.mockReset();
    mockFetchAdmin.mockReset();
  });

  describe("非 admin 模式", () => {
    it("一般使用者看不到編輯按鈕", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={false}
          onSave={vi.fn()}
          testId="test-cover"
        />,
      );
      expect(screen.queryByTestId("test-cover-edit-trigger")).toBeNull();
    });

    it("一般使用者看到圖片內容", () => {
      const { container } = render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={false}
          onSave={vi.fn()}
          testId="test-cover"
        />,
      );
      // 容器存在
      expect(container.querySelector('[data-testid="test-cover"]')).toBeInTheDocument();
    });

    it("無 src + 非 admin → 不渲染編輯按鈕（admin 才會顯示空容器）", () => {
      render(
        <EditableCoverImage
          src={null}
          alt="封面"
          isAdmin={false}
          onSave={vi.fn()}
          testId="test-cover"
          fallback={<div data-testid="fb">無封面</div>}
        />,
      );
      expect(screen.queryByTestId("test-cover-edit-trigger")).toBeNull();
    });
  });

  describe("admin 模式 — 進入編輯", () => {
    it("admin 看到「編輯封面」按鈕", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          testId="test-cover"
        />,
      );
      const trigger = screen.getByTestId("test-cover-edit-trigger");
      expect(trigger).toBeInTheDocument();
      expect(trigger.textContent).toContain("編輯封面");
    });

    it("點擊「編輯封面」進入編輯模式（顯示工具列）", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          uploadEndpoint="/api/admin/test/upload"
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));

      // 工具列顯示完成 / 取消 / 重設位置 / 換封面
      expect(screen.getByTestId("test-cover-save")).toBeInTheDocument();
      expect(screen.getByTestId("test-cover-cancel")).toBeInTheDocument();
      expect(screen.getByTestId("test-cover-reset-position")).toBeInTheDocument();
      expect(screen.getByTestId("test-cover-upload")).toBeInTheDocument();
    });

    it("無 uploadEndpoint 時 → 不顯示「換封面」按鈕", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          // 不傳 uploadEndpoint
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));

      // upload 按鈕應該不存在（沒 endpoint）
      expect(screen.queryByTestId("test-cover-upload")).toBeNull();
      // 但其他按鈕仍在
      expect(screen.getByTestId("test-cover-save")).toBeInTheDocument();
    });

    it("admin 即使無 src 也可進入編輯模式（首次上傳場景）", () => {
      render(
        <EditableCoverImage
          src={null}
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          uploadEndpoint="/api/admin/test/upload"
          testId="test-cover"
          fallback={<div data-testid="fb">無封面</div>}
        />,
      );
      // admin 仍看到編輯按鈕
      const trigger = screen.queryByTestId("test-cover-edit-trigger");
      expect(trigger).toBeInTheDocument();
    });
  });

  describe("admin 模式 — 完成 / 取消", () => {
    it("點「完成」觸發 onSave 帶當前 position", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          position="30% 40%"
          isAdmin={true}
          onSave={onSave}
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));

      await act(async () => {
        fireEvent.click(screen.getByTestId("test-cover-save"));
      });

      // onSave 被呼叫，傳入 draftPosition（初始 = 傳入的 position）
      expect(onSave).toHaveBeenCalledTimes(1);
      const arg = onSave.mock.calls[0][0];
      expect(arg.position).toBe("30% 40%");
    });

    it("點「取消」不觸發 onSave 且退出編輯模式", () => {
      const onSave = vi.fn();
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={onSave}
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));
      fireEvent.click(screen.getByTestId("test-cover-cancel"));

      expect(onSave).not.toHaveBeenCalled();
      // 退出編輯 → 工具列消失，「編輯封面」按鈕回來
      expect(screen.queryByTestId("test-cover-save")).toBeNull();
      expect(screen.queryByTestId("test-cover-edit-trigger")).toBeInTheDocument();
    });

    it("點「重設位置」把 draftPosition 設回 50% 50%", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          position="20% 80%"
          isAdmin={true}
          onSave={onSave}
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));
      fireEvent.click(screen.getByTestId("test-cover-reset-position"));
      await act(async () => {
        fireEvent.click(screen.getByTestId("test-cover-save"));
      });

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ position: "50% 50%" }),
      );
    });

    it("save 失敗時 toast 提示（不退出編輯模式）", async () => {
      const onSave = vi.fn().mockRejectedValue(new Error("server error"));
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={onSave}
          testId="test-cover"
        />,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));
      await act(async () => {
        fireEvent.click(screen.getByTestId("test-cover-save"));
      });

      // toast 顯示失敗
      expect(mockToast).toHaveBeenCalled();
      const toastArg = mockToast.mock.calls[mockToast.mock.calls.length - 1][0];
      expect(toastArg.title).toContain("失敗");
      // 仍在編輯模式（讓 admin 重試）
      expect(screen.getByTestId("test-cover-save")).toBeInTheDocument();
    });
  });

  describe("children 顯示邏輯", () => {
    it("非編輯模式時 children 顯示", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          testId="test-cover"
        >
          <div data-testid="overlay-title">場域名稱</div>
        </EditableCoverImage>,
      );
      expect(screen.getByTestId("overlay-title")).toBeInTheDocument();
    });

    it("編輯模式時 children 隱藏（避免擋拖拉）", () => {
      render(
        <EditableCoverImage
          src="https://example.com/cover.jpg"
          alt="封面"
          isAdmin={true}
          onSave={vi.fn()}
          testId="test-cover"
        >
          <div data-testid="overlay-title">場域名稱</div>
        </EditableCoverImage>,
      );
      fireEvent.click(screen.getByTestId("test-cover-edit-trigger"));
      // children 在編輯模式被藏（讓拖拉區乾淨）
      expect(screen.queryByTestId("overlay-title")).toBeNull();
    });
  });
});
