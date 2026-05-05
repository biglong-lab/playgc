import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PhotoWall from "../PhotoWall";
import type { PhotoWallConfig, PhotoWallState, PhotoEntry } from "../PhotoWall";

const defaultConfig: PhotoWallConfig = {
  title: "📸 活動照片牆",
  prompt: "上傳一張今天的照片！",
  allowCaption: true,
  showAuthor: true,
};

const emptyState: PhotoWallState = { photos: [] };
const mockOnUpload = vi.fn(() => Promise.resolve());
const mockOnLike = vi.fn(() => Promise.resolve());

const samplePhoto: PhotoEntry = {
  id: "p1",
  userId: "other",
  userName: "老王",
  photoUrl: "https://example.com/photo.jpg",
  caption: "美好的一天",
  likedBy: [],
  submittedAt: Date.now() - 1000,
};

describe("PhotoWall", () => {
  it("顯示標題", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-wall-title")).toHaveTextContent("活動照片牆");
  });

  it("顯示提示文字", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-prompt")).toHaveTextContent("上傳一張今天的照片！");
  });

  it("URL 輸入框初始存在", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-url-input")).toBeInTheDocument();
  });

  it("caption 輸入框存在（allowCaption=true）", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-caption-input")).toBeInTheDocument();
  });

  it("送出按鈕初始停用（無 URL）", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-submit-btn")).toBeDisabled();
  });

  it("輸入有效 URL 後按鈕啟用", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    fireEvent.change(screen.getByTestId("photo-url-input"), { target: { value: "https://example.com/a.jpg" } });
    expect(screen.getByTestId("photo-submit-btn")).not.toBeDisabled();
  });

  it("點擊送出後呼叫 onUploadPhoto", async () => {
    const onUpload = vi.fn(() => Promise.resolve());
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={onUpload} onLike={mockOnLike} />);
    fireEvent.change(screen.getByTestId("photo-url-input"), { target: { value: "https://example.com/a.jpg" } });
    fireEvent.click(screen.getByTestId("photo-submit-btn"));
    await waitFor(() => {
      expect(onUpload).toHaveBeenCalledWith("https://example.com/a.jpg", undefined);
    });
  });

  it("已上傳時顯示確認狀態", () => {
    const myPhoto: PhotoEntry = { id: "p2", userId: "u1", userName: "我", photoUrl: "https://example.com/b.jpg", likedBy: [], submittedAt: Date.now() };
    const state: PhotoWallState = { photos: [myPhoto] };
    render(<PhotoWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-submitted")).toBeInTheDocument();
  });

  it("顯示照片卡片（其他人）", () => {
    const state: PhotoWallState = { photos: [samplePhoto] };
    render(<PhotoWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-card-p1")).toBeInTheDocument();
  });

  it("顯示照片張數徽章", () => {
    const state: PhotoWallState = { photos: [samplePhoto] };
    render(<PhotoWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("photo-count")).toHaveTextContent("1 張");
  });

  it("按讚按鈕存在", () => {
    const state: PhotoWallState = { photos: [samplePhoto] };
    render(<PhotoWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.getByTestId("like-btn-p1")).toBeInTheDocument();
  });

  it("點擊按讚呼叫 onLike", async () => {
    const onLike = vi.fn(() => Promise.resolve());
    const state: PhotoWallState = { photos: [samplePhoto] };
    render(<PhotoWall config={defaultConfig} state={state} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={onLike} />);
    fireEvent.click(screen.getByTestId("like-btn-p1"));
    await waitFor(() => {
      expect(onLike).toHaveBeenCalledWith("p1");
    });
  });

  it("allowCaption=false 不顯示 caption 輸入框", () => {
    const cfg = { ...defaultConfig, allowCaption: false };
    render(<PhotoWall config={cfg} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.queryByTestId("photo-caption-input")).not.toBeInTheDocument();
  });

  it("無照片時不顯示張數徽章", () => {
    render(<PhotoWall config={defaultConfig} state={emptyState} myUserId="u1" myUserName="我" onUploadPhoto={mockOnUpload} onLike={mockOnLike} />);
    expect(screen.queryByTestId("photo-count")).not.toBeInTheDocument();
  });
});
