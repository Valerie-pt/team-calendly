import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

function getCalendar() {
  return google.calendar({ version: "v3", auth: getGoogleAuth() });
}

const SHARED_CALENDAR_ID = process.env.GOOGLE_SHARED_CALENDAR_ID || "";

export async function createCalendarEvent(params: {
  interviewer_email: string;
  interviewer_name: string;
  candidate_name: string;
  candidate_email: string;
  candidate_telegram: string;
  date: string;
  time: string;
  duration_minutes: number;
  zoom_link: string;
}) {
  const calendar = getCalendar();

  const startDateTime = toMSKIso(params.date, params.time);
  const endDateTime = new Date(new Date(startDateTime).getTime() + params.duration_minutes * 60000).toISOString();

  const description = [
    `Кандидат: ${params.candidate_name}`,
    `Email: ${params.candidate_email}`,
    params.candidate_telegram ? `Telegram: ${params.candidate_telegram}` : "",
    `Интервьюер: ${params.interviewer_name} (${params.interviewer_email})`,
    "",
    `Zoom: ${params.zoom_link}`,
  ].filter(Boolean).join("\n");

  const baseEvent = {
    summary: `Интервью: ${params.candidate_name}`,
    description,
    location: params.zoom_link,
    start: { dateTime: startDateTime, timeZone: "Europe/Moscow" },
    end: { dateTime: endDateTime, timeZone: "Europe/Moscow" },
    attendees: [
      { email: params.interviewer_email },
      { email: params.candidate_email },
    ],
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup" as const, minutes: 15 }],
    },
  };

  // 1. Create event in interviewer's personal calendar (requires that calendar shared with service account)
  try {
    await calendar.events.insert({
      calendarId: params.interviewer_email,
      requestBody: baseEvent,
      sendUpdates: "all",
    });
  } catch (error) {
    console.error("Failed to create event in interviewer calendar:", error);
  }

  // 2. Also create event in the shared "Zamesin Team" calendar so the whole team sees it.
  // We omit `attendees` here because service accounts without Domain-Wide
  // Delegation are not allowed to set attendees on calendar events — Google
  // rejects the whole insert otherwise. Names/emails are already in description.
  if (SHARED_CALENDAR_ID) {
    try {
      const { attendees: _attendees, ...sharedEvent } = baseEvent;
      await calendar.events.insert({
        calendarId: SHARED_CALENDAR_ID,
        requestBody: sharedEvent,
        sendUpdates: "none",
      });
    } catch (error) {
      console.error("Failed to create event in shared calendar:", error);
    }
  }

  return true;
}

function toMSKIso(date: string, time: string): string {
  return `${date}T${time}:00+03:00`;
}
