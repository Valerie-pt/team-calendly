/**
 * One-off script to bulk-add slots to a specific event in Google Sheets.
 *
 * Usage:
 *   pnpm tsx scripts/bulk-add-slots.ts
 *
 * Reads .env.local automatically.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

// ----- CONFIG -----

const EVENT_SLUG = "case-boost";
const INTERVIEWER_NAME = "Лада";
const INTERVIEWER_EMAIL = "abrakadabrainri@gmail.com";
const DURATION_MINUTES = 30;

// All times in MSK
const SLOTS: { date: string; times: string[] }[] = [
  { date: "2026-05-05", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"] },
  { date: "2026-05-06", times: ["10:00", "10:30", "11:00", "13:30", "14:30"] },
  { date: "2026-05-07", times: ["10:00", "10:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30"] },
  { date: "2026-05-08", times: ["10:00", "10:30", "11:00", "13:00", "14:00", "14:30", "15:00"] },
  { date: "2026-05-11", times: ["15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-12", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-13", times: ["10:00", "10:30", "13:00", "13:30", "14:00", "14:30"] },
  { date: "2026-05-14", times: ["10:00", "10:30", "13:30", "14:00", "15:00", "15:30", "16:00"] },
  { date: "2026-05-15", times: ["10:00", "10:30", "11:00", "13:00", "14:00", "14:30", "15:00", "15:30"] },
  { date: "2026-05-18", times: ["15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-19", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-20", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30"] },
  { date: "2026-05-21", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30", "15:30", "16:00"] },
  { date: "2026-05-22", times: ["10:00", "10:30", "11:00", "13:00", "14:00", "14:30", "15:00", "15:30"] },
  { date: "2026-05-25", times: ["15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-26", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-27", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30"] },
  { date: "2026-05-28", times: ["10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"] },
  { date: "2026-05-29", times: ["10:00", "10:30", "11:00", "13:00", "14:00", "14:30", "15:00", "15:30"] },
];

// ----- IMPL -----

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SLOTS_SHEET = "Slots";
const EVENTS_SHEET = "Events";

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  return google.sheets({ version: "v4", auth });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function main() {
  if (!SPREADSHEET_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    console.error("ERROR: missing GOOGLE_SHEET_ID / GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  const sheets = getSheets();

  // 1. Find the event by slug
  const eventsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A2:F`,
  });
  const eventRows = eventsRes.data.values || [];
  const eventRow = eventRows.find((row) => row[2] === EVENT_SLUG);
  if (!eventRow) {
    console.error(`ERROR: event with slug "${EVENT_SLUG}" not found`);
    process.exit(1);
  }
  const eventId = eventRow[0];
  console.log(`Found event "${eventRow[1]}" with id ${eventId}`);

  // 2. Read existing slots to avoid duplicates
  const slotsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:K`,
  });
  const existing = slotsRes.data.values || [];
  const existingKeys = new Set(
    existing
      .filter((row) => row[0])
      .map((row) => `${row[3]}|${row[4]}`) // date|time
  );

  // 3. Build rows to append
  const newRows: string[][] = [];
  let skipped = 0;
  for (const day of SLOTS) {
    for (const time of day.times) {
      const key = `${day.date}|${time}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      newRows.push([
        genId(),
        INTERVIEWER_NAME,
        INTERVIEWER_EMAIL,
        day.date,
        time,
        String(DURATION_MINUTES),
        "available",
        "", // candidate_name
        "", // candidate_email
        "", // candidate_telegram
        eventId,
      ]);
    }
  }

  if (newRows.length === 0) {
    console.log(`Nothing to add. Skipped ${skipped} duplicates.`);
    return;
  }

  console.log(`Adding ${newRows.length} new slots (skipped ${skipped} duplicates)...`);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A:K`,
    valueInputOption: "RAW",
    requestBody: { values: newRows },
  });

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
