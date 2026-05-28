/**
 * One-off script to retroactively create Google Calendar events
 * for booked slots whose calendar entry was missed (e.g. due to
 * Calendar API being temporarily disabled).
 *
 * Usage:
 *   npx tsx scripts/backfill-calendar-events.ts
 *
 * For each future "booked" slot in the Slots sheet:
 *   - Checks the shared calendar for an existing event at that
 *     exact start time with "Интервью" in the summary.
 *   - If absent, creates the event in:
 *       (a) interviewer's personal calendar  (sendUpdates=all → invites attendees)
 *       (b) the shared "Zamesin Team" calendar (sendUpdates=none)
 *
 * Reads .env.local for credentials.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SLOTS_SHEET = "Slots";
const EVENTS_SHEET = "Events";
const SHARED_CALENDAR_ID = process.env.GOOGLE_SHARED_CALENDAR_ID || "";
const DEFAULT_ZOOM = process.env.NEXT_PUBLIC_ZOOM_LINK || "";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/calendar",
    ],
  });
}

function toMSKIso(date: string, time: string): string {
  return `${date}T${time}:00+03:00`;
}

async function eventExistsInSharedCalendar(
  calendar: ReturnType<typeof google.calendar>,
  startIso: string,
  endIso: string,
  candidateName: string
): Promise<boolean> {
  if (!SHARED_CALENDAR_ID) return false;
  try {
    const res = await calendar.events.list({
      calendarId: SHARED_CALENDAR_ID,
      timeMin: startIso,
      timeMax: endIso,
      singleEvents: true,
      maxResults: 50,
    });
    return (res.data.items || []).some((ev) =>
      (ev.summary || "").includes("Интервью") &&
      (ev.summary || "").includes(candidateName)
    );
  } catch (err) {
    console.warn("  (could not query shared calendar):", (err as Error).message);
    return false;
  }
}

async function main() {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("ERROR: missing env vars in .env.local");
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const calendar = google.calendar({ version: "v3", auth: getAuth() });

  // 1. Read events (for zoom_link / notification mapping per event)
  const eventsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A2:F`,
  });
  const events = (eventsRes.data.values || [])
    .filter((row) => row[0])
    .map((row) => ({
      id: row[0] || "",
      name: row[1] || "",
      slug: row[2] || "",
      zoom_link: row[3] || "",
    }));

  // 2. Read all slots
  const slotsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:L`,
  });

  const now = Date.now();
  const slots = (slotsRes.data.values || [])
    .filter((row) => row[0] && row[6] === "booked")
    .map((row) => ({
      id: row[0] || "",
      interviewer_name: row[1] || "",
      interviewer_email: row[2] || "",
      date: row[3] || "",
      time: row[4] || "",
      duration_minutes: parseInt(row[5] || "30", 10),
      candidate_name: row[7] || "",
      candidate_email: row[8] || "",
      candidate_telegram: row[9] || "",
      event_id: row[10] || "",
      zoom_link: row[11] || "",
    }))
    .filter((s) => new Date(toMSKIso(s.date, s.time)).getTime() > now);

  console.log(`Found ${slots.length} future booked slots\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const slot of slots) {
    const event = events.find((e) => e.id === slot.event_id);
    const zoomLink = slot.zoom_link || event?.zoom_link || DEFAULT_ZOOM;

    const startIso = toMSKIso(slot.date, slot.time);
    const endIso = new Date(new Date(startIso).getTime() + slot.duration_minutes * 60000).toISOString();

    const label = `${slot.date} ${slot.time} — ${slot.candidate_name} (с ${slot.interviewer_name})`;

    // Check if event already exists in shared calendar at that time
    const exists = await eventExistsInSharedCalendar(calendar, startIso, endIso, slot.candidate_name);
    if (exists) {
      console.log(`SKIP   ${label} — already in shared calendar`);
      skipped++;
      continue;
    }

    const description = [
      `Кандидат: ${slot.candidate_name}`,
      `Email: ${slot.candidate_email}`,
      slot.candidate_telegram ? `Telegram: ${slot.candidate_telegram}` : "",
      `Интервьюер: ${slot.interviewer_name} (${slot.interviewer_email})`,
      "",
      `Zoom: ${zoomLink}`,
    ].filter(Boolean).join("\n");

    const baseEvent = {
      summary: `Интервью: ${slot.candidate_name}`,
      description,
      location: zoomLink,
      start: { dateTime: startIso, timeZone: "Europe/Moscow" },
      end: { dateTime: endIso, timeZone: "Europe/Moscow" },
      attendees: [
        { email: slot.interviewer_email },
        { email: slot.candidate_email },
      ],
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup" as const, minutes: 15 }],
      },
    };

    // Create in interviewer's personal calendar (with invites)
    try {
      await calendar.events.insert({
        calendarId: slot.interviewer_email,
        requestBody: baseEvent,
        sendUpdates: "all",
      });
    } catch (err) {
      console.log(`PERSONAL FAILED  ${label}: ${(err as Error).message.slice(0, 100)}`);
      // Continue to shared calendar anyway
    }

    // Create in shared calendar — omit attendees (service account restriction)
    if (SHARED_CALENDAR_ID) {
      try {
        const { attendees: _attendees, ...sharedEvent } = baseEvent;
        await calendar.events.insert({
          calendarId: SHARED_CALENDAR_ID,
          requestBody: sharedEvent,
          sendUpdates: "none",
        });
        console.log(`OK     ${label}`);
        created++;
      } catch (err) {
        console.log(`SHARED FAILED    ${label}: ${(err as Error).message.slice(0, 100)}`);
        failed++;
      }
    } else {
      console.log(`OK     ${label} (no shared calendar configured)`);
      created++;
    }
  }

  console.log(`\nDone. Created: ${created}, skipped (already exists): ${skipped}, failed: ${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
