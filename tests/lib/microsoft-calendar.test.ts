import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  microsoftCalendarConfigured,
  getMicrosoftCalendarRedirectUri,
  buildMicrosoftCalendarAuthUrl
} from "@/lib/integrations/microsoft-calendar";

describe("Microsoft Calendar helpers", () => {
  beforeEach(() => {
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.MICROSOFT_CALENDAR_REDIRECT_URI;
  });

  afterEach(() => {
    delete process.env.MICROSOFT_CLIENT_ID;
    delete process.env.MICROSOFT_CLIENT_SECRET;
    delete process.env.MICROSOFT_CALENDAR_REDIRECT_URI;
  });

  it("reports configured only when both client id and secret are set", () => {
    expect(microsoftCalendarConfigured()).toBe(false);
    process.env.MICROSOFT_CLIENT_ID = "id";
    expect(microsoftCalendarConfigured()).toBe(false);
    process.env.MICROSOFT_CLIENT_SECRET = "secret";
    expect(microsoftCalendarConfigured()).toBe(true);
  });

  it("builds authorize URL with calendar scopes and redirect", () => {
    process.env.MICROSOFT_CLIENT_ID = "app-id";
    process.env.MICROSOFT_CLIENT_SECRET = "secret";
    const url = new URL(
      buildMicrosoftCalendarAuthUrl({ origin: "http://localhost:3000", state: "abc.def" })
    );
    expect(url.origin).toBe("https://login.microsoftonline.com");
    expect(url.searchParams.get("client_id")).toBe("app-id");
    expect(url.searchParams.get("state")).toBe("abc.def");
    expect(url.searchParams.get("scope")).toContain("Calendars.Read");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3000/api/integrations/microsoft-calendar/callback"
    );
    expect(getMicrosoftCalendarRedirectUri("https://app.example")).toBe(
      "https://app.example/api/integrations/microsoft-calendar/callback"
    );
  });
});
