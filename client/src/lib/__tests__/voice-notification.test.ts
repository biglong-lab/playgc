import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  speakTeamEvent,
  isVoiceEnabled,
  setVoiceEnabled,
  _resetVoiceThrottle,
} from "../voice-notification";

// Mock SpeechSynthesisUtterance + window.speechSynthesis
class MockUtterance {
  text: string;
  lang = "";
  volume = 1;
  rate = 1;
  pitch = 1;
  voice: unknown = null;
  constructor(text: string) {
    this.text = text;
  }
}

const mockSpeak = vi.fn();
const mockGetVoices = vi.fn(() => []);

beforeEach(() => {
  // 設定 mock
  vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  vi.stubGlobal("window", {
    speechSynthesis: {
      speak: mockSpeak,
      getVoices: mockGetVoices,
    },
  });
  // localStorage 模擬
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  });
  mockSpeak.mockClear();
  _resetVoiceThrottle();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("voice-notification", () => {
  describe("isVoiceEnabled / setVoiceEnabled", () => {
    it("預設啟用", () => {
      expect(isVoiceEnabled()).toBe(true);
    });

    it("setVoiceEnabled(false) → 關閉", () => {
      setVoiceEnabled(false);
      expect(isVoiceEnabled()).toBe(false);
    });

    it("關閉後 setVoiceEnabled(true) → 重新啟用", () => {
      setVoiceEnabled(false);
      setVoiceEnabled(true);
      expect(isVoiceEnabled()).toBe(true);
    });
  });

  describe("speakTeamEvent", () => {
    it("觸發 disconnected 事件 → 呼叫 speak 並用小聲（volume=0.4）", () => {
      speakTeamEvent("u1", "阿榮", "disconnected");
      expect(mockSpeak).toHaveBeenCalledTimes(1);
      const utter = mockSpeak.mock.calls[0][0] as MockUtterance;
      expect(utter.text).toContain("阿榮");
      expect(utter.text).toContain("離線");
      expect(utter.volume).toBe(0.4);
      expect(utter.lang).toBe("zh-TW");
    });

    it("不同事件用不同句子", () => {
      speakTeamEvent("u1", "阿榮", "reconnected");
      expect((mockSpeak.mock.calls[0][0] as MockUtterance).text).toContain("回來");

      mockSpeak.mockClear();
      _resetVoiceThrottle();
      speakTeamEvent("u1", "阿榮", "left");
      expect((mockSpeak.mock.calls[0][0] as MockUtterance).text).toContain("離開");

      mockSpeak.mockClear();
      _resetVoiceThrottle();
      speakTeamEvent("u1", "阿榮", "graceExpired");
      expect((mockSpeak.mock.calls[0][0] as MockUtterance).text).toContain("寬限期");
    });

    it("60 秒內同 user 同事件 → 不重複播放（spam 防護）", () => {
      speakTeamEvent("u1", "阿榮", "disconnected");
      expect(mockSpeak).toHaveBeenCalledTimes(1);

      // 立刻再呼叫 → 應被擋下
      speakTeamEvent("u1", "阿榮", "disconnected");
      expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it("不同 user 同事件 → 各自播放（不互相 throttle）", () => {
      speakTeamEvent("u1", "阿榮", "disconnected");
      speakTeamEvent("u2", "小明", "disconnected");
      expect(mockSpeak).toHaveBeenCalledTimes(2);
    });

    it("同 user 不同事件 → 不互相 throttle", () => {
      speakTeamEvent("u1", "阿榮", "disconnected");
      speakTeamEvent("u1", "阿榮", "reconnected");
      expect(mockSpeak).toHaveBeenCalledTimes(2);
    });

    it("關閉語音時 → 不呼叫 speak", () => {
      setVoiceEnabled(false);
      speakTeamEvent("u1", "阿榮", "disconnected");
      expect(mockSpeak).not.toHaveBeenCalled();
    });
  });
});
