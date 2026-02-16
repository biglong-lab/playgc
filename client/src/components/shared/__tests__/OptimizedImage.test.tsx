import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OptimizedImage from "../OptimizedImage";

describe("OptimizedImage", () => {
  it("渲染帶 src 的圖片", () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="測試" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "測試");
  });

  it("自動加上 loading=lazy", () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="測試" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");
  });

  it("可覆蓋為 loading=eager", () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="測試" loading="eager" />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });

  it("src 為 null 時顯示 fallback", () => {
    render(<OptimizedImage src={null} alt="測試" fallback={<div data-testid="fb">fallback</div>} />);
    expect(screen.getByTestId("fb")).toBeInTheDocument();
  });

  it("src 為 undefined 時顯示預設 fallback", () => {
    const { container } = render(<OptimizedImage src={undefined} alt="測試" />);
    // 預設 fallback 包含 ImageOff icon 的 svg
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("圖片載入錯誤時顯示 fallback", () => {
    render(
      <OptimizedImage
        src="https://example.com/broken.jpg"
        alt="測試"
        fallback={<div data-testid="err-fb">error fallback</div>}
      />,
    );
    const img = screen.getByRole("img");
    fireEvent.error(img);
    expect(screen.getByTestId("err-fb")).toBeInTheDocument();
  });

  it("Cloudinary URL 自動附加變換參數", () => {
    render(
      <OptimizedImage
        src="https://res.cloudinary.com/demo/image/upload/v1/sample.jpg"
        alt="測試"
        preset="card"
      />,
    );
    const img = screen.getByRole("img");
    expect(img.getAttribute("src")).toContain("w_400");
  });

  it("非 Cloudinary URL 不附加變換", () => {
    render(
      <OptimizedImage
        src="https://example.com/img.jpg"
        alt="測試"
        preset="card"
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/img.jpg");
  });

  it("className 正確穿透", () => {
    render(<OptimizedImage src="https://example.com/img.jpg" alt="測試" className="w-full h-48" />);
    expect(screen.getByRole("img")).toHaveClass("w-full", "h-48");
  });

  it("自訂 fallback ReactNode 正確顯示", () => {
    render(
      <OptimizedImage
        src={null}
        alt="測試"
        fallback={<span data-testid="custom">自訂內容</span>}
      />,
    );
    expect(screen.getByTestId("custom")).toHaveTextContent("自訂內容");
  });
});
