/**
 * Seed the initial Zoom accounts into the ZoomAccounts sheet.
 *
 * BEFORE RUNNING: create a new sheet in the Google Spreadsheet named
 *   "ZoomAccounts"
 * with these headers in row 1:
 *   id | email | zoom_link | notes | created_at
 *
 * Usage:
 *   npx tsx scripts/seed-zoom-accounts.ts
 *
 * Re-running is safe — accounts that are already in the sheet (matched by
 * email) are skipped.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SHEET = "ZoomAccounts";

const ACCOUNTS = [
  {
    email: "curator@zamesin.ru",
    zoom_link: "https://us06web.zoom.us/j/4728389093?pwd=TC5SxKBhyTXexIz7RqbBbvEcT9bH2T.1",
    notes: "Ключ организатора: 615274",
  },
  {
    email: "support@zamesin.ru",
    zoom_link: "https://us06web.zoom.us/j/7151343939",
    notes: "Ключ организатора: 615274",
  },
  {
    email: "assistant@zamesin.ru",
    zoom_link: "https://us06web.zoom.us/j/4313441209",
    notes: "Ключ организатора: 615274",
  },
];

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

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

async function main() {
  if (!SPREADSHEET_ID) {
    console.error("ERROR: GOOGLE_SHEET_ID missing");
    process.exit(1);
  }
  const sheets = getSheets();

  // Read existing accounts
  let existing: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A2:E`,
    });
    existing = res.data.values || [];
  } catch {
    console.error(`ERROR: could not read sheet "${SHEET}". Did you create it with headers id|email|zoom_link|notes|created_at?`);
    process.exit(1);
  }

  const existingEmails = new Set(existing.filter((r) => r[0]).map((r) => r[1]?.toLowerCase()));

  const rowCount = existing.length;
  let addedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < ACCOUNTS.length; i++) {
    const acc = ACCOUNTS[i];
    if (existingEmails.has(acc.email.toLowerCase())) {
      console.log(`SKIP ${acc.email} (already seeded)`);
      skippedCount++;
      continue;
    }
    const newRow = rowCount + addedCount + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A${newRow}:E${newRow}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[genId(), acc.email, acc.zoom_link, acc.notes, new Date().toISOString()]],
      },
    });
    console.log(`ADD  ${acc.email}`);
    addedCount++;
  }

  console.log(`\nDone. Added ${addedCount}, skipped ${skippedCount}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
