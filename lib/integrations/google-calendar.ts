import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { meetings, userOauthConnections, type Meeting } from "@/lib/db/schema";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "openid", "email"].join(" ");

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getGoogleCalendarRedirectUri(origin: string): string {
  return (
    process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim() ||
    `${origin.replace(/\/$/, "")}/api/integrations/google-calendar/callback`
  );
}

export function buildGoogleCalendarAuthUrl(params: {
  origin: string;
  state: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const redirectUri = getGoogleCalendarRedirectUri(params.origin);
  const url = new URL(GOOGLE_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeGoogleCode(params: {
  code: string;
  origin: string;
}): Promise<{ refreshToken: string; accessToken: string; email?: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();
  const redirectUri = getGoogleCalendarRedirectUri(params.origin);

  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };
  if (!json.refresh_token || !json.access_token) {
    throw new Error("Google did not return a refresh token. Try disconnecting and reconnecting.");
  }

  let email: string | undefined;
  if (json.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(json.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as {
        email?: string;
      };
      email = payload.email;
    } catch {
      // ignore
    }
  }

  return { refreshToken: json.refresh_token, accessToken: json.access_token, email };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    throw new Error("Failed to refresh Google access token.");
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access token in refresh response.");
  return json.access_token;
}

export async function upsertGoogleCalendarConnection(params: {
  userId: string;
  organizationId: string;
  refreshToken: string;
  accountEmail?: string;
}): Promise<void> {
  const db = getDb();
  const encryptedRefreshToken = encryptSecret(params.refreshToken);
  await db
    .insert(userOauthConnections)
    .values({
      userId: params.userId,
      organizationId: params.organizationId,
      provider: "google_calendar",
      accountEmail: params.accountEmail,
      encryptedRefreshToken,
      scopes: SCOPES,
      updatedAt: new Date()
    })
    .onConflictDoUpdate({
      target: [
        userOauthConnections.userId,
        userOauthConnections.organizationId,
        userOauthConnections.provider
      ],
      set: {
        encryptedRefreshToken,
        accountEmail: params.accountEmail,
        scopes: SCOPES,
        updatedAt: new Date()
      }
    });
}

export async function getGoogleCalendarConnection(userId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userOauthConnections)
    .where(
      and(
        eq(userOauthConnections.userId, userId),
        eq(userOauthConnections.organizationId, organizationId),
        eq(userOauthConnections.provider, "google_calendar")
      )
    )
    .limit(1);
  return row;
}

export async function deleteGoogleCalendarConnection(userId: string, organizationId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(userOauthConnections)
    .where(
      and(
        eq(userOauthConnections.userId, userId),
        eq(userOauthConnections.organizationId, organizationId),
        eq(userOauthConnections.provider, "google_calendar")
      )
    );
}

export async function syncGoogleCalendarMeetings(params: {
  userId: string;
  organizationId: string;
}): Promise<{ upserted: number }> {
  const conn = await getGoogleCalendarConnection(params.userId, params.organizationId);
  if (!conn) throw new Error("Google Calendar is not connected.");

  const refreshToken = decryptSecret(conn.encryptedRefreshToken);
  const accessToken = await refreshAccessToken(refreshToken);

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + 14);

  const url = new URL(GOOGLE_EVENTS);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed (${res.status}).`);
  }

  const json = (await res.json()) as {
    items?: {
      id?: string;
      summary?: string;
      location?: string;
      hangoutLink?: string;
      attendees?: { email?: string; displayName?: string }[];
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };

  const db = getDb();
  let upserted = 0;
  for (const item of json.items ?? []) {
    if (!item.id || !item.start) continue;
    const startRaw = item.start.dateTime ?? item.start.date;
    if (!startRaw) continue;
    const startsAt = new Date(startRaw);
    const endRaw = item.end?.dateTime ?? item.end?.date;
    const endsAt = endRaw ? new Date(endRaw) : null;
    const attendees = (item.attendees ?? [])
      .map((a) => a.displayName || a.email || "")
      .filter(Boolean)
      .slice(0, 20);
    const title = item.summary?.trim() || "(No title)";
    const location = item.location || item.hangoutLink || undefined;

    const [existing] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, params.organizationId), eq(meetings.externalId, item.id)))
      .limit(1);

    if (existing) {
      await db
        .update(meetings)
        .set({
          title,
          startsAt,
          endsAt,
          location,
          attendees,
          source: "google",
          updatedAt: new Date()
        })
        .where(eq(meetings.id, existing.id));
    } else {
      await db.insert(meetings).values({
        organizationId: params.organizationId,
        title,
        startsAt,
        endsAt,
        location,
        attendees,
        needsPrep: true,
        source: "google",
        externalId: item.id,
        kind: "external"
      });
    }
    upserted += 1;
  }

  return { upserted };
}

export type { Meeting };
