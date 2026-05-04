import { google } from "googleapis";
import { getGoogleAuth } from "./google-auth";

function getSheets() {
  return google.sheets({ version: "v4", auth: getGoogleAuth() });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
const SLOTS_SHEET = "Slots";
const EVENTS_SHEET = "Events";
const BLOCKS_SHEET = "Blocks";

// ----- Types -----

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
  event_id: string;
}

export interface Event {
  id: string;
  name: string;
  slug: string;
  zoom_link: string;
  created_at: string;
  notification_emails: string[];
}

export interface Block {
  id: string;
  date: string;
  time: string;
  duration_minutes: number;
  recurring: boolean;
  label: string;
  created_at: string;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ----- Slots -----

export async function getSlots(): Promise<Slot[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:K`,
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
    event_id: row[10] || "",
  }));
}

export async function addSlot(slot: Omit<Slot, "id" | "status" | "candidate_name" | "candidate_email" | "candidate_telegram">) {
  const sheets = getSheets();
  const id = genId();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A:K`,
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
        slot.event_id,
      ]],
    },
  });

  return id;
}

export async function bookSlot(slotId: string, candidateName: string, candidateEmail: string, candidateTelegram: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A2:K`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === slotId);

  if (rowIndex === -1) return false;

  const row = rows[rowIndex];
  if (row[6] === "booked") return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!G${sheetRow}:J${sheetRow}`,
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
    range: `${SLOTS_SHEET}!A2:K`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === slotId);

  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SLOTS_SHEET}!A${sheetRow}:K${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["", "", "", "", "", "", "", "", "", "", ""]],
    },
  });

  return true;
}

// ----- Events -----

export async function getEvents(): Promise<Event[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${EVENTS_SHEET}!A2:F`,
    });
    const rows = res.data.values || [];
    return rows
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0] || "",
        name: row[1] || "",
        slug: row[2] || "",
        zoom_link: row[3] || "",
        created_at: row[4] || "",
        notification_emails: (row[5] || "")
          .split(",")
          .map((e: string) => e.trim())
          .filter(Boolean),
      }));
  } catch (error) {
    console.error("Failed to read Events sheet:", error);
    return [];
  }
}

export async function addEvent(event: Omit<Event, "id" | "created_at">): Promise<string> {
  const sheets = getSheets();
  const id = genId();
  const created_at = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A:F`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id,
        event.name,
        event.slug,
        event.zoom_link,
        created_at,
        event.notification_emails.join(","),
      ]],
    },
  });

  return id;
}

export async function updateEventNotificationEmails(eventId: string, emails: string[]): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A2:F`,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === eventId);
  if (rowIndex === -1) return false;
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!F${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[emails.join(",")]],
    },
  });
  return true;
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A2:F`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === eventId);
  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${EVENTS_SHEET}!A${sheetRow}:F${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["", "", "", "", "", ""]],
    },
  });
  return true;
}

// ----- Blocks -----

export async function getBlocks(): Promise<Block[]> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BLOCKS_SHEET}!A2:G`,
    });
    const rows = res.data.values || [];
    return rows
      .filter((row) => row[0])
      .map((row) => ({
        id: row[0] || "",
        date: row[1] || "",
        time: row[2] || "",
        duration_minutes: parseInt(row[3] || "30", 10),
        recurring: row[4] === "TRUE" || row[4] === "true",
        label: row[5] || "",
        created_at: row[6] || "",
      }));
  } catch (error) {
    console.error("Failed to read Blocks sheet:", error);
    return [];
  }
}

export async function addBlock(block: Omit<Block, "id" | "created_at">): Promise<string> {
  const sheets = getSheets();
  const id = genId();
  const created_at = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BLOCKS_SHEET}!A:G`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        id,
        block.date,
        block.time,
        block.duration_minutes,
        block.recurring ? "TRUE" : "FALSE",
        block.label,
        created_at,
      ]],
    },
  });

  return id;
}

export async function deleteBlock(blockId: string): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BLOCKS_SHEET}!A2:G`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row) => row[0] === blockId);
  if (rowIndex === -1) return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BLOCKS_SHEET}!A${sheetRow}:G${sheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [["", "", "", "", "", "", ""]],
    },
  });
  return true;
}
