/**
 * One-off script: update existing events in the shared calendar
 * so that their title (summary) starts with the event type name
 * (e.g. "Кейс-интервью Boost: Иван Иванов") instead of generic
 * "Интервью: Иван Иванов".
 *
 * Matches existing calendar events to booked slots in Sheets by
 * start time + candidate_name. Updates only those whose summary
 * still uses the old "Интервью: ..." prefix.
 *
 * Usage:
 *   npx tsx scripts/update-calendar-titles.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SLOTS_SHEET = "Slots";
const EVENTS_SHEET = "Events";
const SHARED_CALENDAR_ID = process.env.GOOGLE_SHARED_CALENDAR_ID || "";

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

async function main() {
  if (!SHARED_CALENDAR_ID) {
    console.error("ERROR: GOOGLE_SHARED_CALENDAR_ID missing in .env.local");
    process.exit(1);
  }

  const sheets = google.sheets({ version: "v4", auth: getAuth() });
  const calendar = google.calendar({ version: "v3", auth: getAuth() });

  // 1. Load events for name lookup
  const eventsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A2:F`,
  });
  const events = (eventsRes.data.values || [])
    .filter((row) => row[0])
    .map((row) => ({ id: row[0], name: row[1] || "" }));

  // 2. Load future booked slots
  const slotsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:L`,
  });

  const now = Date.now();
  const slots = (slotsRes.data.values || [])
    .filter((row) => row[0] && row[6] === "booked")
    .map((row) => ({
      date: row[3] || "",
      time: row[4] || "",
      duration_minutes: parseInt(row[5] || "30", 10),
      candidate_name: row[7] || "",
      event_id: row[10] || "",
    }))
    .filter((s) => new Date(toMSKIso(s.date, s.time)).getTime() > now);

  console.log(`Checking ${slots.length} future booked slots\n`);

  let updated = 0;
  let skipped = 0;

  for (const slot of slots) {
    const event = events.find((e) => e.id === slot.event_id);
    if (!event?.name) {
      console.log(`SKIP   ${slot.date} ${slot.time} — ${slot.candidate_name}: no event type`);
      skipped++;
      continue;
    }

    const startIso = toMSKIso(slot.date, slot.time);
    const endIso = new Date(new Date(startIso).getTime() + slot.duration_minutes * 60000).toISOString();

    // Find matching event in shared calendar
    const listRes = await calendar.events.list({
      calendarId: SHARED_CALENDAR_ID,
      timeMin: startIso,
      timeMax: endIso,
      singleEvents: true,
      maxResults: 50,
    });

    const matches = (listRes.data.items || []).filter((ev) =>
      (ev.summary || "").includes(slot.candidate_name)
    );

    if (matches.length === 0) {
      console.log(`MISS   ${slot.date} ${slot.time} — ${slot.candidate_name}: no calendar event found`);
      skipped++;
      continue;
    }

    const newSummary = `${event.name}: ${slot.candidate_name}`;

    for (const match of matches) {
      if (match.summary === newSummary) {
        console.log(`OK     ${slot.date} ${slot.time} — ${slot.candidate_name}: already correct`);
        skipped++;
        continue;
      }

      try {
        await calendar.events.patch({
          calendarId: SHARED_CALENDAR_ID,
          eventId: match.id!,
          requestBody: { summary: newSummary },
        });
        console.log(`UPDATE ${slot.date} ${slot.time} — ${slot.candidate_name}: "${match.summary}" → "${newSummary}"`);
        updated++;
      } catch (err) {
        console.log(`FAIL   ${slot.date} ${slot.time} — ${slot.candidate_name}: ${(err as Error).message.slice(0, 100)}`);
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
