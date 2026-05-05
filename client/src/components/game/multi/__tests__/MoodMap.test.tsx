import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MoodMap, {
  MoodMapConfig,
  MoodMapState,
} from "../MoodMap";

const BASE_CONFIG: MoodMapConfig = {
  title: "心情地圖測試",
  prompt: "點擊放置座標",
  xLow: "低能量",
  xHigh: "高能量",
  yLow: "負面",
  yHigh: "正面",
};

const EMPTY_STATE: MoodMapState = {
  positions: [],
  revealed: false,
};

const WITH_POSITIONS: MoodMapState = {
  positions: [
    { posId: "p1", userId: "u1", userName: "Alice", x: 70, y: 80 },
    { posId: "p2", userId: "u2", userName: "Bob", x: 30, y: 40 },
  ],
  revealed: false,
};

const REVEALED_STATE: MoodMapState = {
  ...WITH_POSITIONS,
  revealed: true,
};

function setup(
  state: MoodMapState = EMPTY_STATE,
  config: MoodMapConfig = BASE_CONFIG,
  myUserId = "u1"
) {
  const onPlace = vi.fn();
  const onReveal = vi.fn();
  render(
    <MoodMap
      config={config}
      state={state}
      myUserId={myUserId}
      onPlace={onPlace}
      onReveal={onReveal}
    />
  );
  return { onPlace, onReveal };
}

describe("MoodMap — 標題與說明", () => {
  it("顯示標題", () => {
    setup();
    expect(screen.getByTestId("mm-title")).toHaveTextContent("心情地圖測試");
  });

  it("顯示提示文字", () => {
    setup();
    expect(screen.getByTestId("mm-prompt")).toHaveTextContent("點擊放置座標");
  });

  it("顯示 X 軸標籤", () => {
    setup();
    expect(screen.getByTestId("mm-x-low")).toHaveTextContent("低能量");
    expect(screen.getByTestId("mm-x-high")).toHaveTextContent("高能量");
  });

  it("顯示 Y 軸標籤", () => {
    setup();
    expect(screen.getByTestId("mm-y-high")).toHaveTextContent("正面");
    expect(screen.getByTestId("mm-y-low")).toHaveTextContent("負面");
  });
});

describe("MoodMap — 地圖互動", () => {
  it("顯示地圖元素", () => {
    setup();
    expect(screen.getByTestId("mm-map")).toBeInTheDocument();
  });

  it("顯示已標記人數", () => {
    setup(WITH_POSITIONS);
    expect(screen.getByTestId("mm-count")).toHaveTextContent("2");
  });

  it("我的位置顯示標記", () => {
    setup(WITH_POSITIONS);
    expect(screen.getByTestId("mm-my-pos")).toBeInTheDocument();
  });

  it("我的位置包含座標", () => {
    setup(WITH_POSITIONS);
    expect(screen.getByTestId("mm-my-pos")).toHaveTextContent("70");
    expect(screen.getByTestId("mm-my-pos")).toHaveTextContent("80");
  });
});

describe("MoodMap — 公布按鈕", () => {
  it("未公布時顯示公布按鈕", () => {
    setup(WITH_POSITIONS);
    expect(screen.getByTestId("mm-reveal-btn")).toBeInTheDocument();
  });

  it("點擊公布呼叫 onReveal", () => {
    const { onReveal } = setup(WITH_POSITIONS);
    fireEvent.click(screen.getByTestId("mm-reveal-btn"));
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it("公布後不顯示公布按鈕", () => {
    setup(REVEALED_STATE);
    expect(screen.queryByTestId("mm-reveal-btn")).toBeNull();
  });
});

describe("MoodMap — 公布後顯示", () => {
  it("公布後顯示所有人的點", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("mm-dot-u1")).toBeInTheDocument();
    expect(screen.getByTestId("mm-dot-u2")).toBeInTheDocument();
  });

  it("公布後顯示總人數", () => {
    setup(REVEALED_STATE);
    expect(screen.getByTestId("mm-revealed-count")).toHaveTextContent("2");
  });

  it("未公布時只看到自己的點", () => {
    setup(WITH_POSITIONS);
    expect(screen.getByTestId("mm-dot-u1")).toBeInTheDocument();
    expect(screen.queryByTestId("mm-dot-u2")).toBeNull();
  });
});
