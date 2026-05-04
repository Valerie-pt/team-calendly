import type { Slot, Block } from "./sheets";

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

export interface ConflictCheck {
  conflict: boolean;
  reason?: string;
}

export function findSlotConflict(
  date: string,
  time: string,
  duration: number,
  slots: Slot[],
  blocks: Block[],
  excludeSlotId?: string
): ConflictCheck {
  // Check existing slots (any event)
  for (const s of slots) {
    if (!s.id || s.id === excludeSlotId) continue;
    if (s.date !== date) continue;
    if (intervalsOverlap(s.time, s.duration_minutes, time, duration)) {
      return {
        conflict: true,
        reason: `На ${date} в ${s.time} уже есть слот (${s.duration_minutes} мин)`,
      };
    }
  }

  // One-time blocks
  for (const b of blocks.filter((x) => !x.recurring)) {
    if (b.date !== date) continue;
    if (intervalsOverlap(b.time, b.duration_minutes, time, duration)) {
      return {
        conflict: true,
        reason: `Время заблокировано${b.label ? `: ${b.label}` : ""}`,
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
        reason: `Время заблокировано (повторяется)${b.label ? `: ${b.label}` : ""}`,
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
