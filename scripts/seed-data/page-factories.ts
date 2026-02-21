// 頁面配置工廠 — 產生各類頁面的 config 物件
// 供 seed 腳本使用，可複用於其他遊戲種子資料

export function textCard(title: string, content: string, extras?: Record<string, unknown>) {
  return { title, content, fontSize: "medium" as const, ...extras };
}

export function dialogue(
  name: string,
  msgs: Array<{ text: string; emotion?: string }>,
) {
  return {
    character: { name, avatar: "" },
    messages: msgs.map((m) => ({ text: m.text, emotion: m.emotion ?? "neutral" })),
    bubbleAnimation: true,
  };
}

export function choiceVerify(
  question: string,
  opts: Array<{ text: string; correct?: boolean; explanation?: string }>,
  extras?: Record<string, unknown>,
) {
  return {
    question,
    options: opts,
    showExplanation: true,
    randomizeOptions: true,
    ...extras,
  };
}

export function gpsMission(
  title: string,
  locationName: string,
  instruction: string,
  points: number,
) {
  return {
    title,
    locationName,
    instruction,
    showMap: true,
    hotZoneHints: true,
    onSuccess: { message: `到達${locationName}！+${points} 分`, points },
  };
}

export function qrScan(
  title: string,
  instruction: string,
  code: string,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    primaryCode: code,
    validationMode: "case_insensitive" as const,
    rewardPoints,
    successMessage: `掃描成功！+${rewardPoints} 分`,
  };
}

export function shootingMission(
  title: string,
  description: string,
  requiredHits: number,
  timeLimit: number,
  rewardPoints: number,
) {
  return {
    title,
    description,
    requiredHits,
    timeLimit,
    successReward: { points: rewardPoints },
    onSuccess: { message: `射擊完成！+${rewardPoints} 分` },
  };
}

export function photoMission(
  title: string,
  instruction: string,
  points: number,
) {
  return {
    title,
    instruction,
    aiVerify: false,
    manualVerify: false,
    onSuccess: { message: `拍照完成！+${points} 分`, points },
  };
}

export function motionChallenge(
  title: string,
  instruction: string,
  challengeType: "shake" | "tilt" | "jump" | "rotate",
  targetValue: number,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    challengeType,
    targetValue,
    timeLimit: 15,
    showProgress: true,
    rewardPoints,
    successMessage: `挑戰成功！+${rewardPoints} 分`,
  };
}

export function gambleButton(
  prompt: string,
  buttons: Array<{ text: string; rewardPoints: number; color: string }>,
) {
  return {
    prompt,
    buttons,
    randomizeOrder: true,
    showStatistics: true,
  };
}

export function lockPage(
  title: string,
  instruction: string,
  combination: string,
  hint: string,
  rewardPoints: number,
) {
  return {
    title,
    instruction,
    lockType: "number" as const,
    combination,
    digits: combination.length,
    maxAttempts: 5,
    hint,
    rewardPoints,
    successMessage: `解鎖成功！+${rewardPoints} 分`,
  };
}

export function timeBomb(
  title: string,
  timeLimit: number,
  tasks: Array<Record<string, unknown>>,
  rewardPoints: number,
) {
  return {
    title,
    instruction: "限時完成所有任務！",
    timeLimit,
    tasks,
    rewardPoints,
    successMessage: `拆彈成功！+${rewardPoints} 分`,
    failureMessage: "時間到！任務失敗...",
  };
}

export function textVerify(
  question: string,
  correctAnswer: string,
  hint: string,
  extras?: Record<string, unknown>,
) {
  return {
    question,
    correctAnswer,
    hint,
    caseSensitive: false,
    maxAttempts: 3,
    showExplanation: true,
    ...extras,
  };
}
