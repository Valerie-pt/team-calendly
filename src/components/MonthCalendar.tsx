"use client";

import { useMemo, useState } from "react";
import type { Slot } from "@/lib/sheets";

const MONTHS_GENITIVE = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

// Russian week starts on Monday (Mon=0 internal, Sun=6)
const WEEKDAY_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

// Returns day-of-week index where Mon=0 ... Sun=6
function mondayBasedDay(d: Date): number {
  const dow = d.getDay(); // Sun=0
  return dow === 0 ? 6 : dow - 1;
}

interface MonthCalendarProps {
  slots: Slot[];
  onSelect: (slot: Slot) => void;
}

export default function MonthCalendar({ slots, onSelect }: MonthCalendarProps) {
  // Pre-group slots by ISO date for quick lookup.
  const slotsByDate = useMemo(() => {
    const map: Record<string, Slot[]> = {};
    for (const s of slots) {
      (map[s.date] ??= []).push(s);
    }
    return map;
  }, [slots]);

  // Determine min/max month boundaries from slot data.
  const { minMonth, maxMonth } = useMemo(() => {
    if (slots.length === 0) {
      const m = startOfMonth(new Date());
      return { minMonth: m, maxMonth: m };
    }
    const times = slots.map((s) => new Date(s.date + "T00:00:00").getTime());
    return {
      minMonth: startOfMonth(new Date(Math.min(...times))),
      maxMonth: startOfMonth(new Date(Math.max(...times))),
    };
  }, [slots]);

  // Default: month of the earliest available slot, but no earlier than today.
  const todayMonth = startOfMonth(new Date());
  const initialMonth = minMonth.getTime() > todayMonth.getTime() ? minMonth : todayMonth;

  const [viewMonth, setViewMonth] = useState<Date>(initialMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    // Auto-select the earliest date with slots in the initial view.
    const sorted = Object.keys(slotsByDate).sort();
    return sorted[0] ?? null;
  });

  const canGoBack = viewMonth.getTime() > minMonth.getTime();
  const canGoForward = viewMonth.getTime() < maxMonth.getTime();

  // Build the grid: cells for the visible month, padded with leading/trailing
  // blank cells so weeks always span Mon-Sun.
  const first = startOfMonth(viewMonth);
  const last = endOfMonth(viewMonth);
  const leadingBlanks = mondayBasedDay(first);
  const totalCells = leadingBlanks + last.getDate();
  const trailingBlanks = (7 - (totalCells % 7)) % 7;
  const cells: ({ type: "blank" } | { type: "day"; date: Date; iso: string })[] = [];

  for (let i = 0; i < leadingBlanks; i++) cells.push({ type: "blank" });
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day);
    cells.push({ type: "day", date: d, iso: toISODate(d) });
  }
  for (let i = 0; i < trailingBlanks; i++) cells.push({ type: "blank" });

  const todayIso = toISODate(new Date());
  const selectedSlots = selectedDate ? (slotsByDate[selectedDate] || []) : [];
  const selectedDateObj = selectedDate ? new Date(selectedDate + "T00:00:00") : null;

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, -1))}
          disabled={!canGoBack}
          aria-label="Предыдущий месяц"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-card-bg text-foreground hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-semibold text-foreground text-lg">
          {MONTHS_GENITIVE[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </p>
        <button
          onClick={() => setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canGoForward}
          aria-label="Следующий месяц"
          className="w-10 h-10 flex items-center justify-center rounded-full bg-card-bg text-foreground hover:bg-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAY_LABELS.map((wd) => (
          <div key={wd} className="text-center text-xs text-text-secondary uppercase tracking-wide py-1">
            {wd}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-6">
        {cells.map((cell, i) => {
          if (cell.type === "blank") {
            return <div key={`b${i}`} aria-hidden className="aspect-square" />;
          }
          const daySlots = slotsByDate[cell.iso] || [];
          const hasSlots = daySlots.length > 0;
          const isToday = cell.iso === todayIso;
          const isSelected = cell.iso === selectedDate;

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={!hasSlots}
              onClick={() => setSelectedDate(cell.iso)}
              className={`aspect-square flex flex-col items-center justify-center rounded-xl transition-all ${
                isSelected
                  ? "bg-accent text-white"
                  : hasSlots
                    ? "bg-card-bg text-foreground hover:bg-border cursor-pointer"
                    : "text-text-secondary/40 cursor-default"
              } ${isToday && !isSelected ? "ring-1 ring-accent/40" : ""}`}
            >
              <span className={`text-sm font-medium ${isSelected ? "text-white" : ""}`}>
                {cell.date.getDate()}
              </span>
              {hasSlots && (
                <span
                  className={`mt-0.5 inline-block w-1.5 h-1.5 rounded-full ${
                    isSelected ? "bg-white" : "bg-accent"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Time slots for selected day */}
      {selectedDate && selectedDateObj && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {selectedDateObj.getDate()} {MONTHS_GENITIVE[selectedDateObj.getMonth()].toLowerCase()}, {WEEKDAY_LABELS[mondayBasedDay(selectedDateObj)]}
          </h3>
          {selectedSlots.length === 0 ? (
            <p className="text-text-secondary text-sm bg-card-bg rounded-xl p-4 text-center">
              На этот день нет свободных слотов
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {selectedSlots
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => onSelect(slot)}
                    className="bg-card-bg hover:bg-accent hover:text-white px-3 py-2.5 rounded-xl text-sm font-medium text-foreground transition-colors"
                  >
                    {slot.time}
                    <span className="text-xs opacity-70 ml-1">· {slot.duration_minutes} мин</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
