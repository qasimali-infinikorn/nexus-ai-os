import { randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// AES-256-GCM encryption for org provider keys at rest (lib/db/schema.ts's
// orgProviderKeys.encryptedKey). ENCRYPTION_KEY is a server-only secret —
// see docs/AUTH.md for generation instructions.
//
// Ciphertext format: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` and set it in your environment — see docs/AUTH.md."
    );
  }
  // Derive a 32-byte key regardless of the raw secret's length/encoding.
  return scryptSync(secret, "nexus-org-provider-keys", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error("Malformed encrypted value.");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}

// Constant-time comparison for tokens (invitation acceptance, etc.) to
// avoid timing side-channels on lookups that fall back to string equality.
export function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}
