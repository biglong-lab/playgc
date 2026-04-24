// 🎭 Face Landmarker 封裝 — MediaPipe 臉部關鍵點偵測
//
// 合規原則（關鍵）：
//   - 只做 landmark detection（468 個點），不做 face recognition（不判斷「是誰」）
//   - 純瀏覽器端處理（WASM + WebGL），不傳 server、不存 face data
//   - model 檔案從 CDN 載入（MediaPipe 官方）
//   - 使用者需明確 opt-in（B4 加 Dialog 同意後才啟用）
//
// 應用：
//   - AR 貼圖錨定到眼睛/鼻子/嘴巴/頭頂
//   - 拍照時即時追蹤臉部位置
//
// 效能：
//   - 預設 downscale 到 320x240 做偵測（實際顯示仍是高解析度）
//   - 只跑 1 張臉（numFaces: 1），省運算
//   - WebGL delegate（比 CPU 快 5-10x）

import type {
  FaceLandmarker,
  FaceLandmarkerResult,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

// ============================================================================
// 型別
// ============================================================================

export type AnchorPoint =
  | "none"
  | "face"        // 整張臉的中心
  | "face_top"    // 額頭上方（戴帽子用）
  | "eyes"        // 眼睛中間（戴眼鏡用）
  | "nose"        // 鼻尖（鼻貼用）
  | "mouth"       // 嘴巴（口罩用）
  | "hand";       // Future: 手部（需另一個 HandLandmarker）

export interface AnchorCoordinate {
  /** x 座標（0-1，相對於影像寬度） */
  x: number;
  /** y 座標（0-1，相對於影像高度） */
  y: number;
  /** 此錨點所涵蓋的寬度（0-1） */
  width: number;
  /** 此錨點所涵蓋的高度（0-1） */
  height: number;
  /** 臉部繞 Y 軸的旋轉（左右轉頭） */
  rotationY?: number;
}

// ============================================================================
// Lazy loader — 避免啟動時就載入 ~20MB 的 WASM
// ============================================================================

// MediaPipe Face Landmarker 的 type 與 instance
type MediaPipeNamespace = typeof import("@mediapipe/tasks-vision");
let mediapipeNs: MediaPipeNamespace | null = null;
let landmarkerInstance: FaceLandmarker | null = null;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";

/** 載入 MediaPipe namespace（~5MB WASM，第一次呼叫會花 1-3 秒）*/
async function loadMediaPipe(): Promise<MediaPipeNamespace> {
  if (mediapipeNs) return mediapipeNs;
  const ns = await import("@mediapipe/tasks-vision");
  mediapipeNs = ns;
  return ns;
}

/**
 * 取得 FaceLandmarker instance（singleton）
 * 第一次呼叫需要 ~3 秒（載 WASM + 模型），之後毫秒級
 */
export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (landmarkerInstance) return landmarkerInstance;

  const ns = await loadMediaPipe();
  const { FaceLandmarker, FilesetResolver } = ns;

  // 載 WASM runtime
  const filesetResolver = await FilesetResolver.forVisionTasks(WASM_CDN);

  // 建 FaceLandmarker
  landmarkerInstance = await FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate: "GPU", // WebGL；不支援時自動 fallback CPU
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: false, // 不用表情分析（省運算 + 保護隱私）
    outputFacialTransformationMatrixes: true, // 要用來算旋轉
  });

  return landmarkerInstance;
}

/** 清理 instance（關閉相機時呼叫） */
export async function closeFaceLandmarker(): Promise<void> {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch (e) {
      // 忽略關閉錯誤
    }
    landmarkerInstance = null;
  }
}

// ============================================================================
// 偵測 + 取錨點
// ============================================================================

/** 對 video 元素做一次臉部偵測（VIDEO mode，timestamp 必須遞增） */
export function detectFaceForVideo(
  landmarker: FaceLandmarker,
  video: HTMLVideoElement,
  timestampMs: number,
): FaceLandmarkerResult {
  return landmarker.detectForVideo(video, timestampMs);
}

/** MediaPipe Face Mesh 468 個點的關鍵索引（from official docs） */
const FACE_LANDMARKS = {
  // 頭頂（用於戴帽子）
  foreheadCenter: 10,
  // 左右眼（內眼角）
  leftEyeInner: 133,
  rightEyeInner: 362,
  // 雙眼中點（approximated by nose bridge 168）
  noseBridge: 168,
  // 鼻尖
  noseTip: 1,
  // 嘴巴中心
  mouthCenter: 13, // 上嘴唇上緣
  mouthBottom: 14,  // 下嘴唇下緣
  // 臉頰邊界（用來算 face width）
  leftCheek: 234,
  rightCheek: 454,
  // 下巴
  chin: 152,
} as const;

/** 從 FaceLandmarker 結果取出特定錨點座標（0-1 normalized）*/
export function getAnchorCoordinate(
  result: FaceLandmarkerResult,
  anchor: AnchorPoint,
): AnchorCoordinate | null {
  if (anchor === "none" || anchor === "hand") return null;
  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks || landmarks.length === 0) return null;

  // 計算 face bounding box（用於算 face width）
  const left = landmarks[FACE_LANDMARKS.leftCheek];
  const right = landmarks[FACE_LANDMARKS.rightCheek];
  const top = landmarks[FACE_LANDMARKS.foreheadCenter];
  const bottom = landmarks[FACE_LANDMARKS.chin];
  if (!left || !right || !top || !bottom) return null;

  const faceWidth = Math.abs(right.x - left.x);
  const faceHeight = Math.abs(bottom.y - top.y);

  // 計算旋轉（從 transformation matrix 取 yaw）
  let rotationY: number | undefined;
  const mat = result.facialTransformationMatrixes?.[0];
  if (mat?.data && mat.data.length >= 16) {
    // yaw（繞 Y 軸）= atan2(-m20, m00)（OpenGL col-major）
    const m00 = mat.data[0];
    const m20 = mat.data[2];
    rotationY = Math.atan2(-m20, m00);
  }

  let point: NormalizedLandmark | undefined;
  let size = faceWidth;

  switch (anchor) {
    case "face":
      return {
        x: (left.x + right.x) / 2,
        y: (top.y + bottom.y) / 2,
        width: faceWidth,
        height: faceHeight,
        rotationY,
      };
    case "face_top":
      point = top;
      size = faceWidth * 0.9;
      // 往上偏移 20% 讓帽子在頭頂
      return {
        x: point.x,
        y: point.y - faceHeight * 0.2,
        width: size,
        height: size,
        rotationY,
      };
    case "eyes": {
      const leftEye = landmarks[FACE_LANDMARKS.leftEyeInner];
      const rightEye = landmarks[FACE_LANDMARKS.rightEyeInner];
      if (!leftEye || !rightEye) return null;
      return {
        x: (leftEye.x + rightEye.x) / 2,
        y: (leftEye.y + rightEye.y) / 2,
        width: faceWidth * 0.7,
        height: faceWidth * 0.25, // 眼睛區域是扁的
        rotationY,
      };
    }
    case "nose":
      point = landmarks[FACE_LANDMARKS.noseTip];
      if (!point) return null;
      return {
        x: point.x,
        y: point.y,
        width: faceWidth * 0.3,
        height: faceWidth * 0.3,
        rotationY,
      };
    case "mouth": {
      const mouthTop = landmarks[FACE_LANDMARKS.mouthCenter];
      const mouthBot = landmarks[FACE_LANDMARKS.mouthBottom];
      if (!mouthTop || !mouthBot) return null;
      return {
        x: (mouthTop.x + mouthBot.x) / 2,
        y: (mouthTop.y + mouthBot.y) / 2,
        width: faceWidth * 0.5,
        height: faceHeight * 0.2,
        rotationY,
      };
    }
    default:
      return null;
  }
}

/** 檢查 FaceLandmarker 是否已初始化（UI 判斷用）*/
export function isFaceLandmarkerReady(): boolean {
  return landmarkerInstance !== null;
}
