/**
 * Archive past booked slots into a separate "SlotsArchive" sheet, then
 * clear them from the main "Slots" sheet.
 *
 * BEFORE FIRST RUN: create a sheet named "SlotsArchive" with the same
 * header row as Slots:
 *   id | interviewer_name | interviewer_email | date | time |
 *   duration_minutes | status | candidate_name | candidate_email |
 *   candidate_telegram | event_id | zoom_link | archived_at
 *
 * Note the extra "archived_at" column (M) for traceability.
 *
 * Default behavior:
 *   - Considers slots with status="booked" whose end time was at least
 *     DAYS_THRESHOLD days ago.
 *   - Moves them to SlotsArchive.
 *   - Clears the source rows (leaves empty rows; same as deleteSlot).
 *
 * Tweak DAYS_THRESHOLD if you want to keep history longer.
 *
 * Usage:
 *   npx tsx scripts/archive-past-slots.ts             (default: 30 days)
 *   npx tsx scripts/archive-past-slots.ts 60          (custom threshold)
 *   npx tsx scripts/archive-past-slots.ts 30 --dry-run
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SLOTS_SHEET = "Slots";
const ARCHIVE_SHEET = "SlotsArchive";

const args = process.argv.slice(2);
const DAYS_THRESHOLD = parseInt(args.find((a) => /^\d+$/.test(a)) || "30", 10);
const DRY_RUN = args.includes("--dry-run");

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

function toMSKDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+03:00`);
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error("ERROR: GOOGLE_SHEET_ID missing");
    process.exit(1);
  }

  console.log(`Threshold: archive booked slots whose end was >= ${DAYS_THRESHOLD} days ago${DRY_RUN ? " (DRY RUN)" : ""}`);

  const sheets = getSheets();

  // Read all current slots with row numbers
  const slotsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:L`,
  });
  const rows = slotsRes.data.values || [];

  // Confirm archive sheet exists by attempting a small read
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ARCHIVE_SHEET}!A1`,
    });
  } catch {
    console.error(`ERROR: sheet "${ARCHIVE_SHEET}" not found. Create it with the same headers as Slots, plus column M = "archived_at".`);
    process.exit(1);
  }

  const cutoff = Date.now() - DAYS_THRESHOLD * 24 * 60 * 60 * 1000;
  const archivedAt = new Date().toISOString();

  type Hit = { sheetRow: number; row: string[] };
  const hits: Hit[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue; // empty / cleared row
    if (row[6] !== "booked") continue;
    const date = row[3];
    const time = row[4];
    const duration = parseInt(row[5] || "30", 10);
    if (!date || !time) continue;
    const endMs = toMSKDate(date, time).getTime() + duration * 60_000;
    if (endMs >= cutoff) continue;
    hits.push({ sheetRow: i + 2, row });
  }

  console.log(`Found ${hits.length} booked slot(s) older than the threshold.`);

  if (hits.length === 0 || DRY_RUN) {
    if (DRY_RUN) {
      for (const h of hits.slice(0, 20)) {
        console.log(`  would archive row ${h.sheetRow}: ${h.row[3]} ${h.row[4]} — ${h.row[7] || "(no candidate)"}`);
      }
      if (hits.length > 20) console.log(`  ... (+${hits.length - 20} more)`);
    }
    return;
  }

  // Find current size of archive sheet (to know the next free row)
  const archiveRead = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${ARCHIVE_SHEET}!A:A`,
  });
  let nextArchiveRow = (archiveRead.data.values || []).length + 1;

  // Write all hits into archive sheet, one batched update per row to be
  // simple and safe (we could batchUpdate; the row volume here is low).
  for (const h of hits) {
    const archiveRow = [...h.row.slice(0, 12), archivedAt];
    // Pad to 13 cells (A..M)
    while (archiveRow.length < 13) archiveRow.push("");
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ARCHIVE_SHEET}!A${nextArchiveRow}:M${nextArchiveRow}`,
      valueInputOption: "RAW",
      requestBody: { values: [archiveRow] },
    });
    nextArchiveRow++;
  }

  // Clear source rows
  const clears = hits.map((h) => ({
    range: `${SLOTS_SHEET}!A${h.sheetRow}:L${h.sheetRow}`,
    values: [["", "", "", "", "", "", "", "", "", "", "", ""]],
  }));
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: "RAW",
      data: clears,
    },
  });

  console.log(`Archived ${hits.length} slot(s) and cleared them from Slots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
