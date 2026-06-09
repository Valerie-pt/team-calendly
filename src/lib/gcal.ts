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
  event_name?: string;
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

  const summary = params.event_name
    ? `${params.event_name}: ${params.candidate_name}`
    : `Интервью: ${params.candidate_name}`;

  const baseEvent = {
    summary,
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

/**
 * Best-effort deletion of the calendar event(s) created for a booking.
 *
 * - Removes the event from the shared "Zamesin Team" calendar (if configured)
 *   by listing events at that time and matching by candidate name in the
 *   summary.
 * - Also attempts to remove it from the interviewer's personal calendar
 *   (will silently fail if the interviewer hasn't shared their calendar
 *   with the service account).
 *
 * All deletes use sendUpdates="none" so no email notifications are sent.
 */
export async function deleteCalendarEvent(params: {
  interviewer_email: string;
  candidate_name: string;
  date: string;
  time: string;
  duration_minutes: number;
}) {
  const calendar = getCalendar();
  const startIso = toMSKIso(params.date, params.time);
  const endIso = new Date(new Date(startIso).getTime() + params.duration_minutes * 60000).toISOString();

  async function deleteFromCalendar(calendarId: string) {
    try {
      const list = await calendar.events.list({
        calendarId,
        timeMin: startIso,
        timeMax: endIso,
        singleEvents: true,
        maxResults: 25,
      });
      const matches = (list.data.items || []).filter((ev) =>
        (ev.summary || "").includes(params.candidate_name)
      );
      for (const ev of matches) {
        if (!ev.id) continue;
        try {
          await calendar.events.delete({
            calendarId,
            eventId: ev.id,
            sendUpdates: "none",
          });
        } catch (err) {
          console.warn(`Failed to delete event ${ev.id} from ${calendarId}:`, (err as Error).message);
        }
      }
    } catch (err) {
      // Listing itself failed (no access, calendar missing, etc.)
      console.warn(`Could not list events in ${calendarId}:`, (err as Error).message);
    }
  }

  if (SHARED_CALENDAR_ID) {
    await deleteFromCalendar(SHARED_CALENDAR_ID);
  }
  if (params.interviewer_email) {
    await deleteFromCalendar(params.interviewer_email);
  }
}
