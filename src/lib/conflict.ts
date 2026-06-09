import type { Slot, Block, Event } from "./sheets";

export const MIN_BOOKING_LEAD_HOURS = 3;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function intervalsOverlap(
  start1: string, dur1: number,
  start2: string, dur2: number
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = s1 + dur1;
  const s2 = timeToMinutes(start2);
  const e2 = s2 + dur2;
  return s1 < e2 && s2 < e1;
}

function dateToMSKDate(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+03:00`);
}

export function effectiveZoomLink(
  slotZoom: string | undefined,
  event: Event | undefined,
  defaultZoom: string
): string {
  return (slotZoom && slotZoom.trim()) || (event?.zoom_link || "").trim() || defaultZoom;
}

function normalizeZoom(link: string): string {
  return (link || "").trim().toLowerCase();
}

function dayOfWeekMatchesRecurring(targetIsoDate: string, recurringStartIsoDate: string): boolean {
  const target = new Date(targetIsoDate + "T00:00:00");
  const recurringStart = new Date(recurringStartIsoDate + "T00:00:00");
  if (target < recurringStart) return false;
  return target.getDay() === recurringStart.getDay();
}

export interface ConflictCheck {
  conflict: boolean;
  type?: "slot" | "block";
  reason?: string;
}

/**
 * Check whether a new slot at (date, time, duration) conflicts with anything
 * in the pool that uses the SAME Zoom link. Slots/blocks on a different Zoom
 * link don't conflict because they happen on a different account.
 */
export function findSlotConflict(params: {
  date: string;
  time: string;
  duration: number;
  newSlotZoom: string;
  slots: Slot[];
  blocks: Block[];
  events: Event[];
  defaultZoom: string;
  excludeSlotId?: string;
}): ConflictCheck {
  const { date, time, duration, newSlotZoom, slots, blocks, events, defaultZoom, excludeSlotId } = params;

  const eventById = new Map(events.map((e) => [e.id, e]));
  const newZoom = normalizeZoom(newSlotZoom);

  for (const s of slots) {
    if (!s.id || s.id === excludeSlotId) continue;
    if (s.date !== date) continue;
    if (!intervalsOverlap(s.time, s.duration_minutes, time, duration)) continue;

    const existingZoom = normalizeZoom(effectiveZoomLink(s.zoom_link, eventById.get(s.event_id), defaultZoom));
    if (existingZoom === newZoom) {
      return {
        conflict: true,
        type: "slot",
        reason: `На ${date} в ${s.time} уже есть слот (${s.duration_minutes} мин) на этом же Zoom-аккаунте`,
      };
    }
  }

  for (const b of blocks) {
    const blockZoom = normalizeZoom(b.zoom_link || defaultZoom);
    if (blockZoom !== newZoom) continue;
    if (!intervalsOverlap(b.time, b.duration_minutes, time, duration)) continue;

    if (b.recurring) {
      if (!dayOfWeekMatchesRecurring(date, b.date)) continue;
      return {
        conflict: true,
        type: "block",
        reason: b.label || "",
      };
    }

    if (b.date === date) {
      return {
        conflict: true,
        type: "block",
        reason: b.label || "",
      };
    }
  }

  return { conflict: false };
}

/**
 * Given a list of all Zoom-account links, returns which of them are free vs
 * busy at the given (date, time, duration). Useful for the slot creation UI.
 */
export function accountsAvailability(params: {
  date: string;
  time: string;
  duration: number;
  zoomLinks: string[];
  slots: Slot[];
  blocks: Block[];
  events: Event[];
  defaultZoom: string;
}): Record<string, ConflictCheck> {
  const result: Record<string, ConflictCheck> = {};
  for (const link of params.zoomLinks) {
    result[link] = findSlotConflict({
      date: params.date,
      time: params.time,
      duration: params.duration,
      newSlotZoom: link,
      slots: params.slots,
      blocks: params.blocks,
      events: params.events,
      defaultZoom: params.defaultZoom,
    });
  }
  return result;
}

export function isTooSoonForBooking(date: string, time: string): boolean {
  const slotStart = dateToMSKDate(date, time);
  const minBookingTime = new Date(Date.now() + MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000);
  return slotStart < minBookingTime;
}
