// AES-256-GCM 加密工具 — 場域 API Key 加密存儲
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;      // GCM 建議 12 bytes
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

/** 取得加密金鑰（32 bytes hex） */
function getEncryptionKey(): Buffer {
  const key = process.env.FIELD_SETTINGS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "FIELD_SETTINGS_ENCRYPTION_KEY 環境變數未設定。" +
      "請執行 openssl rand -hex 32 產生金鑰並加入 .env",
    );
  }
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("FIELD_SETTINGS_ENCRYPTION_KEY 必須是 64 字元的 hex 字串（32 bytes）");
  }
  return buf;
}

/**
 * 加密 API Key
 * @returns 格式: `iv:authTag:ciphertext`（全部 hex 編碼）
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * 解密 API Key
 * @param ciphertext 格式: `iv:authTag:encrypted`（全部 hex）
 */
export function decryptApiKey(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("加密資料格式無效，預期 iv:authTag:encrypted");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = Buffer.from(parts[2], "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
