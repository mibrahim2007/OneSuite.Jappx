import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { generateSecret, generateURI, verifySync } from "otplib";

// ─── AES-256-GCM Secret Encryption ───────────────────────────────────────────

export function encryptSecret(plaintext: string): string {
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // format: <iv-hex>:<auth-tag-hex>:<ciphertext-hex>
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY!, "hex");
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, authTagHex, encryptedHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── Recovery Codes ───────────────────────────────────────────────────────────

export function generateRecoveryCodes(): { raw: string[]; hashed: string[] } {
  const raw = Array.from({ length: 8 }, () => {
    const bytes = randomBytes(5).toString("hex"); // 10 hex chars
    return `${bytes.slice(0, 5)}-${bytes.slice(5)}`; // xxxxx-xxxxx
  });
  const hashed = raw.map((c) =>
    createHash("sha256").update(c).digest("hex")
  );
  return { raw, hashed };
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// ─── TOTP ─────────────────────────────────────────────────────────────────────

export function generateTotpSecret(): string {
  return generateSecret(); // returns base32-encoded secret
}

export function generateTotpUri(email: string, secret: string): string {
  return generateURI({ issuer: "OneSuite", label: email, secret });
}

export function verifyTotpCode(code: string, secret: string): boolean {
  const result = verifySync({ token: code, secret });
  return result.valid;
}

export function formatSecretForDisplay(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}
