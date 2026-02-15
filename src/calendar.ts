import { google, calendar_v3 } from "googleapis";
import { loadConfig, getUserConfig } from "./config.js";

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date | null;
  endTime: Date | null;
  isAllDay: boolean;
  calendarName: string;
}

function getOAuth2Client() {
  const config = loadConfig();
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

export function getAuthUrl(userId: number): string {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state: String(userId),
    prompt: "consent",
  });
}

export async function exchangeCodeForTokens(
  code: string
): Promise<{ refreshToken: string }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Try revoking app access and re-authenticating.");
  }

  return { refreshToken: tokens.refresh_token };
}

async function getAuthenticatedClient(userId: number) {
  const userConfig = getUserConfig(userId);
  if (!userConfig?.googleRefreshToken) {
    throw new Error("User has not linked Google account");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: userConfig.googleRefreshToken,
  });

  return oauth2Client;
}

export async function listCalendars(
  userId: number
): Promise<{ id: string; name: string }[]> {
  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.calendarList.list();
  const items = response.data.items || [];

  return items.map((cal) => ({
    id: cal.id || "",
    name: cal.summary || "Unnamed Calendar",
  }));
}

export async function getEventsForDay(
  userId: number,
  date: Date
): Promise<CalendarEvent[]> {
  const userConfig = getUserConfig(userId);
  if (!userConfig) {
    throw new Error("User not found");
  }

  const auth = await getAuthenticatedClient(userId);
  const calendar = google.calendar({ version: "v3", auth });

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const allEvents: CalendarEvent[] = [];

  for (const calendarId of userConfig.calendars) {
    try {
      const response = await calendar.events.list({
        calendarId,
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
      });

      const calendarInfo = await calendar.calendars.get({ calendarId });
      const calendarName = calendarInfo.data.summary || calendarId;

      const events = response.data.items || [];

      for (const event of events) {
        const isAllDay = !!event.start?.date;

        allEvents.push({
          id: event.id || "",
          title: event.summary || "Untitled",
          startTime: event.start?.dateTime
            ? new Date(event.start.dateTime)
            : event.start?.date
              ? new Date(event.start.date)
              : null,
          endTime: event.end?.dateTime
            ? new Date(event.end.dateTime)
            : event.end?.date
              ? new Date(event.end.date)
              : null,
          isAllDay,
          calendarName,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
    }
  }

  // Sort: all-day events first, then by start time
  allEvents.sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    if (!a.startTime || !b.startTime) return 0;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  return allEvents;
}
