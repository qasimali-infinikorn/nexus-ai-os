import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { meetings, userOauthConnections, type Meeting } from "@/lib/db/schema";

const MS_AUTH = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const MS_CALENDAR_VIEW = "https://graph.microsoft.com/v1.0/me/calendarView";
const SCOPES = ["offline_access", "Calendars.Read", "openid", "email", "profile"].join(" ");

export function microsoftCalendarConfigured(): boolean {
  return Boolean(process.env.MICROSOFT_CLIENT_ID?.trim() && process.env.MICROSOFT_CLIENT_SECRET?.trim());
}

export function getMicrosoftCalendarRedirectUri(origin: string): string {
  return (
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI?.trim() ||
    `${origin.replace(/\/$/, "")}/api/integrations/microsoft-calendar/callback`
  );
}

export function buildMicrosoftCalendarAuthUrl(params: {
  origin: string;
  state: string;
}): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID!.trim();
  const redirectUri = getMicrosoftCalendarRedirectUri(params.origin);
  const url = new URL(MS_AUTH);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  origin: string;
}): Promise<{ refreshToken: string; accessToken: string; email?: string }> {
  const clientId = process.env.MICROSOFT_CLIENT_ID!.trim();
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET!.trim();
  const redirectUri = getMicrosoftCalendarRedirectUri(params.origin);

  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: SCOPES
  });

  const res = await fetch(MS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft token exchange failed: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };
  if (!json.refresh_token || !json.access_token) {
    throw new Error("Microsoft did not return a refresh token. Try disconnecting and reconnecting.");
  }

  let email: string | undefined;
  if (json.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(json.id_token.split(".")[1] ?? "", "base64url").toString("utf8")
      ) as { email?: string; preferred_username?: string };
      email = payload.email ?? payload.preferred_username;
    } catch {
      // ignore
    }
  }

  return { refreshToken: json.refresh_token, accessToken: json.access_token, email };
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!.trim(),
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!.trim(),
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: SCOPES
  });
  const res = await fetch(MS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) {
    throw new Error("Failed to refresh Microsoft access token.");
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access token in refresh response.");
  return json.access_token;
}

export async function upsertMicrosoftCalendarConnection(params: {
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
      provider: "microsoft_calendar",
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

export async function getMicrosoftCalendarConnection(userId: string, organizationId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userOauthConnections)
    .where(
      and(
        eq(userOauthConnections.userId, userId),
        eq(userOauthConnections.organizationId, organizationId),
        eq(userOauthConnections.provider, "microsoft_calendar")
      )
    )
    .limit(1);
  return row;
}

export async function deleteMicrosoftCalendarConnection(userId: string, organizationId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(userOauthConnections)
    .where(
      and(
        eq(userOauthConnections.userId, userId),
        eq(userOauthConnections.organizationId, organizationId),
        eq(userOauthConnections.provider, "microsoft_calendar")
      )
    );
}

export async function syncMicrosoftCalendarMeetings(params: {
  userId: string;
  organizationId: string;
}): Promise<{ upserted: number }> {
  const conn = await getMicrosoftCalendarConnection(params.userId, params.organizationId);
  if (!conn) throw new Error("Microsoft Calendar is not connected.");

  const refreshToken = decryptSecret(conn.encryptedRefreshToken);
  const accessToken = await refreshAccessToken(refreshToken);

  const timeMin = new Date();
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + 14);

  const url = new URL(MS_CALENDAR_VIEW);
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set("$top", "50");
  url.searchParams.set("$orderby", "start/dateTime");
  url.searchParams.set(
    "$select",
    "id,subject,location,attendees,start,end,isOnlineMeeting,onlineMeeting,webLink"
  );

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"'
    }
  });
  if (!res.ok) {
    throw new Error(`Calendar fetch failed (${res.status}).`);
  }

  const json = (await res.json()) as {
    value?: {
      id?: string;
      subject?: string;
      location?: { displayName?: string };
      onlineMeeting?: { joinUrl?: string };
      webLink?: string;
      attendees?: { emailAddress?: { name?: string; address?: string } }[];
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }[];
  };

  const db = getDb();
  let upserted = 0;
  for (const item of json.value ?? []) {
    if (!item.id || !item.start) continue;
    const startRaw = item.start.dateTime ?? item.start.date;
    if (!startRaw) continue;
    // Graph returns local-naive timestamps when Prefer timezone is set; append Z if missing.
    const startsAt = new Date(startRaw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(startRaw) ? startRaw : `${startRaw}Z`);
    const endRaw = item.end?.dateTime ?? item.end?.date;
    const endsAt = endRaw
      ? new Date(endRaw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(endRaw) ? endRaw : `${endRaw}Z`)
      : null;
    const attendees = (item.attendees ?? [])
      .map((a) => a.emailAddress?.name || a.emailAddress?.address || "")
      .filter(Boolean)
      .slice(0, 20);
    const title = item.subject?.trim() || "(No title)";
    const location =
      item.location?.displayName || item.onlineMeeting?.joinUrl || item.webLink || undefined;
    const externalId = `ms:${item.id}`;

    const [existing] = await db
      .select()
      .from(meetings)
      .where(and(eq(meetings.organizationId, params.organizationId), eq(meetings.externalId, externalId)))
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
          source: "microsoft",
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
        source: "microsoft",
        externalId,
        kind: "external"
      });
    }
    upserted += 1;
  }

  return { upserted };
}

export type { Meeting };
