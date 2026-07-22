import { createHmac, timingSafeEqual } from "crypto";

export type GoogleOAuthState = { u: string; o: string; e: number };

export function signGoogleOAuthState(payload: GoogleOAuthState): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGoogleOAuthState(state: string): GoogleOAuthState | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
    if (!payload.u || !payload.o || !payload.e || payload.e < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
