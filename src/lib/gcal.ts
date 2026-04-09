import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

function getCalendar() {
  return google.calendar({ version: "v3", auth: getGoogleAuth() });
}

const ZOOM_LINK = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

export async function createCalendarEvent(params: {
  interviewer_email: string;
  interviewer_name: string;
  candidate_name: string;
  candidate_email: string;
  candidate_telegram: string;
  date: string;
  time: string;
  duration_minutes: number;
}) {
  const calendar = getCalendar();

  const startDateTime = toMSKIso(params.date, params.time);
  const endDateTime = new Date(new Date(startDateTime).getTime() + params.duration_minutes * 60000).toISOString();

  const description = [
    `Кандидат: ${params.candidate_name}`,
    `Email: ${params.candidate_email}`,
    params.candidate_telegram ? `Telegram: ${params.candidate_telegram}` : "",
    "",
    `Zoom: ${ZOOM_LINK}`,
  ].filter(Boolean).join("\n");

  try {
    await calendar.events.insert({
      calendarId: params.interviewer_email,
      requestBody: {
        summary: `Интервью: ${params.candidate_name}`,
        description,
        location: ZOOM_LINK,
        start: {
          dateTime: startDateTime,
          timeZone: "Europe/Moscow",
        },
        end: {
          dateTime: endDateTime,
          timeZone: "Europe/Moscow",
        },
        attendees: [
          { email: params.interviewer_email },
          { email: params.candidate_email },
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 15 },
          ],
        },
      },
      sendUpdates: "all",
    });
    return true;
  } catch (error) {
    console.error("Failed to create calendar event:", error);
    return false;
  }
}

function toMSKIso(date: string, time: string): string {
  return `${date}T${time}:00+03:00`;
}
