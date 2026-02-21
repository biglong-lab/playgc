// crypto.ts 單元測試 — AES-256-GCM 加密/解密 roundtrip
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { encryptApiKey, decryptApiKey } from "../lib/crypto";

// 測試用金鑰（32 bytes hex = 64 字元）
const TEST_KEY = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

describe("crypto - AES-256-GCM", () => {
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
    process.env.FIELD_SETTINGS_ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalKey !== undefined) {
      process.env.FIELD_SETTINGS_ENCRYPTION_KEY = originalKey;
    } else {
      delete process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
    }
  });

  it("加密→解密 roundtrip 應還原明文", () => {
    const plaintext = "AIzaSyD-test-api-key-12345";
    const encrypted = encryptApiKey(plaintext);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("相同明文每次加密結果不同（IV 隨機）", () => {
    const plaintext = "sk-test-key";
    const encrypted1 = encryptApiKey(plaintext);
    const encrypted2 = encryptApiKey(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
    // 但都能解密回原文
    expect(decryptApiKey(encrypted1)).toBe(plaintext);
    expect(decryptApiKey(encrypted2)).toBe(plaintext);
  });

  it("密文格式為 iv:authTag:ciphertext", () => {
    const encrypted = encryptApiKey("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex
    expect(parts[0]).toHaveLength(24);
    // AuthTag = 16 bytes = 32 hex
    expect(parts[1]).toHaveLength(32);
    // Ciphertext 長度 > 0
    expect(parts[2].length).toBeGreaterThan(0);
  });

  it("竄改密文應拋出錯誤", () => {
    const encrypted = encryptApiKey("sensitive-key");
    // 竄改最後一個字元
    const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("0") ? "1" : "0");
    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it("格式不正確應拋出錯誤", () => {
    expect(() => decryptApiKey("invalid-format")).toThrow("加密資料格式無效");
    expect(() => decryptApiKey("a:b")).toThrow("加密資料格式無效");
  });

  it("空字串也能正常加解密", () => {
    const encrypted = encryptApiKey("");
    expect(decryptApiKey(encrypted)).toBe("");
  });

  it("中文字串也能正常加解密", () => {
    const plaintext = "測試金鑰-中文";
    const encrypted = encryptApiKey(plaintext);
    expect(decryptApiKey(encrypted)).toBe(plaintext);
  });

  it("缺少環境變數應拋出錯誤", () => {
    const saved = process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
    delete process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
    expect(() => encryptApiKey("test")).toThrow("FIELD_SETTINGS_ENCRYPTION_KEY");
    process.env.FIELD_SETTINGS_ENCRYPTION_KEY = saved;
  });

  it("金鑰長度不正確應拋出錯誤", () => {
    const saved = process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
    process.env.FIELD_SETTINGS_ENCRYPTION_KEY = "tooshort";
    expect(() => encryptApiKey("test")).toThrow("必須是 64 字元");
    process.env.FIELD_SETTINGS_ENCRYPTION_KEY = saved;
  });
});
