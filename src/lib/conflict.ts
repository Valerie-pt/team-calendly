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

export interface ConflictCheck {
  conflict: boolean;
  type?: "slot" | "block";
  reason?: string;
}

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

  // Two slots conflict only if they use the same effective Zoom link.
  const eventById = new Map(events.map((e) => [e.id, e]));

  for (const s of slots) {
    if (!s.id || s.id === excludeSlotId) continue;
    if (s.date !== date) continue;
    if (!intervalsOverlap(s.time, s.duration_minutes, time, duration)) continue;

    const existingZoom = effectiveZoomLink(s.zoom_link, eventById.get(s.event_id), defaultZoom);
    if (existingZoom === newSlotZoom) {
      return {
        conflict: true,
        type: "slot",
        reason: `На ${date} в ${s.time} уже есть слот (${s.duration_minutes} мин) на этом же Zoom`,
      };
    }
  }

  // Blocks reflect the DEFAULT Zoom account being busy. If the new slot uses
  // a non-default Zoom link, blocks don't apply.
  if (newSlotZoom !== defaultZoom) {
    return { conflict: false };
  }

  // One-time blocks
  for (const b of blocks.filter((x) => !x.recurring)) {
    if (b.date !== date) continue;
    if (intervalsOverlap(b.time, b.duration_minutes, time, duration)) {
      return {
        conflict: true,
        type: "block",
        reason: b.label || "",
      };
    }
  }

  // Recurring weekly blocks
  const target = new Date(date + "T00:00:00");
  for (const b of blocks.filter((x) => x.recurring)) {
    const blockStart = new Date(b.date + "T00:00:00");
    if (target < blockStart) continue;
    if (target.getDay() !== blockStart.getDay()) continue;
    if (intervalsOverlap(b.time, b.duration_minutes, time, duration)) {
      return {
        conflict: true,
        type: "block",
        reason: b.label || "",
      };
    }
  }

  return { conflict: false };
}

export function isTooSoonForBooking(date: string, time: string): boolean {
  const slotStart = dateToMSKDate(date, time);
  const minBookingTime = new Date(Date.now() + MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000);
  return slotStart < minBookingTime;
}
