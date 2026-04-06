import { google } from "googleapis";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SHEET_NAME = "Slots";

export interface Slot {
  id: string;
  interviewer_name: string;
  interviewer_email: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: "available" | "booked";
  candidate_name: string;
  candidate_email: string;
  candidate_telegram: string;
}

export async function getSlots(): Promise<Slot[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:J`,
  });

  const rows = res.data.values || [];
  return rows.map((row) => ({
    id: row[0] || "",
    interviewer_name: row[1] || "",
    interviewer_email: row[2] || "",
    date: row[3] || "",
    time: row[4] || "",
    duration_minutes: parseInt(row[5] || "30", 10),
    status: (row[6] || "available") as "available" | "booked",
    candidate_name: row[7] || "",
    candidate_email: row[8] || "",
    candidate_telegram: row[9] || "",
  }));
}

export async function addSlot(slot: Omit<Slot, "id" | "status" | "candidate_name" | "candidate_email" | "candidate_telegram">) {
  const sheets = getSheets();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:J`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id,
        slot.interviewer_name,
        slot.interviewer_email,
        slot.date,
        slot.time,
        slot.duration_minutes,
        "available",
        "",
        "",
        "",
      ]],
    },
  });

  return id;
}

export async function bookSlot(slotId: string, candidateName: string, candidateEmail: string, candidateTelegram: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:J`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === slotId);

  if (rowIndex === -1) return false;

  const row = rows[rowIndex];
  if (row[6] === "booked") return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!G${sheetRow}:J${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["booked", candidateName, candidateEmail, candidateTelegram]],
    },
  });

  return true;
}

export async function deleteSlot(slotId: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:I`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === slotId);

  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${sheetRow}:J${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["", "", "", "", "", "", "", "", "", ""]],
    },
  });

  return true;
}
